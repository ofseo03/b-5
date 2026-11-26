import { useEffect, useState } from "react";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import type { UserSummary } from "../types";

// 로컬 시연용: 로그인 대신 사용자를 골라서 들어간다. 양쪽 입장을 번갈아 시험해 볼 수 있다.
export function Login({ onPick, onSignup }: { onPick: (id: string) => void; onSignup: () => void }) {
  const [users, setUsers] = useState<UserSummary[] | null>(null);

  useEffect(() => {
    api<{ users: UserSummary[] }>("/users").then((d) => setUsers(d.users));
  }, []);

  const mine = users?.filter((u) => !u.isDemo) ?? [];
  const demo = users?.filter((u) => u.isDemo) ?? [];

  return (
    <div className="page login">
      <h1 className="brand">페르소나 소개팅</h1>
      <p className="muted">AI 페르소나와 먼저 대화해 보고, 마음에 들면 실제 사람과 이어서 대화해요.</p>
      <button className="btn primary block" onClick={onSignup}>새로 가입하기</button>

      {mine.length > 0 && (
        <>
          <h2 className="section-title">가입한 사용자</h2>
          <UserList users={mine} onPick={onPick} />
        </>
      )}
      <h2 className="section-title">데모 사용자로 들어가기</h2>
      {users === null ? <p className="muted">불러오는 중…</p> : <UserList users={demo} onPick={onPick} />}
      <p className="hint">로컬 시연용 화면이에요. 실제 앱의 로그인 대신 사용자를 골라 양쪽 입장을 번갈아 볼 수 있어요.</p>
    </div>
  );
}

function UserList({ users, onPick }: { users: UserSummary[]; onPick: (id: string) => void }) {
  return (
    <ul className="user-list">
      {users.map((u) => (
        <li key={u.id}>
          <button onClick={() => onPick(u.id)}>
            <Avatar id={u.avatarId} size={36} />
            <span>{u.nickname}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
