import { HOBBY_TAGS, PERSONALITY_TAGS, type PersonaContent } from "../persona.js";
import { choiceKeywords, extractNouns } from "../keywords.js";
import type { Answer } from "../questions.js";
import type { ChatTurn, LlmProvider } from "./types.js";

// API 키 없이 로컬에서 돌려 보기 위한 규칙 기반 구현.
// 실제 LLM이 정해지면 이 파일은 테스트·개발용으로만 남긴다.

const pick = <T>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

function answerOf(answers: Answer[], id: string): Answer | undefined {
  return answers.find((a) => a.questionId === id);
}
function allText(a?: Answer): string {
  if (!a) return "";
  return [a.text, ...a.followups.map((f) => f.answer)].filter(Boolean).join(" ");
}
function phrases(text: string, max: number): string[] {
  return text
    .split(/[,·\/\n]|그리고|이나 |이랑 /)
    .map((s) => s.trim().replace(/[.!?~]+$/, ""))
    .filter((s) => s.length >= 2)
    .slice(0, max)
    .map((s) => (s.length > 20 ? s.slice(0, 19) + "…" : s));
}

function generatePersona(answers: Answer[]): PersonaContent {
  const q1 = answerOf(answers, "q1"), q2 = answerOf(answers, "q2"), q3 = answerOf(answers, "q3");
  const q4 = answerOf(answers, "q4"), q5 = answerOf(answers, "q5"), q6 = answerOf(answers, "q6");
  const q7 = answerOf(answers, "q7"), q8 = answerOf(answers, "q8"), q9 = answerOf(answers, "q9");
  const q10 = answerOf(answers, "q10"), q11 = answerOf(answers, "q11"), q12 = answerOf(answers, "q12");

  // 성격
  const tags = (q4?.choices.personality ?? []).filter((t) => PERSONALITY_TAGS.includes(t));
  const approach = q5?.choices.approach?.[0];
  if (approach === "먼저 말을 거는 편") tags.push("사교적인");
  if (approach === "시간이 좀 필요한 편") tags.push("낯가리는");
  const pace = approach === "먼저 말을 거는 편" ? "빠르게 친해지기" : approach === "시간이 좀 필요한 편" ? "천천히 알아가기" : null;
  const summaryParts: string[] = [];
  if (tags.length) summaryParts.push(`${tags.slice(0, 3).join(", ")} 사람이다.`);
  if (q4?.text.trim()) summaryParts.push(`친구들은 "${q4.text.trim().slice(0, 30)}"라고 한다.`);

  // 말투
  const samples = [q7?.text, q7?.followups[0]?.answer, q8?.text].filter((s): s is string => !!s && s.trim().length > 0);
  const joined = samples.join(" ");
  const avgLen = samples.length ? samples.reduce((n, s) => n + s.length, 0) / samples.length : 0;
  const tone: string[] = [];
  if (/ㅋㅋ|ㅎㅎ/.test(joined)) tone.push("장난스러운");
  if (/!/.test(joined)) tone.push("리액션많은");
  if (/(습니다|니다)/.test(joined)) tone.push("정중한");
  if (avgLen > 45) tone.push("수다스러운");
  if (avgLen > 0 && avgLen < 18) tone.push("간결한");
  if (tone.length < 2) tone.push("친근한");
  const habits: string[] = [];
  if (/ㅋㅋ/.test(joined)) habits.push("ㅋㅋ 자주 씀");
  if (/ㅎㅎ/.test(joined)) habits.push("ㅎㅎ 자주 씀");
  if (/~/.test(joined)) habits.push("말끝에 ~ 를 붙임");
  if (/\?/.test(joined)) habits.push("질문으로 대화를 이어감");
  const formalityChoice = q9?.choices.formality?.[0];
  const formality = formalityChoice === "반말" ? "반말" : formalityChoice === "존댓말" ? "존댓말" : "상대따라";
  const emojiChoice = q9?.choices.emoji?.[0];
  const emoji = emojiChoice === "자주 씀" ? "자주" : emojiChoice === "가끔 씀" ? "가끔" : "안씀";

  // 취미·관심사
  const hobbies: PersonaContent["hobbies"] = [];
  const addHobby = (name: string, detail: string | null) => {
    if (!name || hobbies.some((h) => h.name === name)) return;
    hobbies.push({ name, detail, level: null });
  };
  const q1Text = allText(q1);
  const freq = /(매일|자주|주\s?[3-7]|매주)/.test(q1Text) ? "꾸준히" : null;
  // 처음 답이 짧으면 꼬리 질문 답이 더 자세하다. 가장 긴 답을 쓴다.
  const q1Candidates = [q1?.text ?? "", ...(q1?.followups.map((f) => f.answer) ?? [])].map((t) => t.trim()).filter((t) => t.length >= 5);
  const q1Detail = q1Candidates.sort((a, b) => b.length - a.length)[0] ?? null;
  for (const c of q1?.choices.hobby ?? []) for (const k of choiceKeywords(c)) addHobby(k, null);
  for (const n of extractNouns(q1Text)) if (HOBBY_TAGS.includes(n)) addHobby(n, null);
  if (hobbies[0]) hobbies[0] = { ...hobbies[0], detail: q1Detail, level: freq };
  const q2Nouns = extractNouns(allText(q2));
  const newHobby = q2Nouns.find((n) => HOBBY_TAGS.includes(n));
  if (newHobby) addHobby(newHobby, q2?.text.trim() || null);
  extractNouns(allText(q6))
    .filter((n) => HOBBY_TAGS.includes(n))
    .forEach((n, i) => addHobby(n, i === 0 ? q6?.text.trim() || null : null));
  const hobbyNames = new Set(hobbies.map((h) => h.name));
  const interests = [...q2Nouns, ...extractNouns(allText(q3))].filter((n) => !hobbyNames.has(n));

  // 대화·관계
  const likes = phrases(q10?.text ?? "", 4);
  const avoid = [...(q11?.choices.avoid ?? []).filter((c) => c !== "없음"), ...phrases(q11?.text ?? "", 2)];
  const dateStyle = (q12?.choices.date ?? []).filter((c) => c !== "기타");
  const values = phrases(q12?.text ?? "", 3);

  const missing: string[] = [];
  if (!hobbies.length) missing.push("hobbies");
  if (!tags.length) missing.push("personality.tags");
  if (!samples.length) missing.push("speech_style.sample_messages");
  if (!likes.length) missing.push("conversation.likes");

  return {
    personality: { tags, summary: summaryParts.join(" ") || "아직 자기소개가 많지 않다." },
    speech_style: {
      formality, tone_tags: tone, message_length: avgLen < 20 ? "짧게" : avgLen < 45 ? "보통" : "길게",
      emoji_usage: emoji, habits, sample_messages: samples,
    },
    hobbies,
    interests,
    conversation: { likes, avoid, pace },
    relationship: { date_style: dateStyle, values },
    extra_keywords: [],
    missing_fields: missing,
  };
}

