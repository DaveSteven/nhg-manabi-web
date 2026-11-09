import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  History,
  Headphones,
  Languages,
  Layers3,
  NotebookPen,
  RotateCcw,
  Search,
  Target,
  Trophy,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  LEVELS,
  SUBJECTS,
  api,
  assetSrc,
  buildExamProblemSections,
  buildReviewProblemGroups,
  calculateExamScore,
  countAnsweredQuestions,
  examPartLabel,
  examQuestionCategoryLabel,
  examPassMark,
  examQuestionDisplayNumber,
  examSectionsForLevel,
  formatDate,
  groupQuestionsByPassage,
  groupReviewItemsByPassage,
  isListeningQuestion,
  isReadingQuestion,
  latestExamAttemptByExam,
  pct,
  subjectLabel,
} from "../lib/study";
import UiSelect from "../components/UiSelect";

export function Shell({ children }) {
  return (
    <main className="app-shell">
      <section className="app-frame">{children}</section>
    </main>
  );
}

export function LibraryView({
  books,
  exams,
  booksLoading,
  level,
  subject,
  attempts,
  examAttempts,
  wrongItems,
  bookStats,
  currentUser,
  onLevel,
  onSubject,
  onStart,
  onOpenGrammarPractice,
  onOpenVocabularyPractice,
  onOpenReadingPractice,
  onOpenExamList,
  onOpenListening,
  onOpenVocabulary,
  onOpenWrongBook,
  onOpenUser,
  onSearch,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const currentAttempts = attempts.filter(
    (item) => item.level === level && item.subject === subject,
  );
  const totalCorrect = currentAttempts.reduce(
    (sum, item) => sum + item.correct,
    0,
  );
  const totalQuestions = currentAttempts.reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const currentSubjectLabel = subjectLabel(subject);
  const questionPool = books.reduce(
    (sum, book) => sum + book.question_count,
    0,
  );
  const latestExamAttempt = examAttempts[0];

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand-title">JLPT <span>GO!</span></h1>
        </div>
        <div className="top-actions">
          <form
            className="home-search compact"
            onSubmit={(event) => {
              event.preventDefault();
              const query = searchQuery.trim();
              if (query.length >= 2) onSearch(query);
            }}
          >
            <Search size={19} aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索题目"
              aria-label="搜索题目"
            />
            <button type="submit" disabled={searchQuery.trim().length < 2}>搜索</button>
          </form>
          <UiSelect
            className="home-level-select"
            label="等级"
            ariaLabel="JLPT 等级"
            compact
            value={level}
            options={LEVELS.map((item) => ({ value: item, label: item }))}
            onChange={onLevel}
          />
          <button
            className="wrong-icon-button"
            onClick={onOpenWrongBook}
            type="button"
            aria-label="错题本"
          >
            <NotebookPen size={23} />
            {wrongItems.length ? (
              <span className="wrong-badge">{wrongItems.length}</span>
            ) : null}
          </button>
          <button
            className="avatar-button"
            onClick={onOpenUser}
            type="button"
            aria-label="用户资料"
          >
            <span>{currentUser?.display_name?.slice(0, 1) || "D"}</span>
          </button>
        </div>
      </header>

      <section className="home-section">
        <div className="home-section-heading">
          <div><h2>开始练习</h2><p>选择专项训练，或进行完整模拟考试</p></div>
        </div>
        <div className="home-module-grid">
          <article className="home-training-module featured">
            <div className="home-module-heading"><div><Target size={25} /><span><strong>专项练习</strong><small>针对不同能力单独强化</small></span></div><em>推荐</em></div>
            <div className="home-module-actions">
              <button onClick={onOpenVocabularyPractice} disabled={!exams.length} type="button"><Languages size={22} /><span><strong>文字词汇专项</strong><small>读音、词义和用法强化</small></span><ChevronRight size={19} /></button>
              <button onClick={onOpenGrammarPractice} disabled={!exams.length} type="button"><BrainCircuit size={22} /><span><strong>文法专项</strong><small>按题型、试卷和题量组题</small></span><ChevronRight size={19} /></button>
              <button onClick={onOpenReadingPractice} disabled={!exams.length} type="button"><BookOpen size={22} /><span><strong>读解专项</strong><small>短篇、长篇和信息检索</small></span><ChevronRight size={19} /></button>
              <button onClick={onOpenListening} type="button"><Headphones size={22} /><span><strong>听力专项</strong><small>按试卷逐题精听与循环</small></span><ChevronRight size={19} /></button>
            </div>
          </article>
          <article className="home-training-module exam-module">
            <div className="home-module-heading"><div><ClipboardList size={25} /><span><strong>模拟考试</strong><small>按照正式考试结构完成整套试卷</small></span></div></div>
            <div className="home-exam-summary"><strong>{exams.length}</strong><span>{level} 历年试卷</span>{latestExamAttempt ? <small>最近成绩 {pct(latestExamAttempt.correct, latestExamAttempt.total)}%</small> : <small>尚未参加考试</small>}</div>
            <button className="primary-button" onClick={onOpenExamList} type="button">选择模拟试卷 <ArrowRight size={19} /></button>
          </article>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <div><h2>基础题库</h2><p>选择知识领域后，按课练习</p></div>
        </div>
        <div className="subject-library-tabs" role="tablist" aria-label="题目科目">
          {SUBJECTS.map((item, index) => {
            const Icon = [BrainCircuit, BookOpen, Layers3][index];
            return (
              <button key={item.id} className={subject === item.id ? `active subject-${item.id}` : ""} onClick={() => onSubject(item.id)} type="button">
                <Icon size={21} /><strong>{item.label}</strong>{subject === item.id && !booksLoading ? <span>{questionPool}题</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="book-grid home-book-grid" aria-busy={booksLoading}>
        {booksLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <article className="book-card book-card-skeleton" key={index} aria-hidden="true">
              <div className="skeleton-line skeleton-badge" />
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-meta" />
              <div className="skeleton-line skeleton-progress" />
            </article>
          ))
        ) : books.length ? (
          books.map((book) => {
            const stats = bookStats.get(book.id);
            return (
              <article className="book-card" key={book.id}>
                <div className="book-card-main">
                  <div className={`book-badge subject-${book.subject}`}>
                    {book.categoryLabel}
                  </div>
                  <h2 className="book-display-number">{book.displayName}</h2>
                  <div className="book-meta">
                    <span>{book.question_count} 道题</span>
                    {stats ? <span>最高 {stats.best}%</span> : <span>未练习</span>}
                  </div>
                  <Progress
                    value={stats ? pct(stats.correct, stats.total) : 0}
                  />
                </div>
                <button
                  className="start-button"
                  onClick={() => onStart(book)}
                  type="button"
                  aria-label={`开始 ${book.book_name}`}
                >
                  <ChevronRight size={24} />
                </button>
              </article>
            );
          })
        ) : (
          <div className="empty-books">
            <strong>
              {level} {currentSubjectLabel}
            </strong>
            <span>该分类暂时没有题目。</span>
          </div>
        )}
      </section>

      <section className="home-review-grid">
        <div className="home-study-summary">
          <small>当前分类</small><strong>{pct(totalCorrect, totalQuestions)}%</strong><span>{currentAttempts.length} 次练习</span>
        </div>
        <button onClick={onOpenWrongBook} type="button"><RotateCcw size={22} /><span><strong>错题复习</strong><small>{wrongItems.length ? `${wrongItems.length} 题待复习` : "暂无错题"}</small></span><ChevronRight size={20} /></button>
        <button onClick={onOpenUser} type="button"><History size={22} /><span><strong>学习记录</strong><small>查看成绩与练习历史</small></span><ChevronRight size={20} /></button>
      </section>
    </>
  );
}

const SEARCH_CATEGORIES = [
  { value: "", label: "全部分类" },
  { value: "vocabulary", label: "文字词汇" },
  { value: "grammar", label: "文法" },
  { value: "reading", label: "读解" },
  { value: "listening", label: "听力" },
];

const SEARCH_SOURCES = [
  { value: "", label: "全部来源" },
  { value: "library", label: "基础题库" },
  { value: "exam", label: "历年试卷" },
];

export function cleanSearchText(text) {
  const withoutMarkup = String(text || "")
    .replace(/<MOJITest_URL>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const decoder = document.createElement("textarea");
  decoder.innerHTML = withoutMarkup;
  return decoder.value
    .replace(/\u00a0/g, " ")
    .replace(/_{2,}/g, "＿＿")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function HighlightedText({ text, query }) {
  const value = cleanSearchText(text);
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return value;
  const index = value.toLocaleLowerCase().indexOf(normalizedQuery.toLocaleLowerCase());
  if (index < 0) return value;
  return <>{value.slice(0, index)}<mark>{value.slice(index, index + normalizedQuery.length)}</mark>{value.slice(index + normalizedQuery.length)}</>;
}

export function SearchView({ token, currentLevel, onBack }) {
  const initialQuery = new URLSearchParams(window.location.search).get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [level, setLevel] = useState(currentLevel);
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (submittedQuery.trim().length < 2) return;
    let ignore = false;
    const params = new URLSearchParams({ q: submittedQuery.trim(), page: String(page), page_size: "20" });
    if (level) params.set("level", level);
    if (category) params.set("category", category);
    if (source) params.set("source", source);
    window.history.replaceState(null, "", `/search?${params.toString()}`);
    setLoading(true);
    setError("");
    api(`/api/search/questions?${params.toString()}`, {}, token)
      .then((data) => { if (!ignore) setResult(data); })
      .catch((err) => { if (!ignore) setError(err.message || "搜索失败"); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [submittedQuery, level, category, source, page, token]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
  const submit = (event) => {
    event.preventDefault();
    const next = query.trim();
    if (next.length < 2) return;
    setPage(1);
    setSubmittedQuery(next);
  };

  return (
    <section className="search-page">
      <header className="quiz-header search-header">
        <button className="back-button" onClick={onBack} type="button"><ArrowLeft size={20} />返回首页</button>
        <div><div className="eyebrow">全题库检索</div><h1>搜索题目</h1></div>
      </header>

      <form className="search-panel" onSubmit={submit}>
        <div className="search-input-row">
          <Search size={22} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入至少 2 个字符" autoFocus aria-label="搜索关键词" />
          <button className="primary-button" type="submit" disabled={query.trim().length < 2}>搜索</button>
        </div>
        <div className="search-filters">
          <UiSelect label="等级" value={level} options={[{ value: "", label: "全部等级" }, ...LEVELS.map((item) => ({ value: item, label: item }))]} onChange={(value) => { setLevel(value); setPage(1); }} />
          <UiSelect label="分类" value={category} options={SEARCH_CATEGORIES} onChange={(value) => { setCategory(value); setPage(1); }} />
          <UiSelect label="来源" value={source} options={SEARCH_SOURCES} onChange={(value) => { setSource(value); setPage(1); }} />
        </div>
      </form>

      <div className="search-summary">{loading ? "正在搜索…" : error ? "搜索遇到问题" : `找到 ${result.total} 道题`}</div>
      {error ? <div className="center-state error">{error}</div> : null}
      {!loading && !error && !result.items.length ? <div className="search-empty"><Search size={32} /><strong>没有找到相关题目</strong><span>试试缩短关键词，或选择“全部等级”。</span></div> : null}
      <div className="search-results" aria-busy={loading}>
        {result.items.map((item) => (
          <article className="search-result-card" key={`${item.source}:${item.id}`}>
            <div className="search-result-meta"><span>{item.level}</span><span>{item.category_label}</span><span>{item.source_label}</span><span>{item.source_title}</span></div>
            <h2><HighlightedText text={item.stem} query={submittedQuery} /></h2>
            {item.options?.length ? <ol className="search-result-options">{item.options.map((option) => <li key={option.id}><HighlightedText text={option.text} query={submittedQuery} /></li>)}</ol> : null}
          </article>
        ))}
      </div>
      {result.total > result.page_size ? <nav className="search-pagination" aria-label="搜索结果分页"><button className="secondary-button" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={18} />上一页</button><span>{page} / {totalPages}</span><button className="secondary-button" type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>下一页<ArrowRight size={18} /></button></nav> : null}
    </section>
  );
}

export function ExamListView({
  exams,
  level,
  examAttempts,
  examRuns = [],
  onBack,
  onStartExam,
  onResumeExam,
  onAbandonExam,
  onReviewAttempt,
}) {
  const examStats = latestExamAttemptByExam(examAttempts);
  const activeRuns = new Map<number, any>(examRuns.map((run) => [run.exam_id, run]));
  const orderedExams = [...exams].sort(
    (left, right) => Number(activeRuns.has(right.id)) - Number(activeRuns.has(left.id)),
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function remainingInfo(run) {
    if (run.status === "awaiting_section") {
      return { label: "科间休息", value: "等待开始", resting: true };
    }
    const value = run.section_expires_at;
    if (!value) return { label: "考试进行中", value: "计时中", resting: false };
    const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
    const seconds = Math.max(0, Math.ceil((new Date(normalized).getTime() - now) / 1000));
    return {
      label: "本科剩余",
      value: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
      resting: false,
    };
  }

  return (
    <section className="exam-list-view">
      <header className="quiz-header">
        <button
          className="icon-button"
          onClick={onBack}
          type="button"
          aria-label="返回"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <div className="eyebrow">考试题库</div>
          <h1>模拟考试</h1>
        </div>
      </header>

      {exams.length ? (
        <div className="exam-list">
          {orderedExams.map((exam) => {
            const last = examStats.get(exam.id);
            const activeRun = activeRuns.get(exam.id);
            const remaining = activeRun ? remainingInfo(activeRun) : null;
            return (
              <article className={`exam-card ${activeRun ? "active-run" : ""}`} key={exam.id}>
                <div className={activeRun ? "active-run-main" : ""}>
                  {activeRun ? <div className="active-run-identity"><div className="active-run-kicker"><Clock3 size={17} />继续上次考试</div><div><span className="book-badge subject-reading">{exam.level}</span><h3>{exam.title}</h3></div></div> : <><div className="book-badge subject-reading">{exam.level}</div><h3>{exam.title}</h3></>}
                  {activeRun && remaining ? <div className={`exam-run-status ${remaining.resting ? "resting" : ""}`}>
                    <div><span>当前科目</span><strong>{activeRun.sections[activeRun.current_section]?.label}</strong></div>
                    <div className="exam-run-countdown"><Clock3 size={18} /><span>{remaining.label}</span><strong>{remaining.value}</strong></div>
                  </div> : null}
                  {last ? <p>最近成绩 {pct(last.correct, last.total)}%</p> : null}
                </div>
                <div className="exam-card-actions">
                  {last ? (
                    <button
                      className="secondary-button review-exam-button"
                      onClick={() => onReviewAttempt(last)}
                      type="button"
                    >
                      查看解析
                    </button>
                  ) : null}
                  {activeRun ? <><button className="secondary-button" onClick={() => onAbandonExam(exam, activeRun)} type="button">放弃</button><button className="primary-button" onClick={() => onResumeExam(exam, activeRun)} type="button">继续考试</button></> : <button
                    className="start-button"
                    onClick={() => onStartExam(exam)}
                    type="button"
                    aria-label={`开始 ${exam.title}`}
                  >
                    <ChevronRight size={24} />
                  </button>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-books">
          <strong>{level} 考试题库</strong>
          <span>该等级暂时没有考试数据。</span>
        </div>
      )}
    </section>
  );
}

export function ExamIntroView({ exam, onBack, onStart, starting = false }) {
  const sections = examSectionsForLevel(exam.level);
  const totalMinutes = sections.reduce((sum, section) => sum + section.durationMinutes, 0);
  return (
    <section className="exam-intro-view">
      <header className="quiz-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="返回"><ArrowLeft size={22} /></button>
        <div><div className="eyebrow">JLPT 标准模拟考试</div><h1>{exam.title}</h1><p>{exam.level} · 共 {exam.questionCount || exam.question_count || 0} 题</p></div>
      </header>
      <section className="exam-intro-card">
        <div className="exam-intro-summary"><Clock3 size={30} /><div><span>预计考试用时</span><strong>{totalMinutes} 分钟</strong></div></div>
        <div className="exam-section-schedule">
          {sections.map((section, index) => <div key={section.key}><span>{index + 1}</span><div><strong>{section.label}</strong><small>{section.durationMinutes} 分钟</small></div></div>)}
        </div>
        <ul className="exam-rules">
          <li>每科独立计时，到时自动提交并锁定本科答案。</li>
          <li>进入下一科后不能返回上一科修改答案。</li>
          <li>刷新或暂时离开页面不会暂停倒计时。</li>
          <li>科目之间不计时，确认后才开始下一科。</li>
        </ul>
        <div className="result-actions"><button className="primary-button" onClick={onStart} disabled={starting} type="button">{starting ? "正在加载试卷资源…" : "确认并开始第一科"}</button><button className="secondary-button" onClick={() => document.documentElement.requestFullscreen?.()} disabled={starting} type="button">全屏考试</button><button className="secondary-button" onClick={onBack} disabled={starting} type="button">返回试卷列表</button></div>
      </section>
    </section>
  );
}

export function ExamSectionBreakView({ session, onStartNext, starting = false }) {
  const section = session.run.sections[session.run.current_section];
  function testAudio() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain); gain.connect(context.destination); gain.gain.value = 0.08; oscillator.frequency.value = 440;
    oscillator.start(); oscillator.stop(context.currentTime + 0.7); oscillator.onended = () => context.close();
  }
  return <section className="exam-intro-view"><div className="exam-intro-card exam-break-card"><div className="book-badge subject-reading">上一科已提交</div><h1>准备开始：{section.label}</h1><p>本部分考试时间为 {section.duration_minutes} 分钟。点击后立即开始计时，之后不能返回上一科。</p>{section.key === "listening" ? <section className="listening-device-check"><Headphones size={28} /><div><strong>听力设备检查</strong><span>请佩戴耳机并确认能听到测试音。</span></div><button className="secondary-button" onClick={testAudio} disabled={starting} type="button">播放测试音</button></section> : null}<div className="result-actions"><button className="primary-button" onClick={onStartNext} disabled={starting} type="button">{starting ? "正在开始…" : "开始本部分"}</button><button className="secondary-button" onClick={() => document.documentElement.requestFullscreen?.()} disabled={starting} type="button">进入全屏</button></div></div></section>;
}

export const PRACTICE_CATEGORIES = {
  vocabulary: {
    label: "文字词汇",
    eyebrow: "文字词汇练习",
    types: [
      { id: 11, label: "汉字读音", description: "选择汉字的正确读音" },
      { id: 12, label: "汉字书写", description: "选择假名对应的正确汉字" },
      { id: 13, label: "词语构成", description: "选择符合构词规则的表达" },
      { id: 14, label: "语境填空", description: "根据句子语境选择词语" },
      { id: 15, label: "近义替换", description: "选择意义最接近的表达" },
      { id: 16, label: "词语用法", description: "判断词语使用正确的句子" },
    ],
  },
  grammar: {
    label: "文法",
    eyebrow: "文法练习",
    types: [
      { id: 21, label: "文法填空", description: "选择最适合句中空格的表达" },
      { id: 22, label: "句子排序", description: "判断 ★ 位置应放入的内容" },
      { id: 23, label: "文章填空", description: "结合整篇文章选择合适表达" },
    ],
  },
  reading: {
    label: "读解",
    eyebrow: "阅读练习",
    types: [
      { id: 31, label: "短篇理解", description: "阅读短文并回答问题" },
      { id: 32, label: "中篇理解", description: "理解文章结构和主要内容" },
      { id: 33, label: "对比阅读", description: "比较两篇文章或不同观点" },
      { id: 34, label: "综合理解", description: "综合分析文章内容" },
      { id: 35, label: "长篇理解", description: "阅读长文并理解作者意图" },
      { id: 36, label: "信息检索", description: "从通知和资料中查找信息" },
    ],
  },
};

export function GrammarPracticeSetupView({ exams, level, category = "grammar", onBack, onStart }) {
  const practiceCategory = PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar;
  const [mode, setMode] = useState("random");
  const [examId, setExamId] = useState(exams[0]?.id ? String(exams[0].id) : "");
  const [types, setTypes] = useState(practiceCategory.types.map((type) => type.id));
  const [count, setCount] = useState(20);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");

  function toggleType(type) {
    setTypes((current) => current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type]);
  }

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
      <header className="quiz-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="返回"><ArrowLeft size={22} /></button>
        <div className="grammar-practice-title"><div className="eyebrow">{practiceCategory.eyebrow}</div><h1>{level} {practiceCategory.label}专项</h1><p>按需要组合题型、来源和练习数量</p></div>
      </header>

      <form onSubmit={submit}>
        <section className="practice-config-section">
          <div className="practice-config-heading"><span>1</span><div><h2>选择题目来源</h2><p>可以指定一张试卷，也可以跨试卷随机抽题</p></div></div>
          <div className="practice-source-grid">
            <label className={mode === "random" ? "selected" : ""}><input type="radio" name="source" checked={mode === "random"} onChange={() => setMode("random")} /><Target size={23} /><span><strong>全部试卷随机</strong><small>从 {level} 历年试卷中打乱抽取</small></span></label>
            <label className={mode === "exam" ? "selected" : ""}><input type="radio" name="source" checked={mode === "exam"} onChange={() => setMode("exam")} /><ClipboardList size={23} /><span><strong>指定试卷</strong><small>只练习一张试卷中的{practiceCategory.label}题</small></span></label>
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
        </section>

        <section className="practice-config-section">
          <div className="practice-config-heading"><span>2</span><div><h2>选择{practiceCategory.label}题型</h2><p>可同时选择多种题型</p></div></div>
          <div className="practice-type-grid">
            {practiceCategory.types.map((item) => <label className={types.includes(item.id) ? "selected" : ""} key={item.id}><input type="checkbox" checked={types.includes(item.id)} onChange={() => toggleType(item.id)} /><Check size={20} /><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}
          </div>
        </section>

        {mode === "random" ? (
          <section className="practice-config-section practice-count-section">
            <div className="practice-config-heading"><span>3</span><div><h2>设置题目数量</h2><p>实际题量不会超过所选范围内的可用题目</p></div></div>
            <div className="practice-count-options">{[5, 10, 20, 30].map((value) => <button className={count === value ? "selected" : ""} onClick={() => setCount(value)} type="button" key={value}>{value}题</button>)}<label><input type="number" min="1" max="100" value={count} onChange={(event) => setCount(Number(event.target.value))} /><span>题</span></label></div>
          </section>
        ) : null}

        {message ? <p className="form-error" role="alert">{message}</p> : null}
        <div className="practice-start-bar"><div><strong>{types.length} 种题型 · {mode === "random" ? `${count || 0} 题` : "全部匹配题目"}</strong><span>{mode === "random" ? `${level} 全部试卷随机` : exams.find((exam) => String(exam.id) === examId)?.title}</span></div><button className="primary-button" disabled={!types.length || !exams.length || starting} type="submit">{starting ? "正在组题…" : "开始专项练习"} {!starting ? <ArrowRight size={19} /> : null}</button></div>
      </form>
    </section>
  );
}

const VOCABULARY_POS = {
  noun: "名词",
  verb: "动词",
  adverb: "副词",
};

const VOCABULARY_STATUS = {
  new: "未学习",
  learning: "学习中",
  mastered: "已掌握",
};

const TRANSITIVITY_LABEL = {
  transitive: "他动词",
  intransitive: "自动词",
  both: "自他两用",
};

const RELATION_LABEL = {
  synonym: "近义词",
  antonym: "反义词",
  related: "相关词",
};

export function VocabularyView({ entries, stats, onBack, onReview }) {
  const [lesson, setLesson] = useState("all");
  const [partOfSpeech, setPartOfSpeech] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        const normalizedQuery = query.trim().toLowerCase();
        return (
          (lesson === "all" || entry.lesson === Number(lesson)) &&
          (partOfSpeech === "all" || entry.part_of_speech === partOfSpeech) &&
          (status === "all" || entry.study_status === status) &&
          (!normalizedQuery ||
            [
              entry.word,
              entry.reading_hiragana,
              entry.reading_katakana,
              entry.meaning_zh,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(normalizedQuery),
            ))
        );
      }),
    [entries, lesson, partOfSpeech, status, query],
  );

  const currentIndex = filtered.length ? index % filtered.length : 0;
  const entry = filtered[currentIndex];

  function updateFilter(setter, value) {
    setter(value);
    setIndex(0);
    setRevealed(false);
  }

  function move(step) {
    if (!filtered.length) return;
    setIndex((value) => (value + step + filtered.length) % filtered.length);
    setRevealed(false);
  }

  async function review(remembered) {
    if (!entry || saving) return;
    setSaving(true);
    try {
      await onReview(entry.id, remembered);
      move(1);
    } finally {
      setSaving(false);
    }
  }

  const groupedRelations: Record<string, any[]> = entry
    ? (entry.relations || []).reduce((groups, item) => {
        if (!groups[item.type]) groups[item.type] = [];
        groups[item.type].push(item);
        return groups;
      }, {})
    : {};

  return (
    <section className="vocabulary-page">
      <header className="quiz-header vocabulary-header">
        <button
          className="icon-button"
          onClick={onBack}
          type="button"
          aria-label="返回"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="vocabulary-title">
          <div className="eyebrow">词汇卡片</div>
          <h1>高频词汇本</h1>
          <p>新版标准日本语中级上册 · 三星词汇</p>
        </div>
      </header>

      <section className="vocabulary-stats" aria-label="词汇学习进度">
        <div>
          <strong>{stats.total}</strong>
          <span>词汇</span>
        </div>
        <div>
          <strong>{stats.new}</strong>
          <span>未学习</span>
        </div>
        <div>
          <strong>{stats.learning}</strong>
          <span>学习中</span>
        </div>
        <div>
          <strong>{stats.mastered}</strong>
          <span>已掌握</span>
        </div>
      </section>

      <section className="vocabulary-filters">
        <label className="vocabulary-search">
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => updateFilter(setQuery, event.target.value)}
            placeholder="按单词、读音或中文搜索"
          />
        </label>
        <select
          value={lesson}
          onChange={(event) => updateFilter(setLesson, event.target.value)}
        >
          <option value="all">全部 16 课</option>
          {Array.from({ length: 16 }, (_, value) => value + 1).map((value) => (
            <option key={value} value={value}>
              第 {value} 课
            </option>
          ))}
        </select>
        <select
          value={partOfSpeech}
          onChange={(event) =>
            updateFilter(setPartOfSpeech, event.target.value)
          }
        >
          <option value="all">全部词性</option>
          <option value="noun">名词</option>
          <option value="verb">动词</option>
          <option value="adverb">副词</option>
        </select>
        <select
          value={status}
          onChange={(event) => updateFilter(setStatus, event.target.value)}
        >
          <option value="all">全部进度</option>
          <option value="new">未学习</option>
          <option value="learning">学习中</option>
          <option value="mastered">已掌握</option>
        </select>
      </section>

      {entry ? (
        <>
          <article className={`vocabulary-card ${revealed ? "revealed" : ""}`}>
            <div className="vocabulary-card-meta">
              <span
                className={`vocabulary-status status-${entry.study_status}`}
              >
                {VOCABULARY_STATUS[entry.study_status]}
              </span>
            </div>
            <div className="vocabulary-word-block">
              <h2>{entry.word}</h2>
              <div>
                {VOCABULARY_POS[entry.part_of_speech]}
                {entry.transitivity
                  ? ` · ${TRANSITIVITY_LABEL[entry.transitivity]}`
                  : ""}
              </div>
              <div className="vocabulary-readings">
                <span>{entry.reading_hiragana}</span>
                <span>{entry.reading_katakana}</span>
              </div>
            </div>

            {revealed ? (
              <div className="vocabulary-details">
                <section className="vocabulary-meaning">
                  <span>释义</span>
                  <strong>{entry.meaning_zh}</strong>
                </section>

                {Object.entries(groupedRelations).map(([type, items]) => (
                  <section className="vocabulary-detail-section" key={type}>
                    <h3>{RELATION_LABEL[type] || "相关词"}</h3>
                    <div className="vocabulary-tags">
                      {items.map((item, itemIndex) => (
                        <span
                          className={
                            item.term === "無自然対応"
                              ? "no-natural-relation"
                              : ""
                          }
                          key={`${item.term}-${itemIndex}`}
                        >
                          {item.term === "無自然対応"
                            ? "没有自然对应词"
                            : item.term}
                          {item.term_reading_katakana ? (
                            <small>{item.term_reading_katakana}</small>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </section>
                ))}

                {entry.collocations?.length ? (
                  <section className="vocabulary-detail-section">
                    <h3>固定搭配</h3>
                    <div className="vocabulary-tags collocation-tags">
                      {entry.collocations.map((item, itemIndex) => (
                        <span key={`${item}-${itemIndex}`}>{item}</span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {entry.examples?.length ? (
                  <section className="vocabulary-detail-section">
                    <h3>例句</h3>
                    <ul className="vocabulary-examples">
                      {entry.examples.map((item, itemIndex) => {
                        const sentence =
                          typeof item === "string" ? item : item.sentence;
                        const reading =
                          typeof item === "string" ? "" : item.reading_katakana;
                        return (
                          <li key={`${sentence}-${itemIndex}`}>
                            <strong>{sentence}</strong>
                            {reading ? <small>{reading}</small> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
              </div>
            ) : (
              <button
                className="reveal-vocabulary"
                type="button"
                onClick={() => setRevealed(true)}
              >
                查看释义
              </button>
            )}
          </article>

          <div className="vocabulary-card-footer">
            <button
              className="secondary-button"
              onClick={() => move(-1)}
              type="button"
            >
              上一个
            </button>
            <span>
              {currentIndex + 1} / {filtered.length}
            </span>
            {revealed ? (
              <div className="vocabulary-review-actions">
                <button
                  className="review-again"
                  disabled={saving}
                  onClick={() => review(false)}
                  type="button"
                >
                  再学习一次
                </button>
                <button
                  className="review-known"
                  disabled={saving}
                  onClick={() => review(true)}
                  type="button"
                >
                  已记住
                </button>
              </div>
            ) : (
              <button
                className="secondary-button"
                onClick={() => move(1)}
                type="button"
              >
                下一个
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="empty-books">
          <strong>没有符合条件的词汇</strong>
          <span>请修改搜索条件。</span>
        </div>
      )}
    </section>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function WrongBookEntry({ items, onOpen }) {
  return (
    <section className="wrong-entry">
      <div>
        <div className="section-title compact">
          <X size={22} />
          <h2>错题本</h2>
        </div>
        <p>
          {items.length
            ? `${items.length} 道题需要复习`
            : "该分类暂无错题。"}
        </p>
      </div>
      <button
        className="secondary-button"
        onClick={onOpen}
        type="button"
        disabled={!items.length}
      >
        View
      </button>
    </section>
  );
}

export function WrongBookView({ level, items, onBack, onReview, onReviewPractice }) {
  const libraryItems = items.filter((item) => item.source === "library");
  const practiceCategories = Object.keys(PRACTICE_CATEGORIES).filter((category) =>
    items.some((item) => item.source === "practice" && item.subject === category),
  );
  return (
    <section className="wrong-page">
      <header className="quiz-header">
        <button
          className="icon-button"
          onClick={onBack}
          type="button"
          aria-label="返回"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="wrong-page-title">
          <div className="book-pill subject-kanji">错题本</div>
          <p>
            {level} · {items.length} 道题
          </p>
        </div>
      </header>

      {items.length ? (
        <section className="wrong-review-card">
          <div>
            <div className="book-badge subject-kanji">{level} 错题</div>
            <h2>错题复习</h2>
            <p>
              从错题中随机抽取最多 20 题。答对后会自动移出错题本。
            </p>
          </div>
          <div className="wrong-review-actions">
            {libraryItems.length ? <button className="primary-button" onClick={onReview} type="button">基础题库错题</button> : null}
            {practiceCategories.map((category) => (
              <button className="secondary-button" onClick={() => onReviewPractice(category)} type="button" key={category}>
                {PRACTICE_CATEGORIES[category].label}错题
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {items.length ? (
        <div className="wrong-list">
          {items.map((item) => (
            <article className="wrong-item" key={item.key}>
              <div className="wrong-count">{item.wrongCount}</div>
              <div>
                <h3>{item.stem}</h3>
                <p>
                  正确答案：<HtmlInline html={item.answerText} />
                  {item.lastChosenText ? (
                    <>
                      {" "}
                      / Last: <HtmlInline html={item.lastChosenText} />
                    </>
                  ) : (
                    ""
                  )}
                </p>
                <small>
                  {item.subjectLabel} · {item.bookName}
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-history">该分类暂无错题。</p>
      )}
    </section>
  );
}

export function LoginView({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    try {
      await onLogin({ username: username.trim(), password });
    } catch (err) {
      setMessage(
        "登录失败，请检查用户名和密码。",
      );
    }
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-title">JLPT <span>GO!</span></div>
          <p>登录后继续你的 JLPT 学习</p>
        </div>

        <form className="new-user-form" onSubmit={submit}>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="例：david"
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              type="password"
            />
          </label>
          {message ? <p className="form-error">{message}</p> : null}
          <button
            className="primary-button"
            type="submit"
            disabled={!username.trim() || !password}
          >
            登录
          </button>
        </form>
      </div>
    </section>
  );
}

export function UserView({ currentUser, attempts, onBack, onLogout, onRegisterUser }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");
  const [registerError, setRegisterError] = useState("");

  async function submitRegistration(event) {
    event.preventDefault();
    setRegistering(true);
    setRegisterMessage("");
    setRegisterError("");
    try {
      const user = await onRegisterUser({
        username: username.trim(),
        display_name: displayName.trim(),
        password,
      });
      setRegisterMessage(`用户 ${user.display_name}（@${user.username}）已创建。`);
      setUsername("");
      setDisplayName("");
      setPassword("");
    } catch (error) {
      setRegisterError(error.message || "创建用户失败，请稍后重试。");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <section className="user-page">
      <header className="quiz-header">
        <button
          className="icon-button"
          onClick={onBack}
          type="button"
          aria-label="返回"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="wrong-page-title">
          <div className="book-pill">个人资料</div>
        </div>
      </header>

      <section className="profile-card">
        <div className="profile-avatar">
          <span>{currentUser?.display_name?.slice(0, 1) || "D"}</span>
        </div>
        <div>
          <h2>{currentUser?.display_name || "David"}</h2>
          <p>@{currentUser?.username || "david"}</p>
        </div>
      </section>

      {currentUser?.username === "david" ? (
        <section className="profile-admin-card">
          <div className="section-title">
            <UserRoundPlus size={22} />
            <div>
              <h2>注册用户</h2>
              <p>仅 David 管理员可以创建新用户。</p>
            </div>
          </div>
          <form className="new-user-form" onSubmit={submitRegistration}>
            <label>
              显示名称
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：小明" />
            </label>
            <label>
              用户名
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="例如：xiaoming" autoCapitalize="none" />
            </label>
            <label>
              初始密码
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入初始密码" type="password" />
            </label>
            {registerError ? <p className="form-error" role="alert">{registerError}</p> : null}
            {registerMessage ? <p className="form-success" role="status">{registerMessage}</p> : null}
            <button className="primary-button" type="submit" disabled={registering || !username.trim() || !displayName.trim() || !password}>
              {registering ? "正在创建…" : "创建用户"}
            </button>
          </form>
        </section>
      ) : null}

      <HistoryPanel attempts={attempts} />

      <button
        className="secondary-button logout-button"
        onClick={onLogout}
        type="button"
      >
        退出登录
      </button>
    </section>
  );
}

function Progress({ value }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.max(4, value)}%` }} />
    </div>
  );
}

function cleanHtml(html) {
  if (!html) return "";
  return String(html).replace(/<\/?MOJiTest_URL>/g, "");
}

function cleanInlineHtml(html) {
  return cleanHtml(html)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]*\n[ \t]*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hasVisibleHtml(html) {
  const cleaned = cleanHtml(html);
  if (!cleaned) return false;
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(cleaned, "text/html");
    return Boolean((doc.body.textContent || "").replace(/\u00a0/g, " ").trim());
  }
  return Boolean(cleaned.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim());
}

function HtmlContent({ html }) {
  if (!html) return null;
  return (
    <div
      className="html-content"
      dangerouslySetInnerHTML={{ __html: cleanHtml(html) }}
    />
  );
}

function InlineHtmlContent({ html }) {
  if (!html) return null;
  return (
    <div
      className="html-content"
      dangerouslySetInnerHTML={{ __html: cleanInlineHtml(html) }}
    />
  );
}

function htmlParagraphs(html) {
  const cleaned = cleanHtml(html);
  if (!cleaned) return [];

  if (typeof DOMParser === "undefined") return [cleaned];

  const doc = new DOMParser().parseFromString(
    `<section>${cleaned}</section>`,
    "text/html",
  );
  const paragraphs = Array.from(doc.body.querySelectorAll("p"))
    .map((node) => cleanHtml(node.innerHTML).trim())
    .filter(Boolean);

  return paragraphs.length ? paragraphs : [cleaned];
}

function BilingualTranscript({
  sourceHtml,
  translationHtml,
  variant = "listening",
}) {
  const [showTranslation, setShowTranslation] = useState(false);
  const sourceLines = htmlParagraphs(sourceHtml);
  const translationLines = htmlParagraphs(translationHtml);
  const maxLines = Math.max(
    sourceLines.length,
    showTranslation ? translationLines.length : 0,
  );

  if (!maxLines) return null;

  return (
    <section
      className={`listening-transcript ${variant === "reading" ? "reading-transcript" : ""} ${showTranslation ? "with-translation" : ""}`}
    >
      {translationLines.length ? (
        <div className="bilingual-toolbar">
          <button
            className="bilingual-toggle"
            onClick={() => setShowTranslation((value) => !value)}
            type="button"
          >
            {showTranslation ? "隐藏中文译文" : "显示中文译文"}
          </button>
        </div>
      ) : null}
      {Array.from({ length: maxLines }).map((_, index) => (
        <div
          className="bilingual-line"
          key={`${index}-${sourceLines[index] || translationLines[index] || ""}`}
        >
          {sourceLines[index] ? (
            <HtmlContent html={sourceLines[index]} />
          ) : null}
          {showTranslation && translationLines[index] ? (
            <div className="translation-line">
              <HtmlContent html={translationLines[index]} />
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function HtmlInline({ html }) {
  if (!html) return null;
  return <span dangerouslySetInnerHTML={{ __html: cleanHtml(html) }} />;
}

export function RandomPracticeSessionView({ session, onBack, onChoose, onMove, onSubmit }) {
  const question = session.questions[session.index];
  const chosenOptionId = session.answers[question.id] || null;
  const isLast = session.index === session.questions.length - 1;

  return (
    <section className="random-practice-view">
      <header className="quiz-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="返回"><ArrowLeft size={22} /></button>
        <div className="quiz-progress"><Progress value={pct(session.index + 1, session.questions.length)} /><span>{session.index + 1} / {session.questions.length}</span></div>
      </header>
      <article className="random-practice-question">
        <div className="random-practice-meta"><span className="book-pill subject-reading">{session.exam.level} · {examQuestionCategoryLabel(question)}</span><small>{question.source_exam_title}</small></div>
        <div className="random-practice-number">第 {question.practice_order || session.index + 1} 题</div>
        {hasVisibleHtml(question.passage) ? <section className="exam-passage"><HtmlContent html={question.passage} /></section> : null}
        <div className="random-practice-title"><HtmlContent html={question.title} /></div>
        {question.image_url ? <img className="exam-image" src={assetSrc(question.image_url)} alt="" /> : null}
        <section className="options-grid exam-options">
          {question.options.map((option, index) => <button key={option.id} className={`option-button ${chosenOptionId === option.id ? "selected" : ""}`} onClick={() => onChoose(question.id, option.id)} type="button"><span className="option-letter">{index + 1}</span><span><HtmlInline html={option.text} /></span><span /></button>)}
        </section>
      </article>
      <footer className="exam-nav random-practice-nav">
        <button className="secondary-button" disabled={session.index === 0} onClick={() => onMove(session.index - 1)} type="button">上一题</button>
        {isLast ? <button className="primary-button" onClick={onSubmit} type="button">提交</button> : <button className="primary-button" onClick={() => onMove(session.index + 1)} type="button">下一题</button>}
      </footer>
    </section>
  );
}

export function ExamSessionView({
  session,
  onBack,
  onChoose,
  onMove,
  onSubmit,
  saveState = "idle",
  onRetrySave = () => {},
  submitting = false,
}) {
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerNotice, setTimerNotice] = useState("");
  const [listeningStarted, setListeningStarted] = useState(false);
  const [audioError, setAudioError] = useState("");
  const expiredRef = useRef(false);
  const previousRemainingRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const submitRef = useRef(onSubmit);
  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);
  const expiresAt = session.run?.section_expires_at;
  useEffect(() => {
    if (!expiresAt) return undefined;
    expiredRef.current = false;
    const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(expiresAt) ? expiresAt : `${expiresAt}Z`;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(normalized).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      const previous = previousRemainingRef.current;
      for (const [threshold, message] of [[600, "本科剩余 10 分钟"], [300, "本科剩余 5 分钟"], [60, "本科只剩 1 分钟"]] as const) {
        if (previous !== null && previous > threshold && remaining <= threshold) setTimerNotice(message);
      }
      previousRemainingRef.current = remaining;
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        submitRef.current(true);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  useEffect(() => {
    if (!session.run || session.run.status !== "in_progress") return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session.run?.id, session.run?.status]);
  const question = session.questions[session.index];
  const answeredCount = countAnsweredQuestions(session.questions, session.answers);
  const problemSections = buildExamProblemSections(
    session.exam,
    session.questions,
  );
  const questionIndexById = new Map(
    session.questions.map((item, index) => [item.id, index]),
  );
  const currentProblemIndex = Math.max(
    0,
    problemSections.findIndex((section) =>
      section.questions.some((item) => item.id === question.id),
    ),
  );
  const currentProblem =
    problemSections[currentProblemIndex] || problemSections[0];
  const problemPages = problemSections.flatMap((section, problemIndex) =>
    groupQuestionsByPassage(section.questions).map((group, groupIndex) => ({
      ...group,
      section,
      problemIndex,
      groupIndex,
    })),
  );
  const currentPageIndex = Math.max(0, problemPages.findIndex((page) =>
    page.questions.some((item) => item.id === question.id),
  ));
  const currentPage = problemPages[currentPageIndex] || {
    passage: "",
    questions: currentProblem?.questions || [],
    section: currentProblem,
  };
  const currentProblemPages = problemPages.filter((page) => page.problemIndex === currentProblemIndex);
  const currentProblemPageIndex = Math.max(0, currentProblemPages.findIndex((page) => page === currentPage));
  const currentRunSection = session.run?.sections?.[session.run.current_section];
  const isTimedListening = currentRunSection?.key === "listening";
  const currentAudioUrl = currentPage.questions.find((item) => item.media_url)?.media_url || "";
  const canPrev = currentPageIndex > 0;
  const canNext = currentPageIndex < problemPages.length - 1;
  const answerParts = [];

  for (const section of problemSections) {
    const currentPart = answerParts[answerParts.length - 1];
    if (currentPart?.label === section.partLabel) {
      currentPart.sections.push(section);
    } else {
      answerParts.push({ label: section.partLabel, sections: [section] });
    }
  }

  function moveToProblem(problemIndex) {
    const target = problemSections[problemIndex];
    const firstQuestion = target?.questions[0];
    if (!firstQuestion) return;
    onMove(questionIndexById.get(firstQuestion.id) || 0);
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  function moveToPage(pageIndex) {
    const target = problemPages[pageIndex];
    const firstQuestion = target?.questions[0];
    if (!firstQuestion) return;
    onMove(questionIndexById.get(firstQuestion.id) || 0);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  useEffect(() => {
    setAudioError("");
    if (!isTimedListening || !listeningStarted || !audioRef.current || !currentAudioUrl) return;
    audioRef.current.play().catch(() => {
      setListeningStarted(false);
      setAudioError("音频无法播放，请检查网络后重试。");
    });
  }, [currentPageIndex, currentAudioUrl, isTimedListening, listeningStarted]);

  function finishListeningAudio() {
    if (canNext) moveToPage(currentPageIndex + 1);
    else onSubmit(true);
  }

  return (
    <div className="exam-view">
      <header className="quiz-header">
        <button
          className="icon-button"
          onClick={onBack}
          type="button"
          aria-label="返回"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="quiz-progress">
          <Progress value={pct(answeredCount, session.questions.length)} />
          <span>
            {answeredCount} / {session.questions.length}
          </span>
        </div>
        <div className="exam-header-actions">
          {session.run ? <div className={`exam-timer ${remainingSeconds <= 300 ? "urgent" : ""}`}><Clock3 size={18} /><strong>{String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:{String(remainingSeconds % 60).padStart(2, "0")}</strong></div> : null}
          {session.run ? <button className={`exam-save-state ${saveState}`} onClick={saveState === "error" ? onRetrySave : undefined} disabled={saveState !== "error"} type="button">{saveState === "saving" ? "保存中…" : saveState === "error" ? "保存失败，点击重试" : "已保存"}</button> : null}
          {!isTimedListening ? <button
            className={`secondary-button answer-sheet-toggle ${showAnswerSheet ? "active" : ""}`}
            onClick={() => setShowAnswerSheet((value) => !value)}
            type="button"
            aria-expanded={showAnswerSheet}
            aria-pressed={showAnswerSheet}
          >
            <ClipboardList size={18} />
            {showAnswerSheet ? "收起答题卡" : "答题卡"}
          </button> : null}
          <button className="primary-button" onClick={() => onSubmit(false)} disabled={submitting || saveState === "saving"} type="button">
            {submitting ? "正在提交…" : session.run ? "提交本科" : "提交"}
          </button>
        </div>
      </header>

      <section className={`exam-layout ${showAnswerSheet ? "sheet-open" : ""}`}>
        {timerNotice ? <div className="exam-time-notice" role="status"><Clock3 size={18} />{timerNotice}<button onClick={() => setTimerNotice("")} type="button"><X size={16} /></button></div> : null}
        {showAnswerSheet ? (
          <aside className="answer-sheet">
            <div className="book-pill subject-reading">
              {session.exam.level} · {session.exam.title}
            </div>
            <div className="answer-section-list">
              {answerParts.map((part) => (
                <section className="answer-part" key={part.label}>
                  <div className="sheet-title">- {part.label} -</div>
                  {part.sections.map((section) => {
                    const sectionIndex = problemSections.findIndex(
                      (item) => item.id === section.id,
                    );
                    const sectionAnswered = section.questions.filter(
                      (item) => session.answers[item.id],
                    ).length;
                    const activeSection = section.id === currentProblem?.id;
                    return (
                      <section
                        className={`answer-section ${activeSection ? "active" : ""}`}
                        key={section.id}
                      >
                        <button
                          className="answer-section-title"
                          onClick={() => moveToProblem(sectionIndex)}
                          type="button"
                        >
                          <span>{section.problemLabel}</span>
                          <small>
                            {sectionAnswered}/{section.questions.length}
                          </small>
                        </button>
                        <div className="answer-grid">
                          {section.questions.map(
                            (item, sectionQuestionIndex) => {
                              const globalIndex =
                                questionIndexById.get(item.id) || 0;
                              const displayNumber = examQuestionDisplayNumber(
                                section,
                                item,
                                sectionQuestionIndex,
                                questionIndexById,
                              );
                              return (
                                <button
                                  key={item.id}
                                  className={[
                                    "answer-dot",
                                    session.answers[item.id] ? "answered" : "",
                                  ].join(" ")}
                                  onClick={() => {
                                    onMove(globalIndex);
                                    requestAnimationFrame(() =>
                                      window.scrollTo({
                                        top: 0,
                                        behavior: "smooth",
                                      }),
                                    );
                                  }}
                                  type="button"
                                >
                                  {String(displayNumber).padStart(2, "0")}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </section>
                    );
                  })}
                </section>
              ))}
            </div>
          </aside>
        ) : null}

        <section className="exam-question-panel">
          <div className="book-badge subject-reading">
            {currentProblem?.partLabel}
          </div>
          <div className="exam-question-head">
            <span>{currentProblem?.problemLabel.replace("問題", "")}</span>
            <p>{currentProblem?.layer.title}</p>
            {currentProblem?.partLabel === "阅读" && currentProblemPages.length > 1 ? <small>第 {currentProblemPageIndex + 1} / {currentProblemPages.length} 页</small> : null}
          </div>

          {currentProblem?.layer?.image_url ? <img className="exam-image exam-shared-image" src={assetSrc(currentProblem.layer.image_url)} alt="" /> : null}

          {isTimedListening ? <section className={`listening-exam-player ${audioError || !currentAudioUrl ? "error" : ""}`}><Headphones size={28} /><div><strong>{audioError || !currentAudioUrl ? "听力音频加载失败" : listeningStarted ? "听力音频播放中" : "准备播放听力音频"}</strong><p>{audioError || (!currentAudioUrl ? "当前题组缺少音频，请重试或稍后继续考试。" : "音频只能播放一次，结束后将自动进入下一组。")}</p></div>{!listeningStarted ? <button className="primary-button" type="button" disabled={!currentAudioUrl} onClick={() => { setAudioError(""); audioRef.current?.load(); setListeningStarted(true); }}>{audioError ? "重新加载" : "开始播放"}</button> : <span>正在播放</span>}<audio ref={audioRef} src={assetSrc(currentAudioUrl)} preload="auto" onEnded={finishListeningAudio} onError={() => { setListeningStarted(false); setAudioError("音频加载失败，请检查网络后重试。"); }} controls={false} /></section> : null}

          <section className="exam-problem-page">
                <section
                  className="exam-passage-group"
                  key={`${currentProblem?.id}-${currentPage.groupIndex || 0}`}
                >
                  {hasVisibleHtml(currentPage.passage) ? (
                    <section className="exam-passage">
                      <HtmlContent html={currentPage.passage} />
                    </section>
                  ) : null}
                  {currentPage.questions.map((item) => {
                    const globalIndex = questionIndexById.get(item.id) || 0;
                    const sectionQuestionIndex = Math.max(
                      0,
                      currentProblem?.questions.findIndex(
                        (question) => question.id === item.id,
                      ) ?? 0,
                    );
                    const displayNumber = examQuestionDisplayNumber(
                      currentProblem,
                      item,
                      sectionQuestionIndex,
                      questionIndexById,
                    );
                    const chosenOptionId = session.answers[item.id] || null;
                    return (
                      <article className="exam-sub-question" key={item.id}>
                        <div className="exam-sub-question-title">
                          <span>{String(displayNumber).padStart(2, "0")}.</span>
                          <HtmlContent html={item.title} />
                        </div>

                        {item.media_url && !isTimedListening ? (
                          <audio
                            className="exam-audio"
                            controls
                            src={assetSrc(item.media_url)}
                          />
                        ) : null}

                        {item.image_url ? (
                          <img
                            className="exam-image"
                            src={assetSrc(item.image_url)}
                            alt=""
                          />
                        ) : null}

                        <section className="options-grid exam-options">
                          {item.options.map((option, index) => (
                            <button
                              key={`${item.id}-${option.id}`}
                              className={`option-button ${chosenOptionId === option.id ? "selected" : ""}`}
                              onClick={() => onChoose(item.id, option.id)}
                              disabled={submitting}
                              type="button"
                            >
                              <span className="option-letter">{index + 1}</span>
                              <span>
                                <HtmlInline html={option.text} />
                              </span>
                            </button>
                          ))}
                        </section>
                      </article>
                    );
                  })}
                </section>
          </section>

          {!isTimedListening ? <footer className="exam-nav">
            <button
              className="secondary-button"
              onClick={() => moveToPage(currentPageIndex - 1)}
              disabled={!canPrev}
              type="button"
            >
              上一组
            </button>
            <button
              className="primary-button"
              onClick={() => moveToPage(currentPageIndex + 1)}
              disabled={!canNext}
              type="button"
            >
              下一组
            </button>
          </footer> : null}
        </section>
      </section>
    </div>
  );
}

export function ExamResultView({
  exam,
  attempt,
  questions,
  onRepeat,
  onLibrary,
  practice = false,
  practiceCategory = "grammar",
}) {
  const score = pct(attempt.correct, attempt.total);
  const estimatedScore = calculateExamScore(attempt, questions);
  const questionById = new Map<number, any>(
    questions.map((question) => [question.id, question]),
  );
  const answerByQuestion = new Map<number, any>(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );
  const answerForQuestion = (question) =>
    answerByQuestion.get(question.id) || {
      questionId: question.id,
      title: question.title,
      chosenOptionId: null,
      chosenText: null,
      correctOptionId: null,
      answerText: "",
      analysis: question.analysis || "",
      isCorrect: false,
      unanswered: true,
    };
  const reviewProblemGroups = buildReviewProblemGroups(exam, questions);
  const practiceTypes = (PRACTICE_CATEGORIES[practiceCategory] || PRACTICE_CATEGORIES.grammar).types;
  const grammarTypeStats = practiceTypes.map((type) => {
    const typeQuestions = questions.filter((question) => question.question_type === type.id);
    const correct = typeQuestions.filter((question) => answerByQuestion.get(question.id)?.isCorrect).length;
    return { ...type, correct, total: typeQuestions.length };
  }).filter((type) => type.total);

  return (
    <section className="result-view exam-result-view">
      <div className="result-score">
        <Trophy size={54} />
        <h1>{score}%</h1>
        <p>
          答对 {attempt.correct} / {attempt.total} · {attempt.title}
        </p>
      </div>

      {practice ? (
        <section className="grammar-type-summary">
          {grammarTypeStats.map((type) => <div key={type.id}><span>{type.label}</span><strong>{pct(type.correct, type.total)}%</strong><small>{type.correct} / {type.total} 正确</small></div>)}
        </section>
      ) : <section
        className={`exam-score-summary ${estimatedScore.passed ? "passed" : "failed"}`}
      >
        <div>
          <span>估算分数</span>
          <strong>{estimatedScore.totalScore} / 180</strong>
          <small>
            {estimatedScore.passed ? "预计合格" : "预计不合格"} · 合格线{" "}
            {estimatedScore.overallPassMark}
          </small>
        </div>
        {estimatedScore.usesThreeSections ? <>
          <div><span>语言知识</span><strong>{estimatedScore.languageKnowledgeScore} / 60</strong><small>{estimatedScore.languageKnowledgeCorrect}/{estimatedScore.languageKnowledgeTotal} · 参考线 {estimatedScore.languageKnowledgePassMark}</small></div>
          <div><span>阅读</span><strong>{estimatedScore.readingScore} / 60</strong><small>{estimatedScore.readingCorrect}/{estimatedScore.readingTotal} · 参考线 {estimatedScore.readingPassMark}</small></div>
        </> : <div>
          <span>语言知识与阅读</span>
          <strong>{estimatedScore.languageReadingScore} / 120</strong>
          <small>{estimatedScore.languageReadingCorrect}/{estimatedScore.languageReadingTotal} · 参考线 {estimatedScore.languageReadingPassMark}</small>
        </div>}
        <div>
          <span>听力</span>
          <strong>{estimatedScore.listeningScore} / 60</strong>
          <small>
            {estimatedScore.listeningCorrect}/{estimatedScore.listeningTotal} ·
            参考线 {estimatedScore.listeningPassMark}
          </small>
        </div>
      </section>}

      <div className="result-actions">
        <button className="primary-button" onClick={onRepeat} type="button">
          <RotateCcw size={20} />
          {practice ? "重新设置" : "再做一次"}
        </button>
        <button className="secondary-button" onClick={onLibrary} type="button">
          {practice ? "返回首页" : "试卷列表"}
        </button>
      </div>

      <div className="result-review-layout">
        <aside
          className="review-jump-panel"
          aria-label="复习题目导航"
        >
          <div className="review-jump-title">题号</div>
          {reviewProblemGroups.map((group) => (
            <section className="review-jump-section" key={group.label}>
              <div className="review-jump-group-title">{group.label}</div>
              {group.sections.map((section) => (
                <section className="review-jump-problem" key={section.id}>
                  <div className="review-jump-problem-title">
                    {section.problemLabel}
                  </div>
                  <div className="review-jump-grid">
                    {section.items.map(({ question, index, displayNumber }) => {
                      const answer = answerByQuestion.get(question.id);
                      return (
                        <button
                          key={question.id}
                          aria-label={`${group.label} ${section.problemLabel} ${displayNumber}番`}
                          className={[
                            "review-jump-dot",
                            answer?.isCorrect ? "right" : "miss",
                          ].join(" ")}
                          onClick={() =>
                            document
                              .getElementById(`exam-review-${question.id}`)
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              })
                          }
                          type="button"
                        >
                          {displayNumber}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </section>
          ))}
        </aside>

        <section className="review-list">
          {reviewProblemGroups.map((group) => (
            <section className="review-part-block" key={group.label}>
              <div className="review-part-heading">{group.label}</div>
              {group.sections.map((section) => (
                <section className="review-problem-block" key={section.id}>
                  <div className="review-problem-heading">
                    {section.problemLabel}
                  </div>
                  {section.layer?.image_url ? <img className="review-image" src={assetSrc(section.layer.image_url)} alt="" /> : null}
                  {groupReviewItemsByPassage(section.items).map(
                    (passageGroup, passageGroupIndex) => (
                      <section
                        className={`review-passage-group ${passageGroup.passage ? "has-shared-passage" : "single-question-group"}`}
                        key={`${section.id}-${passageGroup.key}-${passageGroupIndex}`}
                      >
                        {passageGroup.passage &&
                        isReadingQuestion(passageGroup.question) ? (
                          <BilingualTranscript
                            sourceHtml={passageGroup.passage}
                            translationHtml={passageGroup.translation}
                            variant="reading"
                          />
                        ) : null}
                        {passageGroup.passage &&
                        !isReadingQuestion(passageGroup.question) ? (
                          <section className="review-shared-passage">
                            <HtmlContent html={passageGroup.passage} />
                          </section>
                        ) : null}
                        {passageGroup.passage &&
                        !isListeningQuestion(passageGroup.question) &&
                        !isReadingQuestion(passageGroup.question) &&
                        passageGroup.translation ? (
                          <section className="translation-block">
                            <HtmlContent html={passageGroup.translation} />
                          </section>
                        ) : null}
                        {passageGroup.items.map(
                          ({ question, index, displayNumber }) => {
                            const answer = answerForQuestion(question);
                            return (
                              <article
                                className="review-item exam-review-item"
                                id={`exam-review-${answer.questionId}`}
                                key={`${answer.questionId}-${index}`}
                              >
                                <div
                                  className={
                                    answer.isCorrect
                                      ? "review-mark right"
                                      : "review-mark miss"
                                  }
                                >
                                  {answer.isCorrect ? (
                                    <Check size={18} />
                                  ) : (
                                    <X size={18} />
                                  )}
                                </div>
                                <div>
                                  <div className="review-title-row">
                                    <span className="review-question-number">
                                      {displayNumber}
                                    </span>
                                    <div className="review-title">
                                      <HtmlContent
                                        html={
                                          answer.title || question?.title || ""
                                        }
                                      />
                                    </div>
                                  </div>
                                  {question?.image_url ? (
                                    <img
                                      className="review-image"
                                      src={assetSrc(question.image_url)}
                                      alt=""
                                    />
                                  ) : null}
                                  {question?.media_url ? (
                                    <audio
                                      className="exam-audio compact"
                                      controls
                                      src={assetSrc(question.media_url)}
                                    />
                                  ) : null}
                                  {isListeningQuestion(question) &&
                                  (question?.subtitle ||
                                    question?.translation) ? (
                                    <BilingualTranscript
                                      sourceHtml={question.subtitle}
                                      translationHtml={question.translation}
                                    />
                                  ) : null}
                                  {!passageGroup.passage &&
                                  isReadingQuestion(question) &&
                                  (question?.passage ||
                                    question?.translation) ? (
                                    <BilingualTranscript
                                      sourceHtml={question.passage}
                                      translationHtml={question.translation}
                                      variant="reading"
                                    />
                                  ) : null}
                                  {!passageGroup.passage &&
                                  !isReadingQuestion(question) &&
                                  question?.passage ? (
                                    <HtmlContent html={question.passage} />
                                  ) : null}
                                  {answer.unanswered ? (
                                    <p className="review-unanswered">
                                      未作答
                                    </p>
                                  ) : null}
                                  {question?.options?.length ? (
                                    <section
                                      className="review-options"
                                      aria-label={`${index + 1}番の選択肢`}
                                    >
                                      {question.options.map(
                                        (option, optionIndex) => {
                                          const isChosen =
                                            answer.chosenOptionId === option.id;
                                          const isCorrectOption =
                                            answer.correctOptionId ===
                                            option.id;
                                          return (
                                            <div
                                              className={[
                                                "review-option",
                                                isCorrectOption
                                                  ? "correct"
                                                  : "",
                                                isChosen && !isCorrectOption
                                                  ? "chosen-wrong"
                                                  : "",
                                                isChosen && isCorrectOption
                                                  ? "chosen-correct"
                                                  : "",
                                              ].join(" ")}
                                              key={`${answer.questionId}-${option.id}`}
                                            >
                                              <span className="review-option-number">
                                                {optionIndex + 1}
                                              </span>
                                              <span className="review-option-text">
                                                <HtmlInline
                                                  html={option.text}
                                                />
                                              </span>
                                            </div>
                                          );
                                        },
                                      )}
                                    </section>
                                  ) : null}
                                  {answer.analysis ? (
                                    <section className="analysis-text">
                                      <InlineHtmlContent
                                        html={answer.analysis}
                                      />
                                    </section>
                                  ) : null}
                                  {!passageGroup.passage &&
                                  !isListeningQuestion(question) &&
                                  !isReadingQuestion(question) &&
                                  question?.translation ? (
                                    <section className="translation-block">
                                      <HtmlContent
                                        html={question.translation}
                                      />
                                    </section>
                                  ) : null}
                                </div>
                              </article>
                            );
                          },
                        )}
                      </section>
                    ),
                  )}
                </section>
              ))}
            </section>
          ))}
        </section>
      </div>
    </section>
  );
}

export function QuizView({ session, onBack, onChoose, onCheck, onNext }) {
  const question = session.questions[session.index];
  const progress = pct(
    session.index + (session.checked ? 1 : 0),
    session.questions.length,
  );
  const isCorrect = Boolean(session.checkResult?.is_correct);

  return (
    <div className="quiz-view">
      <header className="quiz-header">
        <button
          className="icon-button"
          onClick={onBack}
          type="button"
          aria-label="返回"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="quiz-progress">
          <Progress value={progress} />
          <span>
            {session.index + 1} / {session.questions.length}
          </span>
        </div>
      </header>

      <section className="question-area">
        <div className={`book-pill subject-${session.book.subject}`}>
          {session.book.categoryLabel} · {session.book.book_name}
        </div>
        <h2>{question.stem}</h2>
      </section>

      <section className="options-grid">
        {question.options.map((option, index) => {
          const selected = session.chosen === index;
          const answer = session.checkResult?.correct_option_id === option.id;
          const stateClass = session.checked
            ? answer
              ? "correct"
              : selected
                ? "wrong"
                : ""
            : selected
              ? "selected"
              : "";

          return (
            <button
              key={`${question.id}-${option.id}`}
              className={`option-button ${stateClass}`}
              onClick={() => onChoose(index)}
              type="button"
            >
              <span className="option-letter">{index + 1}</span>
              <span>
                <HtmlInline html={option.text} />
              </span>
              {session.checked && answer ? <Check size={20} /> : null}
              {session.checked && selected && !answer ? <X size={20} /> : null}
            </button>
          );
        })}
      </section>

      <footer
        className={`answer-dock ${session.checked ? (isCorrect ? "yes" : "no") : ""}`}
      >
        {session.checked ? (
          <div className="feedback">
            <strong>{isCorrect ? "回答正确！" : "正确答案"}</strong>
            <span>
              <HtmlInline html={session.checkResult.answer_text} />
            </span>
          </div>
        ) : (
          <div className="feedback muted">
            <strong>请选择一个答案</strong>
            <span>
              {session.mode === "mixed"
                ? "综合测试，共 20 题"
                : "课程练习，共 10 题"}
            </span>
          </div>
        )}
        {session.checked ? (
          <button className="primary-button" onClick={onNext} type="button">
            {session.index === session.questions.length - 1 ? "完成" : "下一题"}
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={session.chosen === null}
            onClick={onCheck}
            type="button"
          >
            检查答案
          </button>
        )}
      </footer>
    </div>
  );
}

export function ResultView({ attempt, onRepeat, onLibrary }) {
  const score = pct(attempt.correct, attempt.total);
  return (
    <section className="result-view">
      <div className="result-score">
        <Trophy size={54} />
        <h1>{score}%</h1>
        <p>
          答对 {attempt.correct} / {attempt.total}
        </p>
      </div>

      <div className="result-actions">
        <button className="primary-button" onClick={onRepeat} type="button">
          <RotateCcw size={20} />
          再做一次
        </button>
        <button className="secondary-button" onClick={onLibrary} type="button">
          选择课程
        </button>
      </div>

      <section className="review-list">
        {attempt.answers.map((answer, index) => (
          <article
            className="review-item"
            key={`${answer.questionId}-${index}`}
          >
            <div
              className={
                answer.isCorrect ? "review-mark right" : "review-mark miss"
              }
            >
              {answer.isCorrect ? <Check size={18} /> : <X size={18} />}
            </div>
            <div>
              <h3>{answer.stem}</h3>
              {answer.options?.length ? (
                <section
                  className="review-options"
                  aria-label={`${index + 1}番の選択肢`}
                >
                  {answer.options.map((option, optionIndex) => {
                    const isChosen = answer.chosenOptionId === option.id;
                    const isCorrectOption =
                      answer.correctOptionId === option.id;
                    return (
                      <div
                        className={[
                          "review-option",
                          isCorrectOption ? "correct" : "",
                          isChosen && !isCorrectOption ? "chosen-wrong" : "",
                          isChosen && isCorrectOption ? "chosen-correct" : "",
                        ].join(" ")}
                        key={`${answer.questionId}-${option.id}`}
                      >
                        <span className="review-option-number">
                          {optionIndex + 1}
                        </span>
                        <span className="review-option-text">
                          <HtmlInline html={option.text} />
                        </span>
                      </div>
                    );
                  })}
                </section>
              ) : (
                <p>
                  你的答案：{" "}
                  {answer.chosenText ? (
                    <HtmlInline html={answer.chosenText} />
                  ) : (
                    "-"
                  )}{" "}
                  / 正确答案：<HtmlInline html={answer.answerText} />
                </p>
              )}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

function HistoryPanel({ attempts }) {
  const recent = attempts.slice(0, 8);
  return (
    <section className="history-panel">
      <div className="section-title">
        <BarChart3 size={22} />
        <h2>最近记录</h2>
      </div>
      {recent.length ? (
        <div className="history-list">
          {recent.map((attempt) => (
            <div className="history-row" key={attempt.id}>
              <span className="history-book">{attempt.bookName}</span>
              <span>{attempt.categoryLabel || attempt.level}</span>
              <span>{pct(attempt.correct, attempt.total)}%</span>
              <span>{formatDate(attempt.createdAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-history">暂无学习记录。</p>
      )}
    </section>
  );
}
