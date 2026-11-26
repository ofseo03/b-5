import { useConfig } from "../config";

export function Avatar({ id, size = 40 }: { id: string; size?: number }) {
  const { avatars } = useConfig();
  const a = avatars.find((x) => x.id === id);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.6 }} title={a?.name}>
      {a?.emoji ?? "🙂"}
    </span>
  );
}
