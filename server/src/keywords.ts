import { HOBBY_TAGS } from "./persona.js";
import type { Answer, Question } from "./questions.js";

// 회의안: "답변을 정규식 등으로 전처리해 명사만 뽑아 일치율 계산에 쓴다".
// 형태소 분석기 없이 사전 + 조사 제거 정규식으로 근사한다. (docs/signup-questions.md §5)

/** 동의어 → 대표어 */
const SYNONYMS: Record<string, string> = {
  영화관: "극장", 헬스: "운동", 헬스장: "운동", 런닝: "러닝", 조깅: "러닝", 달리기: "러닝",
  책: "독서", 커피: "카페", 하이킹: "등산", 전시회: "전시", 미술관: "전시", 박물관: "전시",
  콘서트: "공연", 뮤지컬: "공연", 연극: "공연", 노래: "음악", 사진찍기: "사진", 맛집탐방: "맛집",
  넷플: "넷플릭스", 겜: "게임", 애니메이션: "애니", 코딩: "개발", 프로그래밍: "개발",
};

/** 사전에 있는 단어는 조사가 붙어 있어도 그대로 뽑는다 (예: 고양이를 → 고양이) */
const DICTIONARY = new Set<string>([
  ...HOBBY_TAGS,
  ...Object.keys(SYNONYMS),
  "고양이", "강아지", "요가", "필라테스", "보드게임", "넷플릭스", "유튜브", "클라이밍", "수영", "테니스",
  "배드민턴", "축구", "야구", "농구", "자전거", "산책", "피아노", "베이킹", "와인", "맥주", "디저트",
  "낚시", "드라이브", "웹툰", "만화", "애니", "소설", "에세이", "우주", "역사", "철학", "심리학",
  "필름카메라", "뜨개질", "식물", "다이어리", "블로그", "바다", "노래방", "페스티벌", "극장", "SF",
  "브런치", "빵", "보드", "스키", "서핑", "골프", "볼링", "방탈출", "퍼즐", "향수", "인테리어",
]);

const PARTICLES = [
  "에서는", "에서도", "에는", "으로는", "한테서", "에게서", "이라도", "이라서", "이에요", "이랑", "예요", "이요",
  "처럼", "보다", "까지", "부터", "에서", "에게", "한테", "으로", "하고", "이나", "라도", "이고", "마다", "엔",
  "은", "는", "이", "가", "을", "를", "에", "도", "만", "랑", "와", "과", "의", "로",
];

/** '명사+하다' 활용 (산책하고 → 산책) */
const HADA = /^(.{2,}?)(하고|하는|하면|하기|하러|해요|해서|했어요|했고|했던|했는데|합니다|할|해|했다|한)$/;

/** 용언 어미로 끝나면 명사가 아니라고 본다 */
const PREDICATE_END = /(어요|아요|에요|여요|네요|죠|습니다|니다|는데|지만|니까|어서|아서|거든|잖아|고요|다|고|게|면|서|지|니|까|래|자|요|는|던|진|하|ㅋ+|ㅎ+)$/;

const STOPWORDS = new Set<string>([
  "것", "거", "때", "요즘", "그냥", "시간", "사람", "정도", "진짜", "너무", "정말", "조금", "많이", "자주",
  "가끔", "보통", "주로", "제일", "가장", "다음", "이번", "오늘", "내일", "주말", "하루", "우리", "친구",
  "같이", "혼자", "좋아", "싫어", "딱히", "아무거나", "근데", "그리고", "그래서", "어디", "누구", "언제",
  "생각", "느낌", "기분", "완전", "매일", "하나", "여러", "다른", "새로", "최근", "동네", "집", "밖",
  "얘기", "이야기", "대화", "아침", "점심", "저녁", "새벽", "편", "이것", "저것", "그것", "이것저것", "이것저것들", "이런저런", "뭔가", "아무", "전부", "모두", "모든", "보고", "먹고", "가서", "있어", "없어", "좋은", "좋고",
]);

