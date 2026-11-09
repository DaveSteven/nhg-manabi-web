import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, ClipboardList, Play, RotateCcw } from "lucide-react";
import { api } from "../lib/study";
import { LISTENING_TYPES, listeningGroupLabel, plain, readProgress, segments } from "../lib/listening";
import UiSelect from "../components/UiSelect";
import ListeningTrainer from "../components/ListeningTrainer";
import { PageHeader, TitleBlock } from "../components/CommonUi";
import { ChoiceCard, ConfigSection } from "./PracticePages";

const COUNT_OPTIONS = [5, 10, 20, 30];
const isListeningType = (type: number) => type >= 41 && type <= 46;

function PracticeSetup({ level, exams, mode, setMode, examId, setExamId, types, toggleType, count, setCount, starting, onSubmit }: any) {
  const random = mode === "random";
  return (
    <form className="listening-setup-form" onSubmit={onSubmit}>
      <ConfigSection step={1} title="选择题目来源" hint={`当前等级 · ${level}，等级统一在首页切换`}>
        <div className="practice-source-grid">
          <ChoiceCard type="radio" checked={random} onChange={() => setMode("random")} icon={<Play size={23} />} title="全部试卷随机" description={`从 ${level} 历年试卷中随机抽取`} />
          <ChoiceCard type="radio" checked={!random} onChange={() => setMode("exam")} icon={<ClipboardList size={23} />} title="指定试卷" description="练习一张试卷中的所选听力题型" />
        </div>
        {!random ? <UiSelect className="practice-exam-select" ariaLabel="选择听力试卷" value={examId} onChange={setExamId} options={exams.map((exam) => ({ value: String(exam.id), label: exam.title }))} /> : null}
      </ConfigSection>

      <ConfigSection step={2} title="选择听力题型" hint="可同时选择多种题型">
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

      <div className="practice-start-bar">
        <div>
          <strong>{types.length} 种题型 · {random ? `${count} 题` : "全部匹配题目"}</strong>
          <span>{random ? `${level} 全部试卷随机` : exams.find((exam) => String(exam.id) === examId)?.title}</span>
        </div>
        <button className="primary-button" disabled={!types.length || !exams.length || starting} type="submit">
          {starting ? "正在组题…" : "开始听力专项"}{!starting ? <Play size={19} /> : null}
        </button>
      </div>
    </form>
  );
}

function PracticeResult({ total, onReset, onHome }) {
  return (
    <section className="listening-practice-result">
      <CheckCircle2 size={58} />
      <h2>听力专项完成</h2>
      <strong>{total} 题</strong>
      <p>本次选择的听力题目已全部练习完成。</p>
      <div>
        <button className="primary-button" onClick={onReset} type="button"><RotateCcw size={19} />重新设置</button>
        <button className="secondary-button" onClick={onHome} type="button">返回首页</button>
      </div>
    </section>
  );
}

