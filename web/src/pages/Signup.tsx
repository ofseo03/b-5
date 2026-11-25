import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useConfig } from "../config";
import { PersonaView } from "../components/PersonaView";
import type { Answer, Question, User } from "../types";

type Step = { kind: "profile" } | { kind: "question"; index: number } | { kind: "creating" } | { kind: "done"; user: User };

const emptyAnswer = (q: Question): Answer => ({ questionId: q.id, choices: {}, text: "", followups: [] });

export function Signup({ onDone, onCancel }: { onDone: (user: User) => void; onCancel: () => void }) {
  const { avatars } = useConfig();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState<Step>({ kind: "profile" });
  const [nickname, setNickname] = useState("");
  const [avatarId, setAvatarId] = useState(avatars[0].id);
  const [nickError, setNickError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [followup, setFollowup] = useState<string | null>(null);
  const [followupInput, setFollowupInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ questions: Question[] }>("/signup/questions").then((d) => setQuestions(d.questions));
  }, []);

  const total = questions.length;
  const q = step.kind === "question" ? questions[step.index] : null;
  const answer = q ? answers[q.id] ?? emptyAnswer(q) : null;

  const update = (patch: Partial<Answer>) => {
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.id]: { ...(prev[q.id] ?? emptyAnswer(q)), ...patch } }));
  };

  const answered = useMemo(() => {
    if (!q || !answer) return false;
    const text = answer.text.trim().length > 0;
    const hasChoice = Object.values(answer.choices).some((v) => v.length > 0);
    if (q.text === null) return q.choiceGroups.every((g) => (answer.choices[g.key]?.length ?? 0) > 0);
    // 선택지만 골라도 넘어갈 수 있다. 자유 입력이 비면 꼬리 질문이 나간다.
    if (q.choiceGroups.length) return hasChoice || text;
    return text;
  }, [q, answer]);

  async function submitProfile() {
    setBusy(true);
    const r = await api<{ ok: boolean; error: string | null }>(`/signup/nickname?value=${encodeURIComponent(nickname)}`);
    setBusy(false);
    if (!r.ok) {
      setNickError(r.error);
      return;
    }
    setNickError(null);
    setStep({ kind: "question", index: 0 });
  }

  /** 다음으로. current를 넘기면 방금 바뀐 답(꼬리 질문 답 포함)으로 다시 검사한다. */
  async function next(skip = false, current: Answer | null = answer) {
    if (!q || !current || step.kind !== "question") return;
    if (!skip && q.text?.textRequired) {
      const latest = current.followups.length ? current.followups[current.followups.length - 1].answer : current.text;
      setBusy(true);
      try {
        const r = await api<{ followup: string | null }>("/signup/followup", {
          body: { questionId: q.id, latestAnswer: latest, followupsSoFar: current.followups.length },
        });
        if (r.followup) {
          setFollowup(r.followup);
          setFollowupInput("");
          return;
        }
      } finally {
        setBusy(false);
      }
    }
    setFollowup(null);
    if (step.index + 1 < total) setStep({ kind: "question", index: step.index + 1 });
    else await finish(current);
  }

  function answerFollowup() {
    if (!q || !answer || !followup) return;
    const updated = { ...answer, followups: [...answer.followups, { question: followup, answer: followupInput.trim() }] };
    setAnswers((prev) => ({ ...prev, [q.id]: updated }));
    setFollowup(null);
    void next(false, updated);
  }

  async function finish(current: Answer | null) {
    setStep({ kind: "creating" });
    setError(null);
    try {
      const ordered = questions
        .map((x) => (current && x.id === current.questionId ? current : answers[x.id]))
        .filter((a): a is Answer => !!a);
      const r = await api<{ user: User }>("/users", { body: { nickname: nickname.trim(), avatarId, answers: ordered } });
      setStep({ kind: "done", user: r.user });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep({ kind: "question", index: total - 1 });
    }
  }

  function back() {
    setFollowup(null);
    if (step.kind === "question") {
      if (step.index === 0) setStep({ kind: "profile" });
      else setStep({ kind: "question", index: step.index - 1 });
    } else onCancel();
  }

  if (step.kind === "creating") {
    return (
      <div className="page center">
        <div className="spinner" />
        <p>답변으로 페르소나를 만드는 중이에요…</p>
      </div>
    );
  }

  if (step.kind === "done") {
    return (
      <div className="page">
        <h1>페르소나가 만들어졌어요 🎉</h1>
        <p className="muted">다른 사람들은 먼저 이 페르소나와 대화해 보게 돼요.</p>
        <PersonaView persona={step.user.persona} />
        <button className="btn primary block" onClick={() => onDone(step.user)}>추천 보러 가기</button>
      </div>
    );
  }

  if (step.kind === "profile") {
    return (
      <div className="page">
        <button className="link" onClick={onCancel}>← 처음으로</button>
        <h1>프로필 만들기</h1>
        <label className="field">
          <span>닉네임</span>
          <input value={nickname} maxLength={10} onChange={(e) => setNickname(e.target.value)} placeholder="2~10자" />
        </label>
        <p className="notice">닉네임에는 실명, 전화번호, SNS 아이디처럼 나를 알아볼 수 있는 정보를 넣지 마세요.</p>
        {nickError && <p className="error">{nickError}</p>}
        <span className="field-label">나를 대신할 캐릭터</span>
        <div className="avatar-grid">
          {avatars.map((a) => (
            <button key={a.id} className={a.id === avatarId ? "selected" : ""} onClick={() => setAvatarId(a.id)} title={a.name}>
              {a.emoji}
            </button>
          ))}
        </div>
        <p className="hint">질문 {total}개, 5~10분 정도 걸려요. 답변으로 나의 AI 페르소나를 만들어요.</p>
        <button className="btn primary block" disabled={busy || nickname.trim().length < 2} onClick={submitProfile}>
          다음
        </button>
      </div>
    );
  }

  if (!q || !answer) return <div className="page center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <button className="link" onClick={back}>← 이전</button>
      <div className="progress"><div style={{ width: `${((step.index + 1) / total) * 100}%` }} /></div>
      <p className="muted small">{q.section} · {step.index + 1}/{total}{q.required ? "" : " · 선택"}</p>
      <h2 className="question">{q.title}</h2>

      {q.choiceGroups.map((g) => (
        <div key={g.key} className="choice-group">
          {g.label && <span className="field-label">{g.label}</span>}
          <div className="chips">
            {g.options.map((opt) => {
              const selected = answer.choices[g.key]?.includes(opt) ?? false;
              return (
                <button
                  key={opt}
                  className={`chip ${selected ? "selected" : ""}`}
                  onClick={() => {
                    const cur = answer.choices[g.key] ?? [];
                    let nextValues: string[];
                    if (!g.multi) nextValues = selected ? [] : [opt];
                    else if (selected) nextValues = cur.filter((x) => x !== opt);
                    else if (g.max && cur.length >= g.max) return;
                    else nextValues = [...cur, opt];
                    update({ choices: { ...answer.choices, [g.key]: nextValues } });
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {q.text && (
        <textarea
          className={q.text.chatBubble ? "bubble-input" : ""}
          rows={3}
          maxLength={500}
          placeholder={q.text.placeholder}
          value={answer.text}
          onChange={(e) => update({ text: e.target.value })}
        />
      )}
      {q.text && <p className="notice">실명, 연락처, 학교·회사 이름은 적지 마세요. 페르소나는 익명으로 대화해요.</p>}

      {answer.followups.map((f, i) => (
        <div key={i} className="followup done">
          <p className="followup-q">💬 {f.question}</p>
          <p className="followup-a">{f.answer || "(넘어감)"}</p>
        </div>
      ))}

      {followup ? (
        <div className="followup">
          <p className="followup-q">💬 {followup}</p>
          <textarea rows={2} maxLength={500} value={followupInput} onChange={(e) => setFollowupInput(e.target.value)} autoFocus />
          <div className="row">
            <button className="btn" onClick={() => void next(true)}>넘어가기</button>
            <button className="btn primary" disabled={!followupInput.trim()} onClick={answerFollowup}>답하기</button>
          </div>
        </div>
      ) : (
        <div className="row">
          {!q.required && <button className="btn" onClick={() => void next(true)}>건너뛰기</button>}
          <button className="btn primary grow" disabled={busy || !answered} onClick={() => void next()}>
            {step.index + 1 === total ? "페르소나 만들기" : "다음"}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