const VAGUE = ["그냥", "딱히", "아무거나", "다 좋아요", "다좋아요", "잘 모르겠어요", "모르겠어요", "글쎄요", "글쎄", "없어요", "몰라요", "별로"];

function normalizeToken(token: string): string | null {
  if (/^[A-Za-z][A-Za-z0-9]+$/.test(token)) return token.length >= 2 ? token.toUpperCase() === token ? token : token.toLowerCase() : null;
  if (!/^[가-힣]+$/.test(token)) return null;

  // 1) 사전 단어로 시작하면 가장 긴 것을 채택
  let best = "";
  for (const word of DICTIONARY) {
    if (word.length > best.length && token.startsWith(word)) best = word;
  }
  if (best) return best;

  // 2) 명사+하다 활용이면 바로 명사 (좋아하는 → 좋아, 산책하는 → 산책)
  const direct = token.match(HADA);
  if (direct) return direct[1];

  // 3) 조사 제거
  let stem = token;
  for (const p of PARTICLES) {
    if (stem.endsWith(p) && stem.length - p.length >= 2) {
      stem = stem.slice(0, -p.length);
      break;
    }
  }

  // 4) 조사를 뗀 뒤 남은 명사+하다
  const hada = stem.match(HADA);
  if (hada) stem = hada[1];
  else if (PREDICATE_END.test(stem)) return null;

  return stem.length >= 2 ? stem : null;
}

export function canonical(word: string): string {
  return SYNONYMS[word] ?? word;
}

export function extractNouns(text: string): string[] {
  const tokens = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const n = normalizeToken(t);
    if (!n || STOPWORDS.has(n)) continue;
    const c = canonical(n);
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** 선택지 문구를 키워드로 ("영화·드라마" → 영화, 드라마). "기타", "없음" 제외 */
export function choiceKeywords(choice: string): string[] {
  return choice
    .split(/[·\/,]/)
    .map((s) => s.trim())
    .flatMap((s) => (DICTIONARY.has(s) || HOBBY_TAGS.includes(s) ? [canonical(s)] : extractNouns(s)))
    .filter((s) => s !== "기타" && s !== "없음");
}

export function isVague(text: string): boolean {
  const t = text.trim().replace(/[.!?~…ㅋㅎ\s]+$/u, "");
  if (!t) return true;
  return VAGUE.some((v) => t === v || t.replace(/\s/g, "") === v.replace(/\s/g, ""));
}

/** 꼬리 질문이 필요한가? 가장 최근 응답(처음 답 또는 마지막 꼬리 질문의 답)을 본다. */
export function needsFollowup(q: Question, latest: string, followupsSoFar: number, maxFollowups: number): boolean {
  if (!q.text?.textRequired) return false;
  if (followupsSoFar >= maxFollowups) return false;
  const text = latest.trim();
  if (text.length < 10) return true;
  if (q.followupCheck === "length") return false;
  return isVague(text) || extractNouns(text).length === 0;
}

/** 답변 전체에서 일치율용 키워드를 뽑는다 */
export function keywordsFromAnswers(answers: Answer[], questions: Question[]): string[] {
  const KEYWORD_QUESTIONS = new Set(["q1", "q2", "q3", "q6", "q10", "q12"]);
  const out = new Set<string>();
  for (const a of answers) {
    if (!KEYWORD_QUESTIONS.has(a.questionId)) continue;
    const q = questions.find((x) => x.id === a.questionId);
    if (!q) continue;
    for (const values of Object.values(a.choices)) values.flatMap(choiceKeywords).forEach((k) => out.add(k));
    // q12 자유 입력은 관계 가치관(예: "취향 존중")이라 일치율 키워드에서 뺀다
    if (a.questionId === "q12") continue;
    const texts = [a.text, ...a.followups.map((f) => f.answer)];
    texts.flatMap(extractNouns).forEach((k) => out.add(k));
  }
  return [...out];
}
