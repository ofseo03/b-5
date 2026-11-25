import { useEffect, useState } from "react";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { go } from "../router";
import type { Room } from "../types";
import { timeLeft } from "../util";

export function status(room: Room): string {
  if (room.mode === "persona") return `페르소나와 대화 중 ${room.personaTurns}/${room.personaTurnLimit} · 선택 ${timeLeft(room.decisionDeadline)}`;
  if (room.mode === "human") return "실제 대화 중";
  if (room.decision === "auto_pass") return "선택 안 함 (자동)";
  return "선택 안 함";
}

export function Chats() {
  const [rooms, setRooms] = useState<Room[] | null>(null);

  useEffect(() => {
    const load = () => api<{ rooms: Room[] }>("/rooms").then((d) => setRooms(d.rooms));
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (rooms === null) return <div className="page center"><div className="spinner" /></div>;
  if (!rooms.length) {
    return (
      <div className="page center">
        <p>아직 채팅방이 없어요.</p>
        <button className="btn primary" onClick={() => go({ name: "discover" })}>추천 보러 가기</button>
      </div>
    );
  }

  return (
    <div className="page">
      <ul className="room-list">
        {rooms.map((r) => (
          <li key={r.id}>
            <button onClick={() => go({ name: "room", id: r.id })} className={r.mode === "closed" ? "closed" : ""}>
              <Avatar id={r.partner.avatarId} size={44} />
              <div className="room-meta">
                <div className="room-title">
                  <strong>{r.partner.nickname}</strong>
                  {r.mode === "persona" && <span className="badge">페르소나</span>}
                  {r.mode === "human" && <span className="badge live">연결됨</span>}
                </div>
                <p className="small muted ellipsis">{r.lastMessage?.text ?? "아직 대화가 없어요. 먼저 말을 걸어 보세요."}</p>
                <p className="small status">{status(r)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
