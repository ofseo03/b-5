import type { Persona, PersonaContent } from "../persona.js";
import type { Answer, Question } from "../questions.js";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface LlmProvider {
  name: string;
  /** 가입 답변 → 페르소나 내용 (형식은 고정, 값만 채움) */
  generatePersona(input: { answers: Answer[]; questions: Question[]; extractedNouns: string[] }): Promise<PersonaContent>;
  /** 페르소나로서 답장. history의 마지막은 상대(user)의 메시지 */
  personaReply(input: { persona: Persona; partnerNickname: string; history: ChatTurn[] }): Promise<string>;
  /** 미리 써 둔 꼬리 질문이 없을 때 만들 꼬리 질문 */
  followupQuestion(input: { question: Question; latestAnswer: string }): Promise<string>;
}

export function formatAnswers(answers: Answer[], questions: Question[]): string {
  return answers
    .map((a) => {
      const q = questions.find((x) => x.id === a.questionId);
      const lines = [`[${a.questionId}] ${q?.title ?? ""}`];
      for (const [key, values] of Object.entries(a.choices)) {
        if (values.length) lines.push(`- 선택(${key}): ${values.join(", ")}`);
      }
      if (a.text.trim()) lines.push(`- 답: ${a.text.trim()}`);
      for (const f of a.followups) lines.push(`- 꼬리 질문: ${f.question}\n  답: ${f.answer}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
