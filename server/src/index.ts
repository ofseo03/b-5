import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import { AVATARS, isAvatar } from "./avatars.js";
import { db, newId, notify, now, save, type User } from "./db.js";
import { keywordsFromAnswers, needsFollowup } from "./keywords.js";
import { llm } from "./llm/index.js";
import type { ChatTurn } from "./llm/types.js";
import { matchPersonas } from "./match.js";
import { clampContent, containsPii, type Persona } from "./persona.js";
import { getQuestion, MAX_FOLLOWUPS_PER_QUESTION, QUESTIONS, type Answer } from "./questions.js";
import { canView, newRoom, roomView, sweepDeadlines } from "./rooms.js";
import { buildMatchKeywords, seedIfEmpty } from "./seed.js";

seedIfEmpty();

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use((_req, _res, next) => {
  sweepDeadlines();
  next();
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// 로컬 시연용: 로그인 대신 x-user-id 헤더로 사용자를 구분한다.
function me(req: Request): User {
  const id = req.header("x-user-id");
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new HttpError(401, "사용자를 선택해 주세요.");
  return user;
}

function validateNickname(nickname: unknown): string | null {
  if (typeof nickname !== "string") return "닉네임을 입력해 주세요.";
  const n = nickname.trim();
  if (n.length < 2 || n.length > 10) return "닉네임은 2~10자로 정해 주세요.";
  if (containsPii(n) || /\d{7,}/.test(n)) return "전화번호, 이메일, SNS 아이디처럼 나를 알아볼 수 있는 정보는 넣지 마세요.";
  if (db.users.some((u) => u.nickname === n)) return "이미 쓰고 있는 닉네임이에요.";
  return null;
}

// ---------- 설정 / 가입 ----------

app.get("/api/config", (_req, res) => {
  res.json({
    llmProvider: llm.name,
    personaTurnLimit: config.personaTurnLimit,
    decisionWindowMinutes: config.decisionWindowMs / 60_000,
    reminderBeforeMinutes: config.reminderBeforeMs / 60_000,
    maxPersonaRooms: config.maxPersonaRooms,
    avatars: AVATARS,
  });
});

app.get("/api/signup/questions", (_req, res) => {
  res.json({ questions: QUESTIONS, maxFollowups: MAX_FOLLOWUPS_PER_QUESTION });
});

app.get("/api/signup/nickname", (req, res) => {
  const error = validateNickname(req.query.value);
  res.json({ ok: !error, error });
});

app.post("/api/signup/followup", async (req, res) => {
  const { questionId, latestAnswer, followupsSoFar } = req.body ?? {};
  const q = getQuestion(String(questionId));
  if (!q) throw new HttpError(400, "알 수 없는 질문입니다.");
  const count = Number(followupsSoFar) || 0;
  if (!needsFollowup(q, String(latestAnswer ?? ""), count, MAX_FOLLOWUPS_PER_QUESTION)) {
    res.json({ followup: null });
    return;
  }
  const followup = q.followups[count] ?? (await llm.followupQuestion({ question: q, latestAnswer: String(latestAnswer ?? "") }));
  res.json({ followup });
});

app.post("/api/users", async (req, res) => {
  const { nickname, avatarId, answers } = req.body ?? {};
  const nickError = validateNickname(nickname);
  if (nickError) throw new HttpError(400, nickError);
  if (!isAvatar(avatarId)) throw new HttpError(400, "캐릭터를 골라 주세요.");
  if (!Array.isArray(answers)) throw new HttpError(400, "답변이 없습니다.");

  const cleaned: Answer[] = answers
    .filter((a: Answer) => getQuestion(a?.questionId))
    .map((a: Answer) => ({
      questionId: a.questionId,
      choices: Object.fromEntries(
        Object.entries(a.choices ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(String).slice(0, 20) : []]),
      ),
      text: String(a.text ?? "").slice(0, 500),
      followups: (Array.isArray(a.followups) ? a.followups : [])
        .slice(0, MAX_FOLLOWUPS_PER_QUESTION)
        .map((f) => ({ question: String(f.question ?? ""), answer: String(f.answer ?? "").slice(0, 500) })),
    }));
  for (const q of QUESTIONS.filter((x) => x.required)) {
    const a = cleaned.find((x) => x.questionId === q.id);
    const hasChoice = a && Object.values(a.choices).some((v) => v.length > 0);
    const hasText = a && a.text.trim().length > 0;
    if (!a || (!hasChoice && !hasText)) throw new HttpError(400, `필수 질문에 답해 주세요: ${q.title}`);
  }

  const extracted = keywordsFromAnswers(cleaned, QUESTIONS);
  const content = clampContent(await llm.generatePersona({ answers: cleaned, questions: QUESTIONS, extractedNouns: extracted }));
  const { extra_keywords: _extra, missing_fields, ...rest } = content;
  const answerIds = cleaned.map((a) => a.questionId);
  const persona: Persona = {
    schema_version: "0.1",
    profile: { nickname: nickname.trim(), avatar_id: avatarId },
    ...rest,
    match_keywords: buildMatchKeywords(content, extracted),
    meta: { source_answer_ids: answerIds, created_at: now(), missing_fields },
  };
  const user: User = {
    id: newId("u"),
    nickname: nickname.trim(),
    avatarId,
    isDemo: false,
    createdAt: now(),
    answers: cleaned,
    persona,
  };
  db.users.push(user);
  save();
  res.status(201).json({ user });
});

app.get("/api/users", (_req, res) => {
  res.json({
    users: db.users.map((u) => ({ id: u.id, nickname: u.nickname, avatarId: u.avatarId, isDemo: u.isDemo })),
  });
});

app.get("/api/me", (req, res) => {
  res.json({ user: me(req) });
});

app.patch("/api/me", (req, res) => {
  const user = me(req);
  const { avatarId } = req.body ?? {};
  if (avatarId !== undefined) {
    if (!isAvatar(avatarId)) throw new HttpError(400, "없는 캐릭터입니다.");
    user.avatarId = avatarId;
    user.persona.profile.avatar_id = avatarId;
  }
  save();
  res.json({ user });
});

// ---------- 매칭 ----------

app.get("/api/discover", (req, res) => {
  const user = me(req);
  const swiped = new Set(db.swipes.filter((s) => s.userId === user.id).map((s) => s.targetId));
  // 이미 채팅방으로 이어진 사람(상대가 나에게 대화를 요청한 경우 포함)은 추천에서 뺀다
  for (const r of db.rooms) {
    if (r.targetId === user.id && r.decision === "connect") swiped.add(r.ownerId);
  }
  const cards = db.users
    .filter((u) => u.id !== user.id && !swiped.has(u.id))
    .map((u) => {
      const m = matchPersonas(user.persona, u.persona);
      return {
        userId: u.id,
        nickname: u.nickname,
        avatarId: u.avatarId,
        matchRate: m.rate,
        common: m.common,
        personalityTags: u.persona.personality.tags,
        summary: u.persona.personality.summary,
        hobbies: u.persona.hobbies.map((h) => h.name),
        interests: u.persona.interests.slice(0, 5),
        toneTags: u.persona.speech_style.tone_tags,
      };
    })
    .sort((a, b) => b.matchRate - a.matchRate);
  res.json({ cards });
});

app.post("/api/swipes", (req, res) => {
  const user = me(req);
  const { targetId, direction } = req.body ?? {};
  const target = db.users.find((u) => u.id === targetId);
  if (!target || target.id === user.id) throw new HttpError(400, "대상을 찾을 수 없습니다.");
  if (direction !== "yes" && direction !== "no") throw new HttpError(400, "direction은 yes 또는 no 입니다.");
  if (db.swipes.some((s) => s.userId === user.id && s.targetId === target.id)) throw new HttpError(409, "이미 선택한 사람입니다.");

  if (direction === "yes" && config.maxPersonaRooms > 0) {
    const active = db.rooms.filter((r) => r.ownerId === user.id && r.mode === "persona").length;
    if (active >= config.maxPersonaRooms) {
      throw new HttpError(409, `페르소나 채팅방은 동시에 ${config.maxPersonaRooms}개까지 열 수 있어요. 기존 방에서 먼저 선택해 주세요.`);
    }
  }

  db.swipes.push({ userId: user.id, targetId: target.id, direction, createdAt: now() });
  let roomId: string | null = null;
  if (direction === "yes") {
    const room = newRoom(user.id, target.id);
    db.rooms.push(room);
    roomId = room.id;
  }
  save();
  res.status(201).json({ roomId });
});

// ---------- 채팅 ----------

app.get("/api/rooms", (req, res) => {
  const user = me(req);
  const rooms = db.rooms
    .filter((r) => canView(r, user.id))
    .map((r) => roomView(r, user.id))
    .sort((a, b) => (b.lastMessage?.createdAt ?? b.createdAt).localeCompare(a.lastMessage?.createdAt ?? a.createdAt));
  res.json({ rooms });
});

function getRoom(req: Request, userId: string) {
  const room = db.rooms.find((r) => r.id === req.params.id);
  if (!room || !canView(room, userId)) throw new HttpError(404, "채팅방을 찾을 수 없습니다.");
  return room;
}

app.get("/api/rooms/:id", (req, res) => {
  const user = me(req);
  const room = getRoom(req, user.id);
  res.json({ room: roomView(room, user.id), messages: db.messages.filter((m) => m.roomId === room.id) });
});

app.post("/api/rooms/:id/messages", async (req, res) => {
  const user = me(req);
  const room = getRoom(req, user.id);
  const text = String(req.body?.text ?? "").trim().slice(0, 500);
  if (!text) throw new HttpError(400, "메시지를 입력해 주세요.");

  if (room.mode === "closed") throw new HttpError(409, "종료된 채팅방입니다.");

  if (room.mode === "human") {
    const msg = { id: newId("m"), roomId: room.id, phase: "human" as const, kind: "user" as const, senderId: user.id, text, createdAt: now() };
    db.messages.push(msg);
    save();
    res.status(201).json({ messages: [msg], room: roomView(room, user.id) });
    return;
  }

  // 페르소나 대화
  if (room.ownerId !== user.id) throw new HttpError(403, "페르소나 대화는 요청한 사람만 할 수 있습니다.");
  if (room.personaTurns >= config.personaTurnLimit) {
    throw new HttpError(409, `페르소나와는 ${config.personaTurnLimit}번까지 대화할 수 있어요. "대화하기" 또는 "선택 안 함"을 골라 주세요.`);
  }
  const target = db.users.find((u) => u.id === room.targetId)!;
  const userMsg = { id: newId("m"), roomId: room.id, phase: "persona" as const, kind: "user" as const, senderId: user.id, text, createdAt: now() };
  db.messages.push(userMsg);

  const history: ChatTurn[] = db.messages
    .filter((m) => m.roomId === room.id && m.phase === "persona")
    .map((m) => ({ role: m.kind === "user" ? "user" : "assistant", text: m.text }));
  const reply = await llm.personaReply({ persona: target.persona, partnerNickname: user.nickname, history });

  const personaMsg = { id: newId("m"), roomId: room.id, phase: "persona" as const, kind: "persona" as const, senderId: target.id, text: reply, createdAt: now() };
  db.messages.push(personaMsg);
  room.personaTurns += 1;
  save();
  res.status(201).json({ messages: [userMsg, personaMsg], room: roomView(room, user.id) });
});

app.post("/api/rooms/:id/decision", (req, res) => {
  const user = me(req);
  const room = getRoom(req, user.id);
  const { decision } = req.body ?? {};
  if (room.ownerId !== user.id) throw new HttpError(403, "선택은 페르소나와 대화한 사람만 할 수 있습니다.");
  if (room.mode !== "persona" || room.decision) throw new HttpError(409, "이미 선택이 끝난 채팅방입니다.");

  if (decision === "connect") {
    room.decision = "connect";
    room.mode = "human";
    room.connectedAt = now();
    notify(
      room.targetId,
      "connect_request",
      `${user.nickname}님이 회원님의 페르소나와 대화해 보고 대화를 요청했어요. 페르소나와 나눈 대화도 볼 수 있어요.`,
      room.id,
    );
  } else if (decision === "pass") {
    room.decision = "pass";
    room.mode = "closed";
  } else {
    throw new HttpError(400, "decision은 connect 또는 pass 입니다.");
  }
  save();
  res.json({ room: roomView(room, user.id) });
});

// ---------- 알림 ----------

app.get("/api/notifications", (req, res) => {
  const user = me(req);
  const list = db.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ notifications: list, unread: list.filter((n) => !n.read).length });
});

app.post("/api/notifications/read", (req, res) => {
  const user = me(req);
  db.notifications.filter((n) => n.userId === user.id).forEach((n) => (n.read = true));
  save();
  res.json({ ok: true });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

setInterval(() => sweepDeadlines(), 15_000).unref();

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port} (LLM: ${llm.name}, 선택 보류 ${config.decisionWindowMs / 60_000}분)`);
});
