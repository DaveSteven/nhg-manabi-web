import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ClipboardList, Eye, Focus, Target } from "lucide-react";
import UiSelect from "../components/UiSelect";
import { PageHeader, TitleBlock } from "../components/CommonUi";
import { readPracticeMode, writePracticeMode } from "../lib/appHelpers";
import { useAuthStore } from "../stores/auth";
import { usePreferencesStore } from "../stores/preferences";
import { useQuizFlow } from "../hooks/useQuizFlow";
import { useExams } from "../hooks/useLibraryData";

const T = (id, label, description) => ({ id, label, description });

export const PRACTICE_CATEGORIES = {
  vocabulary: {
    label: "文字词汇",
    eyebrow: "文字词汇练习",
    types: [
      T(11, "汉字读音", "选择汉字的正确读音"),
      T(12, "汉字书写", "选择假名对应的正确汉字"),
      T(13, "词语构成", "选择符合构词规则的表达"),
      T(14, "语境填空", "根据句子语境选择词语"),
      T(15, "近义替换", "选择意义最接近的表达"),
      T(16, "词语用法", "判断词语使用正确的句子"),
    ],
  },
  grammar: {
    label: "文法",
    eyebrow: "文法练习",
    types: [
      T(21, "文法填空", "选择最适合句中空格的表达"),
      T(22, "句子排序", "判断 ★ 位置应放入的内容"),
      T(23, "文章填空", "结合整篇文章选择合适表达"),
    ],
  },
  reading: {
    label: "读解",
    eyebrow: "阅读练习",
    types: [
      T(31, "短篇理解", "阅读短文并回答问题"),
      T(32, "中篇理解", "理解文章结构和主要内容"),
      T(33, "对比阅读", "比较两篇文章或不同观点"),
      T(34, "综合理解", "综合分析文章内容"),
      T(35, "长篇理解", "阅读长文并理解作者意图"),
      T(36, "信息检索", "从通知和资料中查找信息"),
    ],
  },
};

export function ConfigSection({ step, title, hint = null, className = "", children }) {
  return (
    <section className={`practice-config-section ${className}`.trim()}>
      <div className="practice-config-heading"><span>{step}</span><div><h2>{title}</h2>{hint ? <p>{hint}</p> : null}</div></div>
      {children}
    </section>
  );
}

export function ChoiceCard({ type, checked, onChange, icon, title, description, selected = checked, name }: any) {
  return (
    <label className={selected ? "selected" : ""}>
      <input type={type} name={type === "radio" ? (name || "source") : undefined} checked={checked} onChange={onChange} />
      {icon}
      <span><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
    </label>
  );
}