function ExamQuestionGroups({ groups, detail, questions, progress, onOpen }) {
  return (
    <>
      <div className="listening-tools"><strong>已完成 {questions.filter((q) => progress[q.id]?.done).length} / {questions.length} 题</strong></div>
      {groups.map((g) => (
        <section className="listening-card" key={g.id}>
          <h2>{plain(g.title).match(/問題\s*\d+/)?.[0] || "聴解"} · {listeningGroupLabel(g.question_type, detail.level)}</h2>
          <p>{plain(g.title)}</p>
          <div className="listening-grid">
            {g.questions.map((q, i) => (
              <button className="secondary-button listening-question" key={q.id} onClick={() => onOpen(q)}>
                <strong>第 {i + 1} 题</strong>
                <span>{segments(q.subtitle).length} 个精听片段</span>
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
  const [practiceSession, setPracticeSession] = useState<any>(null);
  const [starting, setStarting] = useState(false);

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
      ? Promise.all([api(`/api/exams/${examId}`), api(`/api/exams/${examId}/questions`)])
      : api(`/api/exams?level=${level}`);
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
        const [examDetail, examQuestions] = await Promise.all([api(`/api/exams/${exam.id}`), api(`/api/exams/${exam.id}/questions`)]);
        return examQuestions
          .filter((question) => practiceTypes.includes(question.question_type))
          .map((question) => ({ ...question, sourceExamId: exam.id, sourceExamTitle: exam.title, sourceLevel: exam.level, sourceDetail: examDetail }));
      }));
      const pool = loaded.flat();
      if (!pool.length) throw new Error("所选条件下没有可用的听力题目");
      const selected = practiceMode === "random" ? [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(practiceCount, pool.length)) : pool;
      setPracticeSession({ questions: selected, index: 0, finished: false });
    } catch (e) {
      setError(`组题失败：${e.message}`);
    } finally {
      setStarting(false);
    }
  }

  const advancePractice = () =>
    setPracticeSession((current) => (current.index >= current.questions.length - 1 ? { ...current, finished: true } : { ...current, index: current.index + 1 }));
  const savePractice = (patch) => save({
    last: { examId: practiceQuestion.sourceExamId, questionId: practiceQuestion.id, title: `${practiceQuestion.sourceLevel} · ${practiceQuestion.sourceExamTitle}` },
    [practiceQuestion.id]: { ...progress[practiceQuestion.id], examId: practiceQuestion.sourceExamId, started: true, ...patch },
  });
  const nextExamQuestion = () => {
    const next = questions[questions.indexOf(q) + 1];
    if (next) openQuestion(next);
    else navigate(`/listening/${examId}`);
  };

  const subtitle = practiceQuestion
    ? `${practiceQuestion.sourceLevel} · ${practiceQuestion.sourceExamTitle} · ${practiceSession.index + 1}/${practiceSession.questions.length}`
    : detail ? `${detail.level} · ${detail.title}` : "按来源、题型和题量组合听力练习";
  const backProps = practiceSession
    ? { onBack: () => setPracticeSession(null), label: "返回设置" }
    : { to: questionId ? `/listening/${examId}` : examId ? "/listening" : "/" };

  let body;
  if (practiceSession?.finished) {
    body = <PracticeResult total={practiceSession.questions.length} onReset={() => setPracticeSession(null)} onHome={() => navigate("/")} />;
  } else if (practiceQuestion) {
    body = <ListeningTrainer key={`practice:${practiceQuestion.id}`} question={practiceQuestion} examId={practiceQuestion.sourceExamId} token={token} saved={progress[practiceQuestion.id] || {}} onSave={savePractice} onNext={advancePractice} />;
  } else if (loading) {
    body = <p role="status">正在加载听力题目…</p>;
  } else if (!examId) {
    body = <PracticeSetup level={level} exams={exams} mode={practiceMode} setMode={setPracticeMode} examId={practiceExamId} setExamId={setPracticeExamId} types={practiceTypes} toggleType={togglePracticeType} count={practiceCount} setCount={setPracticeCount} starting={starting} onSubmit={startListeningPractice} />;
  } else if (questionId) {
    body = q
      ? <ListeningTrainer key={`${userId}:${q.id}`} question={q} examId={detail.id} token={token} saved={progress[q.id] || {}} onSave={(patch) => save({ [q.id]: { ...progress[q.id], examId: detail.id, ...patch } })} onNext={nextExamQuestion} />
      : <p>没有找到这道听力题，请返回列表选择。</p>;
  } else {
    body = <ExamQuestionGroups groups={groups} detail={detail} questions={questions} progress={progress} onOpen={openQuestion} />;
  }

  return (
    <div className={examId || practiceSession ? "listening" : "grammar-practice-setup listening-setup"}>
      <PageHeader {...backProps}>
        <TitleBlock className={!examId && !practiceSession ? "grammar-practice-title" : ""} eyebrow="听力练习" title="听力专项" subtitle={subtitle} />
      </PageHeader>
      {examId ? <p className="listening-note">训练进度保存在当前浏览器，按登录账号分别记录。</p> : null}
      {error && <div role="alert" className="listening-card">{error}<button className="secondary-button" onClick={() => setRetry((r) => r + 1)}>重试</button></div>}
      {body}
    </div>
  );
}
