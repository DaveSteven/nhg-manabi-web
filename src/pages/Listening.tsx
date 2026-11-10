import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, ClipboardList, Play, RotateCcw } from "lucide-react";
import { api, assetSrc, mapPracticeAttempt, pct } from "../lib/study";
import { LISTENING_TYPES, listeningGroupLabel, plain, readProgress, segments } from "../lib/listening";
import UiSelect from "../components/UiSelect";
import ListeningTrainer from "../components/ListeningTrainer";
import { ModalOverlay, PageHeader, TitleBlock } from "../components/CommonUi";
import { ResultFilter, ResultGroupCard, ResultPage, ResultQuestion, ResultReview, ResultSummary, answerStatus, countStatuses, scoreTone, singleNavChunk } from "../components/ResultParts";
import { HtmlContent, hasVisibleHtml } from "../components/Html";
import { ChoiceCard, ConfigSection } from "./PracticePages";
import { readPracticeMode, writePracticeMode } from "../lib/appHelpers";

const COUNT_OPTIONS = [5, 10, 20, 30];
const isListeningType = (type: number) => type >= 41 && type <= 46;

function PracticeSetup({ level, exams, mode, setMode, examId, setExamId, types, toggleType, count, setCount, feedbackMode, setFeedbackMode, starting, onSubmit }: any) {
  const random = mode === "random";
  return (
    <form className="listening-setup-form" onSubmit={onSubmit}>
      <ConfigSection step={1} title="选择题目来源" hint={`当前等级 · ${level}，等级统一在首页切换`}>
        <div className="practice-source-grid">
          <ChoiceCard type="radio" checked={random} onChange={() => setMode("random")} icon={<Play size={23} />} title="全部试卷随机" />
          <ChoiceCard type="radio" checked={!random} onChange={() => setMode("exam")} icon={<ClipboardList size={23} />} title="指定试卷" />
        </div>
        {!random ? <UiSelect className="practice-exam-select" ariaLabel="选择听力试卷" value={examId} onChange={setExamId} options={exams.map((exam) => ({ value: String(exam.id), label: exam.title }))} /> : null}
      </ConfigSection>

      <ConfigSection step={2} title="选择听力题型">
        <div className="practice-type-grid">
          {LISTENING_TYPES.map((item) => (
            <ChoiceCard key={item.id} type="checkbox" checked={types.includes(item.id)} onChange={() => toggleType(item.id)} icon={<CheckCircle2 size={20} />} title={item.label} description={item.description} />
          ))}
        </div>
      </ConfigSection>

      {random ? (
        <ConfigSection step={3} title="设置题目数量" hint="实际题量不会超过可用题目数量">
          <div className="practice-count-options">
            {COUNT_OPTIONS.map((value) => <button className={count === value ? "selected" : ""} onClick={() => setCount(value)} type="button" key={value}>{value}题</button>)}
            <label><input type="number" min="1" max="100" value={count} onChange={(event) => setCount(Number(event.target.value))} /><span>题</span></label>
          </div>
        </ConfigSection>
      ) : null}

      <ConfigSection step={random ? 4 : 3} title="选择练习模式" hint="开始后不可切换模式">
        <div className="practice-source-grid">
          <ChoiceCard name="listening-feedback-mode" type="radio" checked={feedbackMode === "instant"} onChange={() => setFeedbackMode("instant")} icon={<Play size={23} />} title="即时反馈" description="检查后开放解析、原文、译文和逐段精听" />
          <ChoiceCard name="listening-feedback-mode" type="radio" checked={feedbackMode === "immersive"} onChange={() => setFeedbackMode("immersive")} icon={<ClipboardList size={23} />} title="沉浸练习" description="完成整次练习后统一开放复习内容" />
        </div>
      </ConfigSection>

      <div className="practice-start-bar">
        <div>
          <strong>{types.length} 种题型 · {random ? `${count} 题` : "全部匹配题目"} · {feedbackMode === "instant" ? "即时反馈" : "沉浸练习"}</strong>
          <span>{random ? `${level} 全部试卷随机` : exams.find((exam) => String(exam.id) === examId)?.title}</span>
        </div>
        <button className="primary-button" disabled={!types.length || !exams.length || starting} type="submit">
          {starting ? "正在组题…" : "开始听力专项"}{!starting ? <Play size={19} /> : null}
        </button>
      </div>
    </form>
  );
}

