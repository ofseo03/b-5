import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { go } from "../router";
import type { Message, Room, User } from "../types";
import { clock, timeLeft } from "../util";
import { status } from "./Chats";

export function ChatRoom({ id, me }: { id: string; me: User }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ room: Room; messages: Message[] }>(`/rooms/${id}`);
      setRoom(d.room);
      setMessages(d.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
    // 실제 대화로 이어진 뒤에는 상대 메시지를 받기 위해 주기적으로 새로 고친다
    const t = setInterval(() => {
      void load();
      setTick((n) => n + 1);
    }, 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  async function send() {
    const body = text.trim();
    if (!body || !room) return;
    setSending(true);
    setError(null);
    setText("");
    setMessages((ms) => [
      ...ms,
      { id: "pending", roomId: room.id, phase: room.mode === "human" ? "human" : "persona", kind: "user", senderId: me.id, text: body, createdAt: new Date().toISOString() },
    ]);
    try {
      const d = await api<{ messages: Message[]; room: Room }>(`/rooms/${room.id}/messages`, { body: { text: body } });
      setMessages((ms) => [...ms.filter((m) => m.id !== "pending"), ...d.messages]);
      setRoom(d.room);
    } catch (e) {
      setMessages((ms) => ms.filter((m) => m.id !== "pending"));
      setText(body);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function decide(decision: "connect" | "pass") {
    if (!room) return;
    if (decision === "pass" && !confirm("이 사람과는 대화를 이어가지 않을까요?")) return;
    try {
      const d = await api<{ room: Room }>(`/rooms/${room.id}/decision`, { body: { decision } });
      setRoom(d.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!room) {
    return (
      <div className="page center">
        {error ? <p className="error">{error}</p> : <div className="spinner" />}
        <button className="link" onClick={() => go({ name: "chats" })}>채팅 목록으로</button>
      </div>
    );
  }

  const partner = room.partner;
  const personaOwner = room.target;
  const turnsLeft = room.personaTurnLimit - room.personaTurns;

  return (
    <div className="chat">
      <header className="chat-head">
        <button className="link" onClick={() => go({ name: "chats" })}>←</button>
        <Avatar id={partner.avatarId} size={36} />
        <div>
          <strong>{room.mode === "persona" ? `${partner.nickname}의 페르소나` : partner.nickname}</strong>
          <p className="small muted">{status(room)}</p>
        </div>
      </header>

      {room.mode === "persona" && room.role === "owner" && (
        <div className="banner">
          <p>
            {partner.nickname}님의 <b>AI 페르소나</b>와 대화 중이에요. 이 대화는 상대에게 알림이 가지 않아요.
            페르소나와는 {room.personaTurnLimit}번까지 대화할 수 있고, 언제든 "대화하기"를 누를 수 있어요.
          </p>
          <p className="small">선택 마감: {timeLeft(room.decisionDeadline)} (마감되면 자동으로 "선택 안 함")</p>
          <div className="row">
            <button className="btn" onClick={() => void decide("pass")}>선택 안 함</button>
            <button className="btn primary grow" onClick={() => void decide("connect")}>대화하기</button>
          </div>
        </div>
      )}
      {room.mode === "human" && room.role === "target" && (
        <div className="banner soft">
          {partner.nickname}님이 회원님의 페르소나와 대화해 보고 대화를 요청했어요. 아래에서 페르소나와 나눈 대화를 보고 이어서 답할 수 있어요.
        </div>
      )}
      {room.mode === "closed" && <div className="banner soft">{status(room)} 처리된 채팅방이에요. 기록은 남아 있어요.</div>}

      <div className="messages">
        {messages.length === 0 && room.mode === "persona" && (
          <p className="muted small center-text">먼저 인사를 건네 보세요. 공통 관심사로 시작하면 좋아요.</p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const divider = prev && prev.phase === "persona" && m.phase === "human";
          const mine = m.senderId === me.id;
          const label =
            m.kind === "persona" ? (personaOwner.id === me.id ? "내 페르소나" : `${personaOwner.nickname}의 페르소나`) : null;
          return (
            <Fragment key={m.id + i}>
              {divider && <div className="divider">여기부터 실제 대화</div>}
              <div className={`msg ${mine ? "mine" : ""} ${m.kind === "persona" ? "persona" : ""} ${m.id === "pending" ? "pending" : ""}`}>
                {label && <span className="msg-label">🤖 {label}</span>}
                <div className="bubble">{m.text}</div>
                <span className="time">{clock(m.createdAt)}</span>
              </div>
            </Fragment>
          );
        })}
        {sending && room.mode === "persona" && (
          <div className="msg persona">
            <div className="bubble typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {error && <p className="error pad">{error}</p>}
      {room.canSend ? (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder={room.mode === "persona" ? `페르소나에게 보내기 (남은 횟수 ${turnsLeft})` : "메시지 보내기"}
            disabled={sending}
          />
          <button className="btn primary" disabled={sending || !text.trim()}>보내기</button>
        </form>
      ) : (
        room.mode === "persona" && (
          <p className="composer-note">페르소나와의 대화 {room.personaTurnLimit}번을 모두 했어요. "대화하기" 또는 "선택 안 함"을 골라 주세요.</p>
        )
      )}
    </div>
  );
}
