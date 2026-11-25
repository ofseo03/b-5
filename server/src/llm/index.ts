import { config } from "../config.js";
import { anthropicProvider } from "./anthropic.js";
import { mockProvider } from "./mock.js";
import type { LlmProvider } from "./types.js";

const primary: LlmProvider = config.llmProvider === "anthropic" ? anthropicProvider : mockProvider;

/** 실제 LLM 호출이 실패하면 로그를 남기고 mock 결과로 대신한다 (로컬 시연이 멈추지 않도록). */
async function withFallback<K extends keyof LlmProvider>(
  method: K,
  ...args: LlmProvider[K] extends (...a: infer A) => unknown ? A : never
): Promise<Awaited<ReturnType<Extract<LlmProvider[K], (...a: never[]) => unknown>>>> {
  const call = (p: LlmProvider) => (p[method] as (...a: unknown[]) => Promise<never>)(...args);
  if (primary === mockProvider) return call(mockProvider);
  try {
    return await call(primary);
  } catch (err) {
    console.warn(`[llm] ${primary.name}.${String(method)} 실패 → mock 사용:`, err instanceof Error ? err.message : err);
    return call(mockProvider);
  }
}

export const llm = {
  name: primary.name,
  generatePersona: (...a: Parameters<LlmProvider["generatePersona"]>) => withFallback("generatePersona", ...a),
  personaReply: (...a: Parameters<LlmProvider["personaReply"]>) => withFallback("personaReply", ...a),
  followupQuestion: (...a: Parameters<LlmProvider["followupQuestion"]>) => withFallback("followupQuestion", ...a),
};
