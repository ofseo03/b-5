export function timeLeft(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return "마감";
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `${min}분 남음`;
  const h = Math.floor(min / 60);
  return `${h}시간 ${min % 60}분 남음`;
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
