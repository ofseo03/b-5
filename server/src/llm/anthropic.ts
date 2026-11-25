import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "../config.js";
import { HOBBY_TAGS, PERSONALITY_TAGS, PersonaContentSchema, TONE_TAGS, type Persona } from "../persona.js";
import { formatAnswers, type LlmProvider } from "./types.js";

// Claude API 구현. LLM_PROVIDER=anthropic 일 때 쓴다.
// 거절(refusal) 시 서버 측 대체 모델로 이어서 답하도록 fallbacks: "default" 를 켜 둔다.

const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

const GENERATE_SYSTEM = `너는 소개팅 앱의 페르소나 작성기다. 사용자의 [가입 답변]만 근거로 정해진 형식의 JSON을 채운다.

규칙:
- 답변에 없는 사실은 지어내지 않는다. 근거가 없으면 빈 배열이나 null로 두고 missing_fields에 필드 이름을 적는다.
- 실명, 연락처, 학교·회사 이름, 주소 등 사람을 특정할 수 있는 정보는 넣지 않고 일반화한다 (예: "OO대 컴공" → "개발 공부").
- 태그는 아래 목록에서 먼저 고르고, 맞는 것이 없을 때만 2~6자 새 태그를 만든다.
  - 성격(personality.tags, 3~5개): ${PERSONALITY_TAGS.join(", ")}
  - 말투(speech_style.tone_tags, 2~4개): ${TONE_TAGS.join(", ")}
  - 취미(hobbies[].name, 1~5개): ${HOBBY_TAGS.join(", ")}
- personality.summary는 80자 이내 3인칭 한두 문장. hobbies[].detail은 60자 이내.
- speech_style.sample_messages는 사용자가 쓴 메시지 문장을 그대로 옮기되 개인정보만 지운다 (1~3개).
- formality와 emoji_usage는 q9 선택을 따른다 ("상대에 맞춰서" → "상대따라", "거의 안 씀" → "안씀", "가끔 씀" → "가끔", "자주 씀" → "자주").
- extra_keywords에는 일치율 계산에 쓸 만한 명사(취미의 세부 장르, 장소, 관심 대상)를 더한다.`;

function personaSystem(persona: Persona, partnerNickname: string): string {
  const { profile, ...rest } = persona;
  return `너는 소개팅 앱에서 "${profile.nickname}"님을 대신해 대화하는 AI 페르소나다. 지금 "${partnerNickname}"님과 처음 알아가는 대화를 하고 있다.

[페르소나]
${JSON.stringify({ ...rest, meta: undefined, match_keywords: undefined }, null, 2)}

대화 규칙:
- ${profile.nickname}님의 말투(speech_style)를 따른다. formality가 "상대따라"면 상대의 말투에 맞춘다. sample_messages의 길이와 분위기를 참고한다.
- 한국어로 1~3문장, 메신저처럼 짧게 답한다. 마크다운이나 목록은 쓰지 않는다.
- 페르소나에 있는 내용만 자기 이야기로 말한다. 없는 사실(직업, 나이, 사는 곳, 구체적 경험)은 지어내지 말고 가볍게 넘기거나 상대에게 되묻는다.
- conversation.avoid에 있는 주제는 꺼내지 않고, 상대가 꺼내면 부드럽게 다른 주제로 돌린다.
- 연락처 교환, 실제 만남 약속, 개인정보 요청은 하지 않는다. 그런 얘기가 나오면 "대화하기"로 실제 ${profile.nickname}님과 이어서 이야기할 수 있다고 안내한다.
- AI인지 물으면 ${profile.nickname}님의 가입 답변으로 만든 페르소나라고 솔직하게 말한다.
- 상대에게 관심을 보이며 공통점을 찾는 질문을 자주 한다.`;
}

export const anthropicProvider: LlmProvider = {
  name: "anthropic",

  async generatePersona({ answers, questions, extractedNouns }) {
    const response = await getClient().beta.messages.parse({
      model: config.anthropicModel,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(PersonaContentSchema) },
      system: GENERATE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `[가입 답변]\n${formatAnswers(answers, questions)}\n\n[전처리 키워드]\n${extractedNouns.join(", ") || "(없음)"}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new Error(`persona generation refused: ${response.stop_details?.category ?? "unknown"}`);
    if (!response.parsed_output) throw new Error(`persona generation returned no parsable output (stop_reason=${response.stop_reason})`);
    return response.parsed_output;
  },

  async personaReply({ persona, partnerNickname, history }) {
    const response = await getClient().beta.messages.create({
      model: config.anthropicModel,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: personaSystem(persona, partnerNickname),
      messages: history.map((t) => ({ role: t.role, content: t.text })),
    });
    if (response.stop_reason === "refusal") return "음, 그 얘기는 넘어가고 다른 얘기 해 볼까요?";
    return textOf(response.content) || "앗, 잠깐 생각이 끊겼어요. 다시 말해 줄래요?";
  },

  async followupQuestion({ question, latestAnswer }) {
    const response = await getClient().beta.messages.create({
      model: config.anthropicModel,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system:
        "소개팅 앱 가입 화면의 꼬리 질문을 만든다. 사용자의 답이 짧거나 모호해서 페르소나를 만들기에 정보가 부족하다. 부담 없고 구체적인 꼬리 질문 한 문장만 존댓말로 출력한다. 개인정보(실명, 학교, 회사, 사는 곳)는 묻지 않는다.",
      messages: [{ role: "user", content: `질문: ${question.title}\n사용자 답: ${latestAnswer || "(비어 있음)"}` }],
    });
    const text = textOf(response.content);
    if (response.stop_reason === "refusal" || !text) throw new Error("followup generation failed");
    return text.split("\n")[0];
  },
};