function PracticeResult({ attempt, questions, onReviewWrong, onReset, onHome }) {
  const [filter, setFilter] = useState<ResultFilter>("all");
  const questionById = new Map<any, any>(questions.map((question) => [question.id, question]));
  const statuses = attempt.answers.map(answerStatus);
  const counts = countStatuses(statuses);
  const missed = counts.wrong + counts.skipped;
  const total = attempt.total || attempt.answers.length;
  const score = pct(attempt.correct, total);
  const types = LISTENING_TYPES
    .map((type) => {
      const indexes = attempt.answers.map((answer, index) => ({ answer, index })).filter(({ answer }) => questionById.get(answer.questionId)?.question_type === type.id);
      return { id: type.id, label: type.label, total: indexes.length, correct: indexes.filter(({ index }) => statuses[index] === "correct").length };
    })
    .filter((type) => type.total);
  const entries = attempt.answers.map((answer, index) => ({ id: answer.questionId, number: index + 1, status: statuses[index] }));
  // 页头（听力专项 + 返回设置）由外层 Listening 页提供，这里不再重复。
  return (
    <ResultPage petals={scoreTone(score) === "great" ? "light" : null}>
      <ResultSummary
        score={score}
        counts={counts}
        total={total}
        types={types}
        note={counts.skipped ? "未作答的题计入总题数。" : null}
        actions={(
          <>
            {missed ? <button className="primary-button" onClick={onReviewWrong} type="button">重练错题（{missed} 题）</button> : null}
            <button className={missed ? "secondary-button" : "primary-button"} onClick={onReset} type="button"><RotateCcw size={18} />再练一组</button>
            <button className="secondary-button" onClick={onHome} type="button">返回首页</button>
          </>
        )}
      />
      <ResultReview chunks={singleNavChunk(entries)} total={entries.length} missed={missed} filter={filter} onFilter={setFilter}>
        {attempt.answers.map((answer, index) => {
          if (filter === "missed" && statuses[index] === "correct") return null;
          const question: any = questionById.get(answer.questionId);
          return (
            <ResultGroupCard key={answer.questionId}>
              <ResultQuestion
                id={answer.questionId}
                number={index + 1}
                status={statuses[index]}
                meta={question?.sourceExamTitle || null}
                stem={hasVisibleHtml(answer.title || question?.title) ? <HtmlContent inline html={answer.title || question?.title} /> : null}
                media={question?.image_url ? <img className="exam-image" src={assetSrc(question.image_url)} alt="" /> : null}
                options={question?.options || []}
                chosenId={answer.chosenOptionId}
                correctId={answer.correctOptionId}
                chosenText={answer.chosenText}
                answerText={answer.answerText}
                analysis={answer.analysis}
              >
                {question?.subtitle ? (
                  <details className="practice-result-transcript">
                    <summary>听力原文{question.translation ? " / 译文" : ""}</summary>
                    <p lang="ja">{plain(question.subtitle)}</p>
                    {question.translation ? <p>{plain(question.translation)}</p> : null}
                  </details>
                ) : null}
              </ResultQuestion>
            </ResultGroupCard>
          );
        })}
      </ResultReview>
    </ResultPage>
  );
}

