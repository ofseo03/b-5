import { api } from "../api";
import { useConfig } from "../config";
import { PersonaView } from "../components/PersonaView";
import type { User } from "../types";

export function MyPersona({ me, onChange }: { me: User; onChange: (u: User) => void }) {
  const { avatars } = useConfig();

  async function setAvatar(avatarId: string) {
    const d = await api<{ user: User }>("/me", { method: "PATCH", body: { avatarId } });
    onChange(d.user);
  }

  return (
    <div className="page">
      <h2 className="section-title">캐릭터 바꾸기</h2>
      <div className="avatar-grid">
        {avatars.map((a) => (
          <button key={a.id} className={a.id === me.avatarId ? "selected" : ""} onClick={() => void setAvatar(a.id)} title={a.name}>
            {a.emoji}
          </button>
        ))}
      </div>
      <h2 className="section-title">내 페르소나</h2>
      <p className="muted small">다른 사람은 이 페르소나와 먼저 대화해요. 페르소나 업데이트는 다음 단계 기능이에요.</p>
      <PersonaView persona={me.persona} />
    </div>
  );
}
