import { PERSONALITY_TAGS } from "./persona.js";

// docs/signup-questions.md v0.1 의 질문 Q1~Q12.

export interface ChoiceGroup {
  key: string;
  label?: string;
  multi: boolean;
  max?: number;
  options: string[];
}

export interface Question {
  id: string;
  section: "취미·관심사" | "성격" | "말투" | "대화·관계 성향";
  title: string;
  required: boolean;
  choiceGroups: ChoiceGroup[];
  /** 자유 입력. textRequired면 비었을 때 꼬리 질문 대상 */
  text: { placeholder: string; textRequired: boolean; chatBubble?: boolean } | null;
  followups: string[];
  /** full: 길이·명사·모호함 모두 검사 / length: 길이만 검사 (말투 예시처럼 명사가 없어도 되는 답) */
  followupCheck?: "full" | "length";
  fields: string[];
}

export interface Answer {
  questionId: string;
  choices: Record<string, string[]>;
  text: string;
  followups: { question: string; answer: string }[];
}

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    section: "취미·관심사",
    title: "요즘 시간 가장 많이 쓰는 취미는 뭐예요?",
    required: true,
    choiceGroups: [
      {
        key: "hobby",
        multi: true,
        options: ["영화·드라마", "음악·공연", "운동", "여행", "게임", "독서", "요리·맛집", "전시·사진", "기타"],
      },
    ],
    text: { placeholder: "구체적으로 알려 주세요. 예: SF 영화를 극장에서 혼자 봐요", textRequired: true },
    followups: [
      "그 취미에서 제일 좋아하는 게 뭐예요? (장르, 장소, 최근에 한 것 등)",
      "얼마나 자주 해요?",
    ],
    fields: ["hobbies", "match_keywords"],
  },
  {
    id: "q2",
    section: "취미·관심사",
    title: "최근에 새로 빠진 게 있다면요?",
    required: true,
    choiceGroups: [],
    text: { placeholder: "작은 것도 좋아요. 예: 요즘 보드게임에 빠졌어요", textRequired: true },
    followups: ["어쩌다 빠지게 됐어요?"],
    fields: ["hobbies", "interests", "match_keywords"],
  },
  {
    id: "q3",
    section: "취미·관심사",
    title: "쉬는 날 하루를 마음대로 쓸 수 있다면 어떻게 보내고 싶어요?",
    required: true,
    choiceGroups: [],
    text: { placeholder: "예: 늦잠 자고 동네 카페에서 책 읽다가 저녁엔 산책", textRequired: true },
    followups: ["그날 누구랑, 어디서 보내고 싶어요?"],
    fields: ["interests", "relationship.date_style", "personality"],
  },
  {
    id: "q4",
    section: "성격",
    title: "친한 친구들은 나를 어떤 사람이라고 해요?",
    required: true,
    choiceGroups: [{ key: "personality", label: "최대 3개", multi: true, max: 3, options: PERSONALITY_TAGS }],
    text: { placeholder: "친구가 실제로 했던 말이 있다면 적어 주세요", textRequired: true },
    followups: ["그런 말을 듣게 된 일이 있었어요?"],
    fields: ["personality.tags", "personality.summary"],
  },
  {
    id: "q5",
    section: "성격",
    title: "처음 만난 사람과 대화할 때 나는 어떤 편이에요?",
    required: true,
    choiceGroups: [
      {
        key: "approach",
        multi: false,
        options: ["먼저 말을 거는 편", "상대가 말을 걸면 잘 받는 편", "시간이 좀 필요한 편"],
      },
    ],
    text: { placeholder: "(선택) 더 하고 싶은 말이 있다면", textRequired: false },
    followups: [],
    fields: ["personality.tags", "conversation.pace"],
  },
  {
    id: "q6",
    section: "성격",
    title: "스트레스 받거나 지칠 때는 주로 어떻게 풀어요?",
    required: true,
    choiceGroups: [],
    text: { placeholder: "예: 혼자 한강 따라 걷거나 매운 걸 먹어요", textRequired: true },
    followups: ["그러고 나면 기분이 어때요?"],
    fields: ["personality.summary", "hobbies"],
  },
  {
    id: "q7",
    followupCheck: "length",
    section: "말투",
    title: "친한 친구에게 주말 약속을 잡는 메시지를 평소처럼 써 주세요.",
    required: true,
    choiceGroups: [],
    text: { placeholder: "평소 말투 그대로 써 주세요", textRequired: true, chatBubble: true },
    followups: ["친구가 '좋아! 뭐 할까?'라고 답했어요. 이어서 뭐라고 보낼래요?"],
    fields: ["speech_style.sample_messages", "speech_style.tone_tags", "speech_style.message_length", "speech_style.habits"],
  },
  {
    id: "q8",
    followupCheck: "length",
    section: "말투",
    title: "소개팅 앱에서 처음 대화하는 상대가 \"오늘 뭐 하셨어요?\"라고 물었어요. 어떻게 답할래요?",
    required: true,
    choiceGroups: [],
    text: { placeholder: "실제로 보낼 메시지처럼 써 주세요", textRequired: true, chatBubble: true },
    followups: [],
    fields: ["speech_style.sample_messages", "speech_style.formality"],
  },
  {
    id: "q9",
    section: "말투",
    title: "처음 대화하는 상대와는 어떤 말투가 편해요? 이모티콘은요?",
    required: true,
    choiceGroups: [
      { key: "formality", label: "말투", multi: false, options: ["존댓말", "반말", "상대에 맞춰서"] },
      { key: "emoji", label: "이모티콘", multi: false, options: ["거의 안 씀", "가끔 씀", "자주 씀"] },
    ],
    text: null,
    followups: [],
    fields: ["speech_style.formality", "speech_style.emoji_usage"],
  },
  {
    id: "q10",
    section: "대화·관계 성향",
    title: "어떤 대화를 할 때 시간 가는 줄 몰라요?",
    required: true,
    choiceGroups: [],
    text: { placeholder: "예: 좋아하는 영화 얘기, 서로 요즘 빠진 것 공유하기", textRequired: true },
    followups: ["반대로 금방 지루해지는 대화는요?"],
    fields: ["conversation.likes"],
  },
  {
    id: "q11",
    section: "대화·관계 성향",
    title: "처음 알아가는 사이에서는 피하고 싶은 주제가 있어요?",
    required: false,
    choiceGroups: [
      { key: "avoid", multi: true, options: ["정치", "종교", "연애 경험", "직장·학교", "외모", "없음"] },
    ],
    text: { placeholder: "(선택) 그 밖에 피하고 싶은 주제", textRequired: false },
    followups: [],
    fields: ["conversation.avoid"],
  },
  {
    id: "q12",
    section: "대화·관계 성향",
    title: "마음이 맞는 사람을 만나면 어떤 만남을 해 보고 싶어요?",
    required: false,
    choiceGroups: [
      { key: "date", multi: true, options: ["카페", "맛집", "산책", "전시·공연", "운동 같이 하기", "영화", "기타"] },
    ],
    text: { placeholder: "(선택) 관계에서 중요하게 생각하는 것이 있다면 같이 적어 주세요", textRequired: false },
    followups: [],
    fields: ["relationship.date_style", "relationship.values"],
  },
];

export const MAX_FOLLOWUPS_PER_QUESTION = 2;

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
