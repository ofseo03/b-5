import { z } from "zod";

// docs/persona-format.md v0.1 의 고정 형식.
// LLM이 채우는 부분(PersonaContent)과 시스템이 채우는 부분(profile, match_keywords, meta)을 나눈다.

export const FORMALITY = ["존댓말", "반말", "상대따라"] as const;
export const MESSAGE_LENGTH = ["짧게", "보통", "길게"] as const;
export const EMOJI_USAGE = ["안씀", "가끔", "자주"] as const;
export const HOBBY_LEVEL = ["가볍게", "꾸준히", "깊게"] as const;
export const PACE = ["천천히 알아가기", "빠르게 친해지기"] as const;

// 구조화 출력용 스키마. 길이 제한은 스키마 대신 clampContent()에서 맞춘다.
export const PersonaContentSchema = z.object({
  personality: z.object({
    tags: z.array(z.string()),
    summary: z.string(),
  }),
  speech_style: z.object({
    formality: z.enum(FORMALITY),
    tone_tags: z.array(z.string()),
    message_length: z.enum(MESSAGE_LENGTH),
    emoji_usage: z.enum(EMOJI_USAGE),
    habits: z.array(z.string()),
    sample_messages: z.array(z.string()),
  }),
  hobbies: z.array(
    z.object({
      name: z.string(),
      detail: z.string().nullable(),
      level: z.enum(HOBBY_LEVEL).nullable(),
    }),
  ),
  interests: z.array(z.string()),
  conversation: z.object({
    likes: z.array(z.string()),
    avoid: z.array(z.string()),
    pace: z.enum(PACE).nullable(),
  }),
  relationship: z.object({
    date_style: z.array(z.string()),
    values: z.array(z.string()),
  }),
  extra_keywords: z.array(z.string()),
  missing_fields: z.array(z.string()),
});

export type PersonaContent = z.infer<typeof PersonaContentSchema>;

export interface Persona extends Omit<PersonaContent, "extra_keywords" | "missing_fields"> {
  schema_version: "0.1";
  profile: { nickname: string; avatar_id: string };
  match_keywords: string[];
  meta: { source_answer_ids: string[]; created_at: string; missing_fields: string[] };
}

export const PERSONALITY_TAGS = [
  "차분한", "활발한", "호기심많은", "다정한", "솔직한", "유머있는", "신중한", "즉흥적인",
  "계획적인", "낯가리는", "사교적인", "배려심있는", "독립적인", "감성적인", "이성적인", "긍정적인",
];
export const TONE_TAGS = [
  "차분한", "장난스러운", "친근한", "정중한", "간결한", "수다스러운", "다정한", "직설적인", "리액션많은", "진지한",
];
export const HOBBY_TAGS = [
  "영화", "드라마", "음악", "공연", "전시", "독서", "게임", "운동", "러닝", "등산", "여행", "캠핑",
  "요리", "카페", "맛집", "사진", "그림", "반려동물", "개발", "글쓰기", "패션", "춤", "악기", "봉사",
];

const take = <T>(arr: T[], max: number) => arr.slice(0, max);
const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
const uniq = (arr: string[]) => [...new Set(arr.map((s) => s.trim()).filter(Boolean))];

/** 형식의 개수·길이 제한을 맞춘다 (LLM 출력이든 mock 출력이든 저장 전에 거친다). */
export function clampContent(c: PersonaContent): PersonaContent {
  return {
    personality: { tags: take(uniq(c.personality.tags), 5), summary: cut(c.personality.summary, 80) },
    speech_style: {
      ...c.speech_style,
      tone_tags: take(uniq(c.speech_style.tone_tags), 4),
      habits: take(uniq(c.speech_style.habits), 3),
      sample_messages: take(c.speech_style.sample_messages.filter(Boolean), 3).map((m) => scrubPii(m)),
    },
    hobbies: take(c.hobbies, 5).map((h) => ({ ...h, detail: h.detail ? cut(scrubPii(h.detail), 60) : null })),
    interests: take(uniq(c.interests), 8),
    conversation: {
      likes: take(uniq(c.conversation.likes), 4),
      avoid: take(uniq(c.conversation.avoid), 4),
      pace: c.conversation.pace,
    },
    relationship: {
      date_style: take(uniq(c.relationship.date_style), 3),
      values: take(uniq(c.relationship.values), 3),
    },
    extra_keywords: uniq(c.extra_keywords),
    missing_fields: uniq(c.missing_fields),
  };
}

const PII_PATTERNS: RegExp[] = [
  /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, // 휴대전화
  /[\w.+-]+@[\w-]+\.[\w.]+/g, // 이메일
  /https?:\/\/\S+/g, // URL
  /@[A-Za-z0-9_.]{3,}/g, // SNS 아이디
];

export function containsPii(text: string): boolean {
  return PII_PATTERNS.some((re) => new RegExp(re.source).test(text));
}

export function scrubPii(text: string): string {
  return PII_PATTERNS.reduce((t, re) => t.replace(re, "(비공개)"), text);
}
