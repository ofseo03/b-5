import type { Persona } from "./persona.js";

export interface MatchResult {
  rate: number; // 0~100
  common: string[];
}

/**
 * 일치율: 두 사람 키워드의 겹침 계수 |A∩B| / min(|A|,|B|) 에
 * 성격 태그가 겹치면 약간 가산한다. 표시 범위(60~100%)는 회의에서 "계산해 본 뒤 결정"이라 원값을 그대로 보여 준다.
 */
export function matchPersonas(a: Persona, b: Persona): MatchResult {
  const A = new Set(a.match_keywords);
  const B = new Set(b.match_keywords);
  const common = [...A].filter((k) => B.has(k));
  const base = A.size && B.size ? common.length / Math.min(A.size, B.size) : 0;

  const tagsA = new Set(a.personality.tags);
  const sharedTags = b.personality.tags.filter((t) => tagsA.has(t)).length;
  const bonus = Math.min(sharedTags * 0.05, 0.1);

  return { rate: Math.round(Math.min(base * 0.9 + bonus, 1) * 100), common };
}
