import { db, newId, now, save } from "./db.js";
import { clampContent, type Persona, type PersonaContent } from "./persona.js";
import { canonical } from "./keywords.js";

// 혼자서도 매칭·채팅을 시험해 볼 수 있도록 데모 사용자를 만든다.

interface Seed {
  nickname: string;
  avatarId: string;
  content: PersonaContent;
}

const SEEDS: Seed[] = [
  {
    nickname: "주말의여우",
    avatarId: "fox",
    content: {
      personality: { tags: ["차분한", "호기심많은", "낯가리는"], summary: "처음엔 조용하지만 관심 있는 주제가 나오면 질문이 많아지는 편이다." },
      speech_style: {
        formality: "상대따라", tone_tags: ["친근한", "리액션많은"], message_length: "보통", emoji_usage: "가끔",
        habits: ["ㅋㅋ 자주 씀", "질문으로 대화를 이어감"],
        sample_messages: ["이번 주말에 시간 되면 같이 전시 보러 갈래요? 저 보고 싶은 거 생겼어요 ㅋㅋ"],
      },
      hobbies: [
        { name: "영화", detail: "SF 영화를 좋아하고 극장에서 혼자 보는 편", level: "꾸준히" },
        { name: "러닝", detail: "주 2~3회 동네를 가볍게 뜀", level: "가볍게" },
      ],
      interests: ["우주", "보드게임", "카페"],
      conversation: { likes: ["좋아하는 영화 이야기", "요즘 빠진 것 공유"], avoid: ["정치"], pace: "천천히 알아가기" },
      relationship: { date_style: ["전시", "산책"], values: ["취미 공유"] },
      extra_keywords: ["SF", "극장", "전시", "산책"],
      missing_fields: [],
    },
  },
  {
    nickname: "산책하는곰",
    avatarId: "bear",
    content: {
      personality: { tags: ["다정한", "긍정적인", "배려심있는"], summary: "느긋하고 다정해서 상대 이야기를 잘 들어 주는 편이다." },
      speech_style: {
        formality: "존댓말", tone_tags: ["다정한", "차분한"], message_length: "보통", emoji_usage: "자주",
        habits: ["~요 로 부드럽게 끝냄"],
        sample_messages: ["오늘은 날씨가 좋아서 강아지랑 오래 산책했어요 😊 하루 어떻게 보내셨어요?"],
      },
      hobbies: [
        { name: "반려동물", detail: "강아지와 매일 산책함", level: "깊게" },
        { name: "요리", detail: "주말에 브런치 만들어 먹는 걸 좋아함", level: "꾸준히" },
      ],
      interests: ["강아지", "베이킹", "식물"],
      conversation: { likes: ["소소한 일상 이야기", "맛있는 음식 이야기"], avoid: ["외모"], pace: "천천히 알아가기" },
      relationship: { date_style: ["산책", "맛집"], values: ["연락 빈도"] },
      extra_keywords: ["산책", "브런치", "맛집"],
      missing_fields: [],
    },
  },
  {
    nickname: "새벽코딩냥",
    avatarId: "cat",
    content: {
      personality: { tags: ["이성적인", "독립적인", "유머있는"], summary: "논리적이지만 농담을 좋아해서 대화에 드립이 섞인다." },
      speech_style: {
        formality: "반말", tone_tags: ["장난스러운", "간결한"], message_length: "짧게", emoji_usage: "안씀",
        habits: ["ㅋㅋㅋ 많이 씀", "짧게 끊어서 보냄"],
        sample_messages: ["토욜에 보드게임 카페 ㄱ? 새로 나온 거 해보고 싶음 ㅋㅋ"],
      },
      hobbies: [
        { name: "개발", detail: "사이드 프로젝트로 게임을 만들어 봄", level: "깊게" },
        { name: "게임", detail: "인디 게임과 보드게임을 좋아함", level: "꾸준히" },
      ],
      interests: ["보드게임", "SF", "우주"],
      conversation: { likes: ["이상한 상상 이야기", "게임 추천"], avoid: ["직장·학교"], pace: "빠르게 친해지기" },
      relationship: { date_style: ["카페", "방탈출"], values: ["취미 공유"] },
      extra_keywords: ["보드게임", "방탈출", "SF"],
      missing_fields: [],
    },
  },
  {
    nickname: "바다토끼",
    avatarId: "rabbit",
    content: {
      personality: { tags: ["활발한", "즉흥적인", "사교적인"], summary: "에너지가 넘치고 계획보다 즉흥 여행을 더 좋아한다." },
      speech_style: {
        formality: "상대따라", tone_tags: ["수다스러운", "리액션많은"], message_length: "길게", emoji_usage: "자주",
        habits: ["!! 를 많이 씀"],
        sample_messages: ["헐 이번 주말에 바다 보러 갈래?! 갑자기 너무 가고 싶어졌어 🌊🌊"],
      },
      hobbies: [
        { name: "여행", detail: "국내 바다 여행을 자주 감", level: "꾸준히" },
        { name: "사진", detail: "필름카메라로 여행 사진을 찍음", level: "가볍게" },
      ],
      interests: ["바다", "서핑", "페스티벌"],
      conversation: { likes: ["여행 이야기", "가 보고 싶은 곳"], avoid: [], pace: "빠르게 친해지기" },
      relationship: { date_style: ["드라이브", "맛집"], values: ["함께하는 경험"] },
      extra_keywords: ["필름카메라", "드라이브"],
      missing_fields: [],
    },
  },
  {
    nickname: "책읽는부엉이",
    avatarId: "owl",
    content: {
      personality: { tags: ["신중한", "감성적인", "차분한"], summary: "말수는 적지만 깊이 있는 대화를 좋아한다." },
      speech_style: {
        formality: "존댓말", tone_tags: ["정중한", "진지한"], message_length: "길게", emoji_usage: "안씀",
        habits: ["문장을 끝까지 정성껏 씀"],
        sample_messages: ["오늘은 퇴근하고 카페에서 소설을 조금 읽었습니다. 요즘 읽는 책이 생각보다 여운이 길어서요."],
      },
      hobbies: [
        { name: "독서", detail: "소설과 에세이를 주로 읽음", level: "깊게" },
        { name: "카페", detail: "조용한 동네 카페 찾기", level: "꾸준히" },
      ],
      interests: ["철학", "글쓰기", "전시"],
      conversation: { likes: ["책 이야기", "생각을 나누는 대화"], avoid: ["정치", "종교"], pace: "천천히 알아가기" },
      relationship: { date_style: ["카페", "전시"], values: ["대화가 잘 통하는 것"] },
      extra_keywords: ["소설", "에세이", "전시"],
      missing_fields: [],
    },
  },
  {
    nickname: "등산하는판다",
    avatarId: "panda",
    content: {
      personality: { tags: ["솔직한", "계획적인", "긍정적인"], summary: "계획을 세워 꾸준히 하는 걸 좋아하고 솔직하게 말하는 편이다." },
      speech_style: {
        formality: "존댓말", tone_tags: ["친근한", "직설적인"], message_length: "보통", emoji_usage: "가끔",
        habits: ["ㅎㅎ 를 자주 씀"],
        sample_messages: ["오늘은 아침에 북한산 다녀왔어요 ㅎㅎ 다리는 아픈데 기분은 좋네요!"],
      },
      hobbies: [
        { name: "등산", detail: "주말마다 근교 산에 감", level: "꾸준히" },
        { name: "운동", detail: "평일엔 헬스장에서 운동", level: "꾸준히" },
      ],
      interests: ["캠핑", "맛집", "러닝"],
      conversation: { likes: ["운동 이야기", "주말 계획"], avoid: ["연애 경험"], pace: "빠르게 친해지기" },
      relationship: { date_style: ["등산", "맛집"], values: ["건강한 생활"] },
      extra_keywords: ["캠핑"],
      missing_fields: [],
    },
  },
  {
    nickname: "피아노치는펭귄",
    avatarId: "penguin",
    content: {
      personality: { tags: ["감성적인", "다정한", "낯가리는"], summary: "음악을 좋아하고 감정 표현이 섬세한 편이다." },
      speech_style: {
        formality: "존댓말", tone_tags: ["다정한", "차분한"], message_length: "보통", emoji_usage: "가끔",
        habits: ["말끝에 ~ 를 붙임"],
        sample_messages: ["주말에 시간 괜찮으면 공연 보러 갈래요~ 좋아하는 밴드가 와요!"],
      },
      hobbies: [
        { name: "악기", detail: "피아노를 10년 넘게 침", level: "깊게" },
        { name: "공연", detail: "인디 밴드 공연을 자주 봄", level: "꾸준히" },
      ],
      interests: ["음악", "영화", "카페"],
      conversation: { likes: ["좋아하는 노래 공유", "공연 후기"], avoid: ["외모"], pace: "천천히 알아가기" },
      relationship: { date_style: ["공연", "카페"], values: ["취향 존중"] },
      extra_keywords: ["피아노", "밴드"],
      missing_fields: [],
    },
  },
  {
    nickname: "맛집탐험사자",
    avatarId: "lion",
    content: {
      personality: { tags: ["사교적인", "유머있는", "활발한"], summary: "사람 만나는 걸 좋아하고 분위기를 잘 띄운다." },
      speech_style: {
        formality: "반말", tone_tags: ["장난스러운", "친근한"], message_length: "보통", emoji_usage: "가끔",
        habits: ["ㅋㅋ 자주 씀", "감탄사가 많음"],
        sample_messages: ["야 이번 주 토요일 새로 생긴 라멘집 ㄱㄱ? 웨이팅 각오하고 ㅋㅋ"],
      },
      hobbies: [
        { name: "맛집", detail: "새로 생긴 식당 찾아다니기", level: "깊게" },
        { name: "요리", detail: "가끔 집에서 파스타를 만듦", level: "가볍게" },
      ],
      interests: ["와인", "여행", "디저트"],
      conversation: { likes: ["음식 이야기", "웃긴 에피소드"], avoid: [], pace: "빠르게 친해지기" },
      relationship: { date_style: ["맛집", "카페"], values: ["함께 웃는 것"] },
      extra_keywords: ["라멘", "파스타"],
      missing_fields: [],
    },
  },
];

export function buildMatchKeywords(content: PersonaContent, extracted: string[] = []): string[] {
  const words = [
    ...extracted,
    ...content.hobbies.map((h) => h.name),
    ...content.interests,
    ...content.relationship.date_style,
    ...content.extra_keywords,
  ];
  return [...new Set(words.flatMap((w) => w.split("·")).map((w) => canonical(w.trim())).filter((w) => w.length >= 1))];
}

export function seedIfEmpty(): void {
  if (db.users.length > 0) return;
  for (const s of SEEDS) {
    const content = clampContent(s.content);
    const { extra_keywords: _extra, missing_fields, ...rest } = content;
    const persona: Persona = {
      schema_version: "0.1",
      profile: { nickname: s.nickname, avatar_id: s.avatarId },
      ...rest,
      match_keywords: buildMatchKeywords(content),
      meta: { source_answer_ids: [], created_at: now(), missing_fields },
    };
    db.users.push({
      id: newId("u"),
      nickname: s.nickname,
      avatarId: s.avatarId,
      isDemo: true,
      createdAt: now(),
      answers: [],
      persona,
    });
  }
  save();
  console.log(`[seed] 데모 사용자 ${SEEDS.length}명 생성`);
}
