import { useEffect, useState } from "react";
import { api } from "../api";
import { go } from "../router";
import type { Notification } from "../types";
import { clock } from "../util";

export function Notifications() {
  const [list, setList] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () =>
      api<{ notifications: Notification[]; unread: number }>("/notifications").then((d) => {
        setList(d.notifications);
        setUnread(d.unread);
      });
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      await api("/notifications/read", { body: {} });
      setUnread(0);
    }
  }

  return (
    <div className="notif">
      <button className="icon-btn" onClick={() => void toggle()} aria-label="알림">
        🔔{unread > 0 && <span className="dot">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          {list.length === 0 && <p className="muted small">알림이 없어요.</p>}
          {list.map((n) => (
            <button
              key={n.id}
              className={`notif-item ${n.read ? "" : "unread"}`}
              onClick={() => {
                setOpen(false);
                if (n.roomId) go({ name: "room", id: n.roomId });
              }}
            >
              <span>{n.text}</span>
              <span className="time">{clock(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
