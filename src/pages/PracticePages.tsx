import React, { useState } from "react";
import { ArrowRight, Check, ClipboardList, Target } from "lucide-react";
import UiSelect from "../components/UiSelect";
import { PageHeader, TitleBlock } from "../components/CommonUi";

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

export function ConfigSection({ step, title, hint, className = "", children }) {
  return (
    <section className={`practice-config-section ${className}`.trim()}>
      <div className="practice-config-heading"><span>{step}</span><div><h2>{title}</h2><p>{hint}</p></div></div>
      {children}
    </section>
  );
}

export function ChoiceCard({ type, checked, onChange, icon, title, description, selected = checked }: any) {
  return (
    <label className={selected ? "selected" : ""}>
      <input type={type} name={type === "radio" ? "source" : undefined} checked={checked} onChange={onChange} />
      {icon}
      <span><strong>{title}</strong><small>{description}</small></span>
    </label>
  );
}

export function GrammarPracticeSetupView({ exams, level, category = "grammar", onBack, onStart }) {
  const practiceCategory = PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar;
  const [mode, setMode] = useState("random");
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
      await onStart({ mode, examId, types, category, count: Math.max(1, Math.min(100, Number(count) || 20)) });
    } catch (error) {
      setMessage(error.message || "专项题目加载失败，请稍后重试");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="grammar-practice-setup">
      <PageHeader onBack={onBack}>
        <TitleBlock className="grammar-practice-title" eyebrow={practiceCategory.eyebrow} title={`${level} ${practiceCategory.label}专项`} subtitle="按需要组合题型、来源和练习数量" />
      </PageHeader>

      <form onSubmit={submit}>
        <ConfigSection step={1} title="选择题目来源" hint="可以指定一张试卷，也可以跨试卷随机抽题">
          <div className="practice-source-grid">
            <ChoiceCard type="radio" checked={mode === "random"} onChange={() => setMode("random")} icon={<Target size={23} />} title="全部试卷随机" description={`从 ${level} 历年试卷中打乱抽取`} />
            <ChoiceCard type="radio" checked={mode === "exam"} onChange={() => setMode("exam")} icon={<ClipboardList size={23} />} title="指定试卷" description={`只练习一张试卷中的${practiceCategory.label}题`} />
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

        <ConfigSection step={2} title={`选择${practiceCategory.label}题型`} hint="可同时选择多种题型">
          <div className="practice-type-grid">
            {practiceCategory.types.map((item) => (
              <ChoiceCard key={item.id} type="checkbox" checked={types.includes(item.id)} onChange={() => toggleType(item.id)} icon={<Check size={20} />} title={item.label} description={item.description} />
            ))}
          </div>
        </ConfigSection>

        {mode === "random" ? (
          <ConfigSection step={3} className="practice-count-section" title="设置题目数量" hint="实际题量不会超过所选范围内的可用题目">
            <div className="practice-count-options">
              {[5, 10, 20, 30].map((value) => <button className={count === value ? "selected" : ""} onClick={() => setCount(value)} type="button" key={value}>{value}题</button>)}
              <label><input type="number" min="1" max="100" value={count} onChange={(event) => setCount(Number(event.target.value))} /><span>题</span></label>
            </div>
          </ConfigSection>
        ) : null}

        {message ? <p className="form-error" role="alert">{message}</p> : null}
        <div className="practice-start-bar">
          <div>
            <strong>{types.length} 种题型 · {mode === "random" ? `${count || 0} 题` : "全部匹配题目"}</strong>
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