export function GrammarPracticeSetupView({ category = "grammar" }) {
  // T-023 S3：自取 exams/level 与开练动作（category 为路由参数）
  const authToken = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.currentUser);
  const level = usePreferencesStore((state) => state.level);
  const examsQuery = useExams(level, authToken, currentUser?.id);
  const exams = examsQuery.data || [];
  const { resetToLibrary: onBack, startGrammarPractice: onStart } = useQuizFlow();
  const practiceCategory = PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar;
  const countUnit = category === "reading" ? "篇" : "题";
  const [mode, setMode] = useState("random");
  const [feedbackMode, setFeedbackMode] = useState(readPracticeMode);
  const [examId, setExamId] = useState(exams[0]?.id ? String(exams[0].id) : "");
  const [types, setTypes] = useState(practiceCategory.types.map((type) => type.id));
  const [count, setCount] = useState(20);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");

  const toggleType = (type) =>
    setTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));

  async function submit(event) {
    event.preventDefault();
    if (!types.length || (mode === "exam" && !examId)) return;
    setStarting(true);
    setMessage("");
    try {
      writePracticeMode(feedbackMode);
      await onStart({ mode, feedbackMode, examId, types, category, count: Math.max(1, Math.min(100, Number(count) || 20)) });
    } catch (error) {
      setMessage(error.message || "专项题目加载失败，请稍后重试");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="grammar-practice-setup">
      <PageHeader onBack={onBack}>
        <TitleBlock className="grammar-practice-title" eyebrow={practiceCategory.eyebrow} title={`${level} ${practiceCategory.label}专项`} />
      </PageHeader>

      <form onSubmit={submit}>
        <ConfigSection step={1} title="选择题目来源">
          <div className="practice-source-grid">
            <ChoiceCard type="radio" checked={mode === "random"} onChange={() => setMode("random")} icon={<Target size={23} />} title="全部试卷随机" />
            <ChoiceCard type="radio" checked={mode === "exam"} onChange={() => setMode("exam")} icon={<ClipboardList size={23} />} title="指定试卷" />
          </div>
          {mode === "exam" ? (
            <UiSelect
              className="practice-exam-select"
              ariaLabel="选择试卷"
              value={examId}
              options={exams.map((exam) => ({ value: String(exam.id), label: exam.title }))}
              onChange={setExamId}
            />
          ) : null}
        </ConfigSection>

        <ConfigSection step={2} title={`选择${practiceCategory.label}题型`}>
          <div className="practice-type-grid">
            {practiceCategory.types.map((item) => (
              <ChoiceCard key={item.id} type="checkbox" checked={types.includes(item.id)} onChange={() => toggleType(item.id)} icon={<Check size={20} />} title={item.label} description={item.description} />
            ))}
          </div>
        </ConfigSection>

        {mode === "random" ? (
          <ConfigSection step={3} className="practice-count-section" title={category === "reading" ? "设置文章数量" : "设置题目数量"} hint={category === "reading" ? "文章及其关联小题会作为完整题组抽取，不会拆散" : "实际题量不会超过所选范围内的可用题目"}>
            <div className="practice-count-options">
              {[5, 10, 20, 30].map((value) => <button className={count === value ? "selected" : ""} onClick={() => setCount(value)} type="button" key={value}>{value}{countUnit}</button>)}
              <label><input type="number" min="1" max="100" value={count} onChange={(event) => setCount(Number(event.target.value))} /><span>{countUnit}</span></label>
            </div>
          </ConfigSection>
        ) : null}

        <ConfigSection step={mode === "random" ? 4 : 3} title="选择练习模式" hint="开始后不可切换模式">
          <div className="practice-source-grid practice-feedback-modes">
            <ChoiceCard name="feedback-mode" type="radio" checked={feedbackMode === "instant"} onChange={() => setFeedbackMode("instant")} icon={<Eye size={23} />} title="即时反馈" description="检查当前题（阅读按篇检查），查看解析后继续" />
            <ChoiceCard name="feedback-mode" type="radio" checked={feedbackMode === "immersive"} onChange={() => setFeedbackMode("immersive")} icon={<Focus size={23} />} title="沉浸练习" description="完成整次练习后统一看解析" />
          </div>
        </ConfigSection>

        {message ? <p className="form-error" role="alert">{message}</p> : null}
        <div className="practice-start-bar">
          <div>
            <strong>{types.length} 种题型 · {mode === "random" ? `${count || 0} ${countUnit}` : "全部匹配题目"} · {feedbackMode === "instant" ? "即时反馈" : "沉浸练习"}</strong>
            <span>{mode === "random" ? `${level} 全部试卷随机` : exams.find((exam) => String(exam.id) === examId)?.title}</span>
          </div>
          <button className="primary-button" disabled={!types.length || !exams.length || starting} type="submit">
            {starting ? "正在组题…" : "开始专项练习"} {!starting ? <ArrowRight size={19} /> : null}
          </button>
        </div>
      </form>
    </section>
  );
}

export function BasicPracticeSetupView() {
  // T-023 S3：自取待开练习（pendingPractice）与开练动作；路由侧保证 pendingPractice 存在才渲染
  const navigate = useNavigate();
  const pendingPractice = usePreferencesStore((state) => state.pendingPractice);
  const setPendingPractice = usePreferencesStore((state) => state.setPendingPractice);
  const practiceMode = usePreferencesStore((state) => state.practiceMode);
  const { startPreparedPractice: onStart } = useQuizFlow();
  const source = pendingPractice.source;
  const questionCount = pendingPractice.quiz.questions.length;
  const onBack = () => { setPendingPractice(null); navigate(-1); };
  const [feedbackMode, setFeedbackMode] = useState(practiceMode || readPracticeMode());
  const start = () => { writePracticeMode(feedbackMode); onStart(feedbackMode); };
  return (
    <section className="grammar-practice-setup basic-practice-setup">
      <PageHeader onBack={onBack}>
        <TitleBlock className="grammar-practice-title" eyebrow="练习设置" title={source?.book_name || source?.title || "开始练习"} subtitle={`${source?.categoryLabel || source?.level || ""} · 共 ${questionCount} 题`} />
      </PageHeader>
      <ConfigSection step={1} title="选择练习模式" hint="开始后不可切换模式">
        <div className="practice-source-grid practice-feedback-modes">
          <ChoiceCard name="basic-feedback-mode" type="radio" checked={feedbackMode === "instant"} onChange={() => setFeedbackMode("instant")} icon={<Eye size={23} />} title="即时反馈" description="逐题检查，查看答案和解析后继续" />
          <ChoiceCard name="basic-feedback-mode" type="radio" checked={feedbackMode === "immersive"} onChange={() => setFeedbackMode("immersive")} icon={<Focus size={23} />} title="沉浸练习" description="完成后统一查看结果" />
        </div>
      </ConfigSection>
      <div className="practice-start-bar">
        <div><strong>{feedbackMode === "instant" ? "即时反馈" : "沉浸练习"} · {questionCount} 题</strong><span>中途退出不会保存本次进度</span></div>
        <button className="primary-button" onClick={start} type="button">开始练习 <ArrowRight size={19} /></button>
      </div>
    </section>
  );
}