function ExamQuestionGroups({ groups, detail, questions, progress, onOpen }) {
  return (
    <>
      <div className="listening-tools"><strong>已完成 {questions.filter((q) => progress[q.id]?.done).length} / {questions.length} 题</strong></div>
      {groups.map((g) => (
        <section className="listening-card" key={g.id}>
          <h2>{plain(g.title).match(/問題\s*\d+/)?.[0] || "聴解"} · {listeningGroupLabel(g.question_type)}</h2>
          <p>{plain(g.title)}</p>
          <div className="listening-grid">
            {g.questions.map((q, i) => (
              <button className="secondary-button listening-question" key={q.id} onClick={() => onOpen(q)}>
                <strong>第 {i + 1} 题</strong>
                <span>{q.segment_count ?? segments(q.subtitle).length} 个精听片段</span>
                <span>{progress[q.id]?.done ? "已完成" : progress[q.id]?.started ? "练习中" : "未练"}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export default function Listening({ userId, token, globalLevel: level }) {
  const { examId, questionId } = useParams();
  const navigate = useNavigate();
  const key = `listening:${userId}`;
  const [progress, setProgress] = useState(() => readProgress(key));
  const [exams, setExams] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [practiceMode, setPracticeMode] = useState("random");
  const [practiceExamId, setPracticeExamId] = useState("");
  const [practiceTypes, setPracticeTypes] = useState(LISTENING_TYPES.map((item) => item.id));
  const [practiceCount, setPracticeCount] = useState(10);
  const [feedbackMode, setFeedbackMode] = useState(readPracticeMode);
  const [practiceSession, setPracticeSession] = useState<any>(null);
  const [starting, setStarting] = useState(false);
  const [showExit, setShowExit] = useState(false);

  function save(patch) {
    setProgress((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { setError("无法保存进度，请检查浏览器存储空间。"); }
      return next;
    });
  }

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setDetail(null);
    setQuestions([]);
    const load = examId
      ? Promise.all([api(`/api/exams/${examId}`, {}, token), api(`/api/exams/${examId}/questions`, {}, token)])
      : api(`/api/exams?level=${level}`, {}, token);
    load
      .then((data: any) => {
        if (!live) return;
        if (examId) {
          setDetail(data[0]);
          setQuestions(data[1].filter((q) => isListeningType(q.question_type)));
        } else {
          setExams(data.filter((e) => e.listening_num > 0));
        }
      })
      .catch((e) => { if (live) setError(`加载失败：${e.message}`); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [examId, level, retry]);

  useEffect(() => {
    if (exams.length && !exams.some((exam) => String(exam.id) === practiceExamId)) setPracticeExamId(String(exams[0].id));
  }, [exams, practiceExamId]);

  useEffect(() => {
    if (!practiceSession || practiceSession.finishedAttempt) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [practiceSession]);

  const q = questions.find((item) => item.id === Number(questionId));
  const groups = (detail?.layers || [])
    .map((l) => ({ ...l, questions: questions.filter((item) => item.layer_id === l.id) }))
    .filter((l) => l.questions.length);
  const practiceQuestion = practiceSession?.questions?.[practiceSession.index];

  const openQuestion = (question) => {
    save({
      last: { examId: detail.id, questionId: question.id, title: `${detail.level} · ${detail.title}` },
      [question.id]: { ...progress[question.id], examId: detail.id, started: true },
    });
    navigate(`/listening/${detail.id}/${question.id}`);
  };
  const togglePracticeType = (type) =>
    setPracticeTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));

  async function startListeningPractice(event) {
    event.preventDefault();
    if (!practiceTypes.length || (practiceMode === "exam" && !practiceExamId)) return;
    setStarting(true);
    setError("");
    try {
      const sources = practiceMode === "exam" ? exams.filter((exam) => exam.id === Number(practiceExamId)) : exams;
      const loaded = await Promise.all(sources.map(async (exam) => {
        const [examDetail, examQuestions] = await Promise.all([api(`/api/exams/${exam.id}`, {}, token), api(`/api/exams/${exam.id}/questions`, {}, token)]);
        return examQuestions
          .filter((question) => practiceTypes.includes(question.question_type))
          .map((question) => ({ ...question, sourceExamId: exam.id, sourceExamTitle: exam.title, sourceLevel: exam.level, sourceDetail: examDetail }));
      }));
      const pool = loaded.flat();
      if (!pool.length) throw new Error("所选条件下没有可用的听力题目");
      const selected = practiceMode === "random" ? [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(practiceCount, pool.length)) : pool;
      writePracticeMode(feedbackMode);
      setPracticeSession({ questions: selected, index: 0, answers: {}, feedbackMode, saving: false, finishedAttempt: null });
    } catch (e) {
      setError(`组题失败：${e.message}`);
    } finally {
      setStarting(false);
    }
  }

  const advancePractice = async (choice) => {
    const answers = { ...practiceSession.answers, [practiceQuestion.id]: choice || null };
    if (practiceSession.index < practiceSession.questions.length - 1) {
      setPracticeSession((current) => ({ ...current, answers, index: current.index + 1 }));
      return;
    }
    setPracticeSession((current) => ({ ...current, answers, saving: true, saveError: "" }));
    try {
      const saved = mapPracticeAttempt(await api("/api/practice-attempts", {
        method: "POST",
        body: JSON.stringify({ level, category: "listening", mode: "practice", title: `${level} 听力专项练习`, answers: practiceSession.questions.map((question) => ({ question_id: question.id, chosen_option_id: answers[question.id] || null })) }),
      }, token));
      setPracticeSession((current) => ({ ...current, saving: false, finishedAttempt: saved }));
    } catch (e) {
      setPracticeSession((current) => ({ ...current, saving: false, saveError: e.message || "保存失败，请重试" }));
    }
  };
  const savePractice = (patch) => save({
    last: { examId: practiceQuestion.sourceExamId, questionId: practiceQuestion.id, title: `${practiceQuestion.sourceLevel} · ${practiceQuestion.sourceExamTitle}` },
    [practiceQuestion.id]: { ...progress[practiceQuestion.id], examId: practiceQuestion.sourceExamId, started: true, ...patch },
  });
  const nextExamQuestion = () => {
    const next = questions[questions.indexOf(q) + 1];
    if (next) openQuestion(next);
    else navigate(`/listening/${examId}`);
  };

  const subtitle = practiceSession?.finishedAttempt
    ? `${level} · 练习结果`
    : practiceQuestion
    ? `${practiceQuestion.sourceLevel} · ${practiceQuestion.sourceExamTitle} · ${practiceSession.index + 1}/${practiceSession.questions.length}`
    : detail ? `${detail.level} · ${detail.title}` : null;
  // 结果已保存，返回时不再弹「退出后作答不保存」的确认。
  const backProps = practiceSession?.finishedAttempt
    ? { onBack: () => setPracticeSession(null), label: "返回设置" }
    : practiceSession
    ? { onBack: () => setShowExit(true), label: "返回设置" }
    : { to: questionId ? `/listening/${examId}` : examId ? "/listening" : "/" };

  let body;
  if (practiceSession?.finishedAttempt) {
    body = <PracticeResult attempt={practiceSession.finishedAttempt} questions={practiceSession.questions} onReviewWrong={() => {
      const wrongIds = new Set(practiceSession.finishedAttempt.answers.filter((answer) => !answer.isCorrect).map((answer) => answer.questionId));
      setPracticeSession((current) => ({ ...current, questions: current.questions.filter((question) => wrongIds.has(question.id)), index: 0, answers: {}, saving: false, finishedAttempt: null }));
    }} onReset={() => setPracticeSession(null)} onHome={() => navigate("/")} />;
  } else if (practiceQuestion) {
    body = <ListeningTrainer key={`practice:${practiceQuestion.id}`} question={practiceQuestion} examId={practiceQuestion.sourceExamId} token={token} saved={progress[practiceQuestion.id] || {}} feedbackMode={practiceSession.feedbackMode} onSave={savePractice} onNext={advancePractice} />;
  } else if (loading) {
    body = <p role="status">正在加载听力题目…</p>;
  } else if (!examId) {
    body = <PracticeSetup level={level} exams={exams} mode={practiceMode} setMode={setPracticeMode} examId={practiceExamId} setExamId={setPracticeExamId} types={practiceTypes} toggleType={togglePracticeType} count={practiceCount} setCount={setPracticeCount} feedbackMode={feedbackMode} setFeedbackMode={setFeedbackMode} starting={starting} onSubmit={startListeningPractice} />;
  } else if (questionId) {
    body = q
      ? <ListeningTrainer key={`${userId}:${q.id}`} question={q} examId={detail.id} token={token} saved={progress[q.id] || {}} onSave={(patch) => save({ [q.id]: { ...progress[q.id], examId: detail.id, ...patch } })} onNext={nextExamQuestion} />
      : <p>没有找到这道听力题，请返回列表选择。</p>;
  } else {
    body = <ExamQuestionGroups groups={groups} detail={detail} questions={questions} progress={progress} onOpen={openQuestion} />;
  }

  return (
    <div className={practiceSession?.finishedAttempt ? "listening listening-result" : examId || practiceSession ? "listening" : "grammar-practice-setup listening-setup"}>
      <PageHeader {...backProps}>
        <TitleBlock className={!examId && !practiceSession ? "grammar-practice-title" : ""} eyebrow="听力练习" title="听力专项" subtitle={subtitle} />
      </PageHeader>
      {examId ? <p className="listening-note">训练进度保存在当前浏览器，按登录账号分别记录。</p> : null}
      {error && <div role="alert" className="listening-card">{error}<button className="secondary-button" onClick={() => setRetry((r) => r + 1)}>重试</button></div>}
      {practiceSession?.saveError ? <div role="alert" className="listening-card">{practiceSession.saveError}。当前作答仍保留，请重试完成练习。</div> : null}
      {body}
      {showExit ? <ModalOverlay title="退出本次练习？" onClose={() => setShowExit(false)}><p className="modal-footnote">退出后，本次作答和练习进度将不保存，也不会计入练习记录。</p><div className="modal-actions"><button className="secondary-button" onClick={() => { setShowExit(false); setPracticeSession(null); }} type="button">退出练习</button><button className="primary-button" onClick={() => setShowExit(false)} type="button">继续练习</button></div></ModalOverlay> : null}
    </div>
  );
}
