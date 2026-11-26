export interface Avatar { id: string; emoji: string; name: string }

export interface AppConfig {
  llmProvider: string;
  personaTurnLimit: number;
  decisionWindowMinutes: number;
  reminderBeforeMinutes: number;
  maxPersonaRooms: number;
  avatars: Avatar[];
}

export interface ChoiceGroup { key: string; label?: string; multi: boolean; max?: number; options: string[] }

export interface Question {
  id: string;
  section: string;
  title: string;
  required: boolean;
  choiceGroups: ChoiceGroup[];
  text: { placeholder: string; textRequired: boolean; chatBubble?: boolean } | null;
  followups: string[];
}

export interface Answer {
  questionId: string;
  choices: Record<string, string[]>;
  text: string;
  followups: { question: string; answer: string }[];
}

export interface Persona {
  schema_version: string;
  profile: { nickname: string; avatar_id: string };
  personality: { tags: string[]; summary: string };
  speech_style: {
    formality: string; tone_tags: string[]; message_length: string; emoji_usage: string;
    habits: string[]; sample_messages: string[];
  };
  hobbies: { name: string; detail: string | null; level: string | null }[];
  interests: string[];
  conversation: { likes: string[]; avoid: string[]; pace: string | null };
  relationship: { date_style: string[]; values: string[] };
  match_keywords: string[];
  meta: { source_answer_ids: string[]; created_at: string; missing_fields: string[] };
}

export interface User {
  id: string; nickname: string; avatarId: string; isDemo: boolean; createdAt: string; persona: Persona;
}

export interface UserSummary { id: string; nickname: string; avatarId: string; isDemo?: boolean }

export interface Card {
  userId: string; nickname: string; avatarId: string; matchRate: number; common: string[];
  personalityTags: string[]; summary: string; hobbies: string[]; interests: string[]; toneTags: string[];
}

export interface Room {
  id: string;
  role: "owner" | "target";
  mode: "persona" | "human" | "closed";
  decision: "connect" | "pass" | "auto_pass" | null;
  personaTurns: number;
  personaTurnLimit: number;
  decisionDeadline: string;
  connectedAt: string | null;
  createdAt: string;
  owner: UserSummary;
  target: UserSummary;
  partner: UserSummary;
  lastMessage: { text: string; kind: string; createdAt: string } | null;
  canSend: boolean;
  canDecide: boolean;
}

export interface Message {
  id: string; roomId: string; phase: "persona" | "human"; kind: "user" | "persona"; senderId: string; text: string; createdAt: string;
}

export interface Notification {
  id: string; type: string; roomId: string | null; text: string; createdAt: string; read: boolean;
}
