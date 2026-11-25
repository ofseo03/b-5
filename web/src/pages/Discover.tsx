import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { go } from "../router";
import type { Card } from "../types";

const THRESHOLD = 110;

export function Discover() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [dx, setDx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const start = useRef<number | null>(null);

  const load = () => api<{ cards: Card[] }>("/discover").then((d) => setCards(d.cards));
  useEffect(() => {
    void load();
  }, []);

  const card = cards?.[0];

  async function swipe(direction: "yes" | "no") {
    if (!card) return;
    setError(null);
    try {
      const r = await api<{ roomId: string | null }>("/swipes", { body: { targetId: card.userId, direction } });
      setCards((cs) => cs?.slice(1) ?? null);
      setDx(0);
      if (r.roomId) go({ name: "room", id: r.roomId });
    } catch (e) {
      setDx(0);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (cards === null) return <div className="page center"><div className="spinner" /></div>;
  if (!card) {
    return (
      <div className="page center">
        <p>지금은 추천할 사람이 없어요.</p>
        <p className="muted small">다른 사용자로 가입해 보거나, 채팅 탭에서 진행 중인 대화를 확인해 보세요.</p>
      </div>
    );
  }

  const rotate = dx / 20;
  const hint = dx > 40 ? "yes" : dx < -40 ? "no" : null;

  return (
    <div className="page discover">
      <p className="muted small">일치율이 높은 순서예요. 오른쪽으로 넘기면 Yes, 왼쪽은 No.</p>
      <div
        className={`swipe-card ${hint ?? ""}`}
        style={{ transform: `translateX(${dx}px) rotate(${rotate}deg)`, transition: start.current === null ? "transform .2s" : "none" }}
        onPointerDown={(e) => {
          start.current = e.clientX;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current !== null) setDx(e.clientX - start.current);
        }}
        onPointerUp={() => {
          start.current = null;
          if (dx > THRESHOLD) void swipe("yes");
          else if (dx < -THRESHOLD) void swipe("no");
          else setDx(0);
        }}
      >
        {hint && <span className={`stamp ${hint}`}>{hint === "yes" ? "YES" : "NO"}</span>}
        <div className="card-top">
          <Avatar id={card.avatarId} size={72} />
          <div className="rate">
            <strong>{card.matchRate}%</strong>
            <span className="muted small">일치율</span>
          </div>
        </div>
        <h2>{card.nickname}</h2>
        <p className="summary">{card.summary}</p>
        <div className="chips">
          {card.personalityTags.map((t) => <span key={t} className="tag accent">{t}</span>)}
          {card.toneTags.map((t) => <span key={t} className="tag">{t} 말투</span>)}
        </div>
        <h3>취미</h3>
        <div className="chips">
          {card.hobbies.map((h) => <span key={h} className={`tag ${card.common.includes(h) ? "common" : ""}`}>{h}</span>)}
        </div>
        {card.interests.length > 0 && (
          <>
            <h3>관심사</h3>
            <div className="chips">
              {card.interests.map((h) => <span key={h} className={`tag ${card.common.includes(h) ? "common" : ""}`}>{h}</span>)}
            </div>
          </>
        )}
        {card.common.length > 0 && <p className="common-line">겹치는 키워드: {card.common.join(", ")}</p>}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="swipe-buttons">
        <button className="round no" onClick={() => void swipe("no")} aria-label="No">✕</button>
        <button className="round yes" onClick={() => void swipe("yes")} aria-label="Yes">♥</button>
      </div>
      <p className="muted small center-text">남은 추천 {cards.length}명</p>
    </div>
  );
}
