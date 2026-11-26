function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num("PORT", 4000),
  llmProvider: (process.env.LLM_PROVIDER ?? "mock") as "mock" | "anthropic",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  decisionWindowMs: num("DECISION_WINDOW_MINUTES", 24 * 60) * 60_000,
  reminderBeforeMs: num("REMINDER_BEFORE_MINUTES", 60) * 60_000,
  personaTurnLimit: num("PERSONA_TURN_LIMIT", 5),
  maxPersonaRooms: num("MAX_PERSONA_ROOMS", 0),
};