function personaReply(input: Parameters<LlmProvider["personaReply"]>[0]): string {
  const { persona, partnerNickname, history } = input;
  const last = history[history.length - 1]?.text ?? "";
  const turn = history.filter((h) => h.role === "user").length;
  const s = persona.speech_style;
  const formal = s.formality === "존댓말" || (s.formality === "상대따라" && /(요|니다|세요)[\s?!.~]*$/.test(last.trim()));
  const say = (f: string, c: string) => (formal ? f : c);

  const nouns = extractNouns(last);
  const hobby = persona.hobbies.find((h) => nouns.includes(h.name) || nouns.some((n) => h.detail?.includes(n)));
  const interest = persona.interests.find((i) => nouns.includes(i));
  const avoidHit = persona.conversation.avoid.find((a) => a.split("·").some((part) => last.includes(part)));
  const myHobby = persona.hobbies[turn % Math.max(persona.hobbies.length, 1)];
  const like = persona.conversation.likes[0];

  let reply: string;
  if (/(AI|에이아이|봇|로봇|페르소나|사람이에요|사람이야|진짜 사람)/i.test(last)) {
    reply = say(
      `저는 ${persona.profile.nickname}님이 가입할 때 남긴 답을 바탕으로 만든 페르소나예요. 대화가 잘 통하면 '대화하기'로 진짜 ${persona.profile.nickname}님과 이어서 얘기할 수 있어요!`,
      `난 ${persona.profile.nickname}가 가입할 때 남긴 답으로 만든 페르소나야. 얘기 잘 통하면 '대화하기'로 진짜 ${persona.profile.nickname}랑 이어서 얘기할 수 있어!`,
    );
  } else if (avoidHit) {
    reply = say(
      `그 얘기는 처음엔 조금 조심스러워서요. 대신 ${myHobby?.name ?? "요즘 관심사"} 얘기 해 볼래요?`,
      `그 얘기는 처음엔 좀 조심스러워서 ㅎㅎ 대신 ${myHobby?.name ?? "요즘 관심사"} 얘기 할래?`,
    );
  } else if (turn <= 1 && /(안녕|반가|처음|하이|hi|hello)/i.test(last)) {
    reply = say(
      `안녕하세요 ${partnerNickname}님, 반가워요! 저는 요즘 ${myHobby?.name ?? "이것저것"}에 빠져 있어요. ${partnerNickname}님은 요즘 뭐에 빠져 있어요?`,
      `안녕 ${partnerNickname}, 반가워! 나 요즘 ${myHobby?.name ?? "이것저것"}에 빠져 있어. 넌 요즘 뭐에 빠져 있어?`,
    );
  } else if (hobby) {
    const detail = hobby.detail ? hobby.detail.replace(/[.!]+$/, "") : null;
    reply = say(
      `오 ${hobby.name} 얘기 너무 좋아요! 저도 ${hobby.name} 정말 좋아하거든요${detail ? ` (${detail})` : ""}. ${partnerNickname}님은 ${hobby.name} 중에 뭘 제일 좋아해요?`,
      `오 ${hobby.name} 얘기 좋다! 나도 ${hobby.name} 진짜 좋아하거든${detail ? ` (${detail})` : ""}. 넌 ${hobby.name} 중에 뭐 제일 좋아해?`,
    );
  } else if (interest) {
    reply = say(
      `${interest} 얘기 나오니까 반갑네요! 저도 요즘 관심 있게 보고 있거든요. 어떻게 관심 갖게 됐어요?`,
      `${interest} 얘기 나오니까 반갑다! 나도 요즘 관심 있게 보고 있거든. 어쩌다 관심 생겼어?`,
    );
  } else if (/(취미|뭐 해|뭐해|좋아하는|주말|쉬는 날)/.test(last)) {
    const list = persona.hobbies.map((h) => h.name).join(", ") || "이것저것";
    reply = say(
      `저는 ${list} 좋아해요. 특히 ${myHobby?.name ?? "소소한 일상"} 얘기면 신나요. ${partnerNickname}님은요?`,
      `나는 ${list} 좋아해. 특히 ${myHobby?.name ?? "소소한 일상"} 얘기면 신나. 너는?`,
    );
  } else {
    reply = pick(
      [
        say(`그렇군요! ${like ? `저는 ${like} 같은 대화를 좋아하는데, ` : ""}${partnerNickname}님 이야기 더 듣고 싶어요. 요즘 가장 즐거운 일이 뭐예요?`,
            `그렇구나! ${like ? `난 ${like} 같은 얘기 좋아하는데, ` : ""}네 얘기 더 듣고 싶어. 요즘 제일 즐거운 일이 뭐야?`),
        say(`오 그건 몰랐어요. 혹시 쉬는 날엔 주로 뭐 하면서 보내요?`, `오 그건 몰랐다. 쉬는 날엔 주로 뭐 하면서 보내?`),
        say(`재밌네요! 저는 ${myHobby?.name ?? "새로운 거"} 할 때 시간 가는 줄 몰라요. ${partnerNickname}님은 그런 거 있어요?`,
            `재밌다! 난 ${myHobby?.name ?? "새로운 거"} 할 때 시간 가는 줄 몰라. 너도 그런 거 있어?`),
      ],
      turn,
    );
  }

  if (s.habits.some((h) => h.includes("ㅋㅋ")) && !formal) reply += " ㅋㅋ";
  else if (s.habits.some((h) => h.includes("ㅎㅎ"))) reply += " ㅎㅎ";
  if (s.emoji_usage === "자주") reply += " 😊";
  else if (s.emoji_usage === "가끔" && turn % 2 === 0) reply += " 🙂";
  return reply;
}

export const mockProvider: LlmProvider = {
  name: "mock",
  async generatePersona({ answers }) {
    return generatePersona(answers);
  },
  async personaReply(input) {
    return personaReply(input);
  },
  async followupQuestion({ question }) {
    if (question.followupCheck === "length") return "실제로 보낼 메시지처럼 조금만 더 길게 써 주실래요?";
    return "조금만 더 자세히 알려 주실래요? 예를 들면 언제, 어디서, 무엇을 하는지요.";
  },
};

export type { ChatTurn };
