import { useEffect, useState } from "react";
import { api, ApiError, getUserId, setUserId } from "./api";
import { ConfigContext } from "./config";
import { Avatar } from "./components/Avatar";
import { Notifications } from "./components/Notifications";
import { ChatRoom } from "./pages/ChatRoom";
import { Chats } from "./pages/Chats";
import { Discover } from "./pages/Discover";
import { Login } from "./pages/Login";
import { MyPersona } from "./pages/MyPersona";
import { Signup } from "./pages/Signup";
import { go, useRoute } from "./router";
import type { AppConfig, User } from "./types";

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [mode, setMode] = useState<"loading" | "login" | "signup" | "app">("loading");
  const [error, setError] = useState<string | null>(null);
  const route = useRoute();

  useEffect(() => {
    api<AppConfig>("/config")
      .then(setConfig)
      .catch(() => setError("서버에 연결할 수 없어요. `npm run dev`로 서버가 켜져 있는지 확인해 주세요."));
  }, []);

  useEffect(() => {
    if (!config) return;
    if (!getUserId()) {
      setMode("login");
      return;
    }
    api<{ user: User }>("/me")
      .then((d) => {
        setMe(d.user);
        setMode("app");
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setUserId(null);
        setMode("login");
      });
  }, [config]);

  async function pick(id: string) {
    setUserId(id);
    const d = await api<{ user: User }>("/me");
    setMe(d.user);
    setMode("app");
    go({ name: "discover" });
  }

  function logout() {
    setUserId(null);
    setMe(null);
    setMode("login");
  }

  if (error) return <div className="shell"><div className="page center"><p className="error">{error}</p></div></div>;
  if (!config || mode === "loading") return <div className="shell"><div className="page center"><div className="spinner" /></div></div>;

  return (
    <ConfigContext.Provider value={config}>
      <div className="shell">
        {mode === "login" && <Login onPick={(id) => void pick(id)} onSignup={() => setMode("signup")} />}
        {mode === "signup" && (
          <Signup
            onCancel={() => setMode("login")}
            onDone={(u) => {
              setUserId(u.id);
              setMe(u);
              setMode("app");
              go({ name: "discover" });
            }}
          />
        )}
        {mode === "app" && me && (
          <>
            {route.name !== "room" && (
              <header className="top">
                <button className="me" onClick={() => go({ name: "persona" })}>
                  <Avatar id={me.avatarId} size={32} />
                  <span>{me.nickname}</span>
                </button>
                <div className="top-right">
                  <span className="llm-badge" title="LLM_PROVIDER">LLM: {config.llmProvider}</span>
                  <Notifications key={me.id} />
                  <button className="link small" onClick={logout}>사용자 바꾸기</button>
                </div>
              </header>
            )}
            <main className={route.name === "room" ? "main room" : "main"}>
              {route.name === "discover" && <Discover key={me.id} />}
              {route.name === "chats" && <Chats key={me.id} />}
              {route.name === "room" && <ChatRoom key={route.id + me.id} id={route.id} me={me} />}
              {route.name === "persona" && <MyPersona me={me} onChange={setMe} />}
            </main>
            {route.name !== "room" && (
              <nav className="tabs">
                <button className={route.name === "discover" ? "active" : ""} onClick={() => go({ name: "discover" })}>💘<span>추천</span></button>
                <button className={route.name === "chats" ? "active" : ""} onClick={() => go({ name: "chats" })}>💬<span>채팅</span></button>
                <button className={route.name === "persona" ? "active" : ""} onClick={() => go({ name: "persona" })}>🤖<span>내 페르소나</span></button>
              </nav>
            )}
          </>
        )}
      </div>
    </ConfigContext.Provider>
  );
}
