import { config } from "./config.js";
import { db, notify, now, save, type Room, type User } from "./db.js";

/**
 * 선택 마감 처리 (회의 결정: 24시간 보류, 마감 1시간 전 알림, 미선택 시 자동 "선택 안 함").
 * 요청마다, 그리고 주기적으로 호출한다.
 */
export function sweepDeadlines(at = Date.now()): void {
  let changed = false;
  for (const room of db.rooms) {
    if (room.mode !== "persona" || room.decision) continue;
    const deadline = Date.parse(room.decisionDeadline);
    const partner = db.users.find((u) => u.id === room.targetId);
    const name = partner?.nickname ?? "상대";
    if (at >= deadline) {
      room.decision = "auto_pass";
      room.mode = "closed";
      notify(room.ownerId, "auto_pass", `${name}님 페르소나와의 대화가 마감되어 "선택 안 함"으로 처리됐어요.`, room.id);
      changed = true;
    } else if (!room.reminded && at >= deadline - config.reminderBeforeMs) {
      room.reminded = true;
      const minutes = Math.max(1, Math.round((deadline - at) / 60_000));
      notify(room.ownerId, "decision_reminder", `${name}님 페르소나와의 대화 선택 마감까지 ${minutes}분 남았어요.`, room.id);
      changed = true;
    }
  }
  if (changed) save();
}

export function canView(room: Room, userId: string): "owner" | "target" | null {
  if (room.ownerId === userId) return "owner";
  // 상대는 "대화하기"를 받은 뒤에만 방을 본다 (페르소나 대화 중에는 알림이 가지 않는다)
  if (room.targetId === userId && room.decision === "connect") return "target";
  return null;
}

export function publicUser(u: User | undefined) {
  return u ? { id: u.id, nickname: u.nickname, avatarId: u.avatarId } : null;
}

export function roomView(room: Room, viewerId: string) {
  const role = canView(room, viewerId);
  const partnerId = viewerId === room.ownerId ? room.targetId : room.ownerId;
  const messages = db.messages.filter((m) => m.roomId === room.id);
  const last = messages[messages.length - 1];
  return {
    id: room.id,
    role,
    mode: room.mode,
    decision: room.decision,
    personaTurns: room.personaTurns,
    personaTurnLimit: config.personaTurnLimit,
    decisionDeadline: room.decisionDeadline,
    connectedAt: room.connectedAt,
    createdAt: room.createdAt,
    owner: publicUser(db.users.find((u) => u.id === room.ownerId)),
    target: publicUser(db.users.find((u) => u.id === room.targetId)),
    partner: publicUser(db.users.find((u) => u.id === partnerId)),
    lastMessage: last ? { text: last.text, kind: last.kind, createdAt: last.createdAt } : null,
    canSend:
      (room.mode === "persona" && role === "owner" && room.personaTurns < config.personaTurnLimit) ||
      room.mode === "human",
    canDecide: room.mode === "persona" && role === "owner" && !room.decision,
  };
}

export function newRoom(ownerId: string, targetId: string): Room {
  const created = Date.now();
  return {
    id: `r_${created.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ownerId,
    targetId,
    mode: "persona",
    decision: null,
    personaTurns: 0,
    createdAt: now(),
    decisionDeadline: new Date(created + config.decisionWindowMs).toISOString(),
    reminded: false,
    connectedAt: null,
  };
}
