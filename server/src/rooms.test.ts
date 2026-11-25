import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DB_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "b5-")), "db.json");
process.env.DECISION_WINDOW_MINUTES = "60";
process.env.REMINDER_BEFORE_MINUTES = "10";

const { db } = await import("./db.js");
const { newRoom, sweepDeadlines, canView } = await import("./rooms.js");

test("마감 전 알림 → 마감 후 자동 '선택 안 함'", () => {
  const room = newRoom("u_a", "u_b");
  db.rooms.push(room);
  const deadline = Date.parse(room.decisionDeadline);

  sweepDeadlines(deadline - 30 * 60_000);
  assert.equal(db.notifications.length, 0, "아직 알림 시점 아님");

  sweepDeadlines(deadline - 5 * 60_000);
  assert.equal(room.reminded, true);
  assert.equal(db.notifications.filter((n) => n.type === "decision_reminder").length, 1);

  sweepDeadlines(deadline - 4 * 60_000);
  assert.equal(db.notifications.filter((n) => n.type === "decision_reminder").length, 1, "알림은 한 번만");

  sweepDeadlines(deadline + 1);
  assert.equal(room.decision, "auto_pass");
  assert.equal(room.mode, "closed");
  assert.equal(db.notifications.filter((n) => n.type === "auto_pass" && n.userId === "u_a").length, 1);
});

test("상대는 '대화하기' 전에는 방을 볼 수 없다", () => {
  const room = newRoom("u_c", "u_d");
  assert.equal(canView(room, "u_c"), "owner");
  assert.equal(canView(room, "u_d"), null);
  room.decision = "connect";
  room.mode = "human";
  assert.equal(canView(room, "u_d"), "target");
});
