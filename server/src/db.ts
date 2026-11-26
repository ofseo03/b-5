import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Persona } from "./persona.js";
import type { Answer } from "./questions.js";

// 로컬 실행용 JSON 파일 저장소. 실제 서비스에서는 DB로 바꾼다.

export interface User {
  id: string;
  nickname: string;
  avatarId: string;
  isDemo: boolean;
  createdAt: string;
  answers: Answer[];
  persona: Persona;
}

export interface Swipe {
  userId: string;
  targetId: string;
  direction: "yes" | "no";
  createdAt: string;
}

export type RoomMode = "persona" | "human" | "closed";
export type Decision = "connect" | "pass" | "auto_pass";

export interface Room {
  id: string;
  /** 스와이프한 사람 (페르소나와 대화하는 쪽) */
  ownerId: string;
  /** 페르소나의 주인 */
  targetId: string;
  mode: RoomMode;
  decision: Decision | null;
  personaTurns: number;
  createdAt: string;
  decisionDeadline: string;
  reminded: boolean;
  connectedAt: string | null;
}

export interface Message {
  id: string;
  roomId: string;
  phase: "persona" | "human";
  kind: "user" | "persona";
  /** kind=user면 보낸 사람, kind=persona면 페르소나 주인 */
  senderId: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: "decision_reminder" | "auto_pass" | "connect_request";
  roomId: string | null;
  text: string;
  createdAt: string;
  read: boolean;
}

interface Data {
  users: User[];
  swipes: Swipe[];
  rooms: Room[];
  messages: Message[];
  notifications: Notification[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.resolve(here, "../data/db.json");
const DATA_DIR = path.dirname(DB_FILE);

function empty(): Data {
  return { users: [], swipes: [], rooms: [], messages: [], notifications: [] };
}

function load(): Data {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
  } catch {
    return empty();
  }
}

export const db: Data = load();

export function save(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export const newId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;
export const now = () => new Date().toISOString();

export function notify(userId: string, type: Notification["type"], text: string, roomId: string | null): void {
  db.notifications.push({ id: newId("n"), userId, type, roomId, text, createdAt: now(), read: false });
}
