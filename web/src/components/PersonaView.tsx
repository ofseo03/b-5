import { useState } from "react";
import type { Persona } from "../types";
import { Avatar } from "./Avatar";

const Tags = ({ items, accent }: { items: string[]; accent?: boolean }) =>
  items.length ? (
    <div className="chips">
      {items.map((t) => (
        <span key={t} className={`tag ${accent ? "accent" : ""}`}>{t}</span>
      ))}
    </div>
  ) : (
    <span className="muted small">없음</span>
  );

export function PersonaView({ persona }: { persona: Persona }) {
  const [raw, setRaw] = useState(false);
  const s = persona.speech_style;
  return (
    <div className="persona-card">
      <div className="persona-head">
        <Avatar id={persona.profile.avatar_id} size={56} />
        <div>
          <strong>{persona.profile.nickname}</strong>
          <p className="muted small">{persona.personality.summary}</p>
        </div>
      </div>

      <dl>
        <dt>성격</dt>
        <dd><Tags items={persona.personality.tags} accent /></dd>
        <dt>말투</dt>
        <dd>
          <Tags items={[s.formality, ...s.tone_tags, `메시지 ${s.message_length}`, `이모티콘 ${s.emoji_usage}`]} />
          {s.habits.length > 0 && <p className="small">말버릇: {s.habits.join(", ")}</p>}
          {s.sample_messages.map((m, i) => (
            <p key={i} className="sample">“{m}”</p>
          ))}
        </dd>
        <dt>취미</dt>
        <dd>
          {persona.hobbies.length ? (
            <ul className="plain">
              {persona.hobbies.map((h) => (
                <li key={h.name}>
                  <span className="tag accent">{h.name}</span>
                  {h.level && <span className="muted small"> {h.level}</span>}
                  {h.detail && <span className="small"> — {h.detail}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <span className="muted small">없음</span>
          )}
        </dd>
        <dt>관심사</dt>
        <dd><Tags items={persona.interests} /></dd>
        <dt>즐거운 대화</dt>
        <dd><Tags items={persona.conversation.likes} /></dd>
        <dt>피하고 싶은 주제</dt>
        <dd><Tags items={persona.conversation.avoid} /></dd>
        <dt>대화 속도</dt>
        <dd>{persona.conversation.pace ?? <span className="muted small">없음</span>}</dd>
        <dt>만남 형태</dt>
        <dd><Tags items={persona.relationship.date_style} /></dd>
        <dt>일치율 키워드</dt>
        <dd><Tags items={persona.match_keywords} /></dd>
        {persona.meta.missing_fields.length > 0 && (
          <>
            <dt>정보 부족</dt>
            <dd className="small muted">{persona.meta.missing_fields.join(", ")}</dd>
          </>
        )}
      </dl>
      <button className="link small" onClick={() => setRaw((v) => !v)}>{raw ? "JSON 닫기" : "JSON 보기"}</button>
      {raw && <pre className="json">{JSON.stringify(persona, null, 2)}</pre>}
    </div>
  );
}
