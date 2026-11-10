import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Headphones,
  Keyboard,
  Languages,
  Layers3,
  LogOut,
  NotebookPen,
  RotateCcw,
  Search,
  Target,
  X,
} from "lucide-react";
import { LEVELS, SUBJECTS, api, formatDate, pct, subjectLabel } from "../lib/study";
import UiSelect from "../components/UiSelect";
import { Tooltip } from "../components/Tooltip";
import { HtmlInline } from "../components/Html";
import { DailyRing, EmptyState, FieldInput, KeyboardToast, ModalOverlay, OptionButton, PageHeader, Progress, BrandMark, ShortcutHelp, ThemeToggle, TitleBlock } from "../components/CommonUi";
import { markKeyboardHintSeen, useKeyboardAnswer } from "../hooks/useKeyboardAnswer";
import { ResultFilter, ResultGroupCard, ResultPage, ResultQuestion, ResultReview, ResultSummary, answerStatus, countStatuses, scoreTone, singleNavChunk } from "../components/ResultParts";

export * from "./ExamPages";
export * from "./PracticePages";

// 汇总里"待加强"与方块打勾的正确率阈值
const WEAK_ACCURACY = 60;
const MASTERED_ACCURACY = 85;
const WRONG_BOOK_PAGE_SIZE = 10;

// 靠近网格左右边缘的方块，tooltip 改为贴边对齐，避免气泡超出页面
function alignLessonTip(event) {
  const tip = event.target.closest?.(".lesson-tile-tip");
  if (!tip) return;
  const grid = event.currentTarget.getBoundingClientRect();
  const rect = tip.getBoundingClientRect();
  const edge = 130;
  tip.dataset.tipAlign = rect.right > grid.right - edge ? "end" : rect.left < grid.left + edge ? "start" : "center";
}

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
  continueSuggestions = [],
  todayCount = 0,
  dailyGoal = 20,
  onDailyGoal,
  onResume,
  onReviewWrong,
  onLevel,
  onSubject,
  onStart,
  onOpenGrammarPractice,
  onOpenVocabularyPractice,
  onOpenReadingPractice,
  onOpenExamList,
  onOpenListening,
  onOpenWrongBook,
  onOpenStats,
  onOpenUser,
  onSearch,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const safeIndex = Math.min(suggestionIndex, Math.max(0, continueSuggestions.length - 1));
  const suggestion = continueSuggestions[safeIndex];
  const startSuggestion = (item) => {
    if (item.key === "resume") onResume?.();
    else if (item.key === "wrong") (item.useWrongReview ? onReviewWrong : onOpenWrongBook)?.();
    else onStart?.(books.find((book) => book.id === item.bookId));
  };
  const currentSubjectLabel = subjectLabel(subject);
  const questionPool = books.reduce(
    (sum, book) => sum + book.question_count,
    0,
  );
  const latestExamAttempt = examAttempts[0];

  // 练习地图：编号顺序固定，一次展示全部练习；正确率用统一进度条表达
  const bookTiles = books.map((book) => {
    const stats = bookStats.get(book.id);
    const accuracy = stats && stats.total ? pct(stats.correct, stats.total) : null;
    return { book, stats, accuracy, label: book.book_name, mastered: accuracy !== null && accuracy >= MASTERED_ACCURACY };
  });
  const practicedTiles = bookTiles.filter((tile) => tile.accuracy !== null);
  const practicedCorrect = practicedTiles.reduce((sum, tile) => sum + tile.stats.correct, 0);
  const practicedTotal = practicedTiles.reduce((sum, tile) => sum + tile.stats.total, 0);
  const weakCount = bookTiles.filter((tile) => tile.accuracy !== null && tile.accuracy < WEAK_ACCURACY).length;
  const librarySummary = [
    `已完成 ${practicedTiles.length}/${books.length} 个练习`,
    practicedTotal ? `平均正确率 ${pct(practicedCorrect, practicedTotal)}%` : null,
    weakCount ? `待加强 ${weakCount} 个` : null,
  ].filter(Boolean).join(" · ");
  // 加载中骨架数量沿用上一次的练习数，保持区域高度不变，避免切换科目时页面抖动
  const skeletonCount = Math.max(12, books.length);

  return (
    <div className="home-page">
      <header className="topbar">
        <div className="topbar-brand">
          <BrandMark size={44} />
          <h1 className="brand-title">JLPT <span>GO!</span></h1>
        </div>
        <div className="top-actions">
          <ThemeToggle />
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
            className="wrong-icon-button"
            onClick={onOpenStats}
            type="button"
            aria-label="数据中心"
          >
            <BarChart3 size={23} />
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

      <div className="home-top-row">
        {suggestion ? (
          <section className="home-continue-card" aria-label="继续学习推荐">
            <div>
              <em className="home-continue-badge">{suggestion.badge}</em>
              <h2>{suggestion.title}</h2>
              <p>{suggestion.detail}</p>
            </div>
            <div className="home-continue-actions">
              <button className="primary-button" onClick={() => startSuggestion(suggestion)} type="button">
                {suggestion.key === "resume" ? "继续练习" : suggestion.key === "wrong" ? "开始复习" : "开始练习"}
              </button>
              {continueSuggestions.length > 1 ? (
                <button
                  className="secondary-button continue-swap-button"
                  onClick={() => setSuggestionIndex((safeIndex + 1) % continueSuggestions.length)}
                  type="button"
                >
                  换一个
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
        <section className="home-daily-card" aria-label="今日目标">
          <DailyRing value={todayCount} goal={dailyGoal} />
          <div className="home-daily-info">
            <small>今日目标</small>
            <strong>{todayCount} / {dailyGoal} 题</strong>
          </div>
          <UiSelect
            className="home-daily-goal-select"
            label="目标"
            ariaLabel="每日目标题数"
            compact
            value={String(dailyGoal)}
            options={[10, 20, 50].map((value) => ({ value: String(value), label: `${value} 题` }))}
            onChange={(value) => onDailyGoal?.(Number(value))}
          />
        </section>
      </div>

      <section className="home-section">
        <div className="home-section-heading">
          <div><h2>开始练习</h2></div>
        </div>
        <div className="home-module-grid">
          <article className="home-training-module">
            <div className="home-module-heading"><div><Target size={25} /><span><strong>专项练习</strong></span></div></div>
            <div className="home-module-actions">
              <button onClick={onOpenVocabularyPractice} disabled={!exams.length} title={exams.length ? undefined : "需先有该级别真题题库"} type="button"><Languages size={22} /><span><strong>文字词汇专项</strong></span><ChevronRight size={19} /></button>
              <button onClick={onOpenGrammarPractice} disabled={!exams.length} title={exams.length ? undefined : "需先有该级别真题题库"} type="button"><BrainCircuit size={22} /><span><strong>文法专项</strong></span><ChevronRight size={19} /></button>
              <button onClick={onOpenReadingPractice} disabled={!exams.length} title={exams.length ? undefined : "需先有该级别真题题库"} type="button"><BookOpen size={22} /><span><strong>读解专项</strong></span><ChevronRight size={19} /></button>
              <button onClick={onOpenListening} type="button"><Headphones size={22} /><span><strong>听力专项</strong></span><ChevronRight size={19} /></button>
            </div>
          </article>
          <article className="home-training-module exam-module">
            <div className="home-module-heading"><div><ClipboardList size={25} /><span><strong>模拟考试</strong></span></div></div>
            <div className="home-exam-summary"><span>{level} 历年试卷</span>{latestExamAttempt ? <small>最近成绩 {pct(latestExamAttempt.correct, latestExamAttempt.total)}% · {latestExamAttempt.correct}/{latestExamAttempt.total}</small> : <small>尚未参加考试</small>}</div>
            <button className="outline-button" onClick={onOpenExamList} type="button">选择模拟试卷 <ArrowRight size={19} /></button>
          </article>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <div>
            <h2>基础题库</h2>
            {!booksLoading && books.length ? <p>{librarySummary}</p> : null}
          </div>
        </div>
        <div className="subject-library-tabs" role="tablist" aria-label="题目科目">
          {SUBJECTS.map((item, index) => {
            const Icon = [BrainCircuit, BookOpen, Layers3][index];
            return (
              <button key={item.id} className={subject === item.id ? "active" : ""} onClick={() => onSubject(item.id)} type="button">
                <Icon size={21} /><strong>{item.label}</strong>{subject === item.id && !booksLoading ? <span>{questionPool}题</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="lesson-map" aria-busy={booksLoading} aria-label={`${level} ${currentSubjectLabel}练习`}>
        {booksLoading ? (
          <div className="lesson-map-grid" aria-hidden="true">
            {Array.from({ length: skeletonCount }, (_, index) => (
              <div className="lesson-tile lesson-tile-skeleton" key={index} />
            ))}
          </div>
        ) : books.length ? (
          <>
            <div className="lesson-map-grid" onMouseOver={alignLessonTip} onFocus={alignLessonTip}>
              {bookTiles.map(({ book, stats, accuracy, label, mastered }) => {
                const detail = stats
                  ? `${label} · ${book.question_count} 道题 · 正确率 ${accuracy}% · 做过 ${stats.tries} 次`
                  : `${label} · ${book.question_count} 道题 · 未练习`;
                return (
                  <Tooltip key={book.id} tip={detail} className="lesson-tile-tip">
                    <button className="lesson-tile" type="button" onClick={() => onStart(book)} aria-label={`开始 ${detail}`}>
                      <span className="lesson-tile-head">
                        <strong><small>练习</small>{book.displayName}</strong>
                        {mastered ? <Check className="lesson-tile-check" size={14} strokeWidth={3} aria-hidden="true" /> : null}
                      </span>
                      <span className="lesson-tile-meta">{accuracy === null ? "未练" : `${accuracy}%`}</span>
                      <Progress value={accuracy ?? 0} />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState title={`${level} ${currentSubjectLabel}`} text="该分类暂时没有题目。" />
        )}
      </section>

    </div>
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
  const groupedResults = useMemo(() => {
    const groups = [];
    const examGroups = new Map();
    for (const item of result.items) {
      if (item.source !== "exam") {
        groups.push({ key: `${item.source}:${item.id}`, items: [item] });
        continue;
      }
      const key = `${item.source_id}:${cleanSearchText(item.stem)}`;
      const existing = examGroups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        const group = { key: `exam:${key}`, items: [item] };
        examGroups.set(key, group);
        groups.push(group);
      }
    }
    return groups;
  }, [result.items]);
  const submit = (event) => {
    event.preventDefault();
    const next = query.trim();
    if (next.length < 2) return;
    setPage(1);
    setSubmittedQuery(next);
  };

  return (
    <section className="search-page">
      <PageHeader className="search-header" onBack={onBack} label="返回首页">
        <TitleBlock eyebrow="全题库检索" title="搜索题目" />
      </PageHeader>

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
        {groupedResults.map((group) => {
          const item = group.items[0];
          const multiple = group.items.length > 1;
          return (
            <article className="search-result-card" key={group.key}>
              <div className="search-result-meta"><span>{item.level}</span><span>{item.category_label}</span><span>{item.source_label}</span><span>{item.source_title}</span>{multiple ? <span>{group.items.length} 个小题</span> : null}</div>
              <h2><HighlightedText text={item.stem} query={submittedQuery} /></h2>
              <div className={multiple ? "search-result-subquestions" : ""}>
                {group.items.map((question) => (
                  <section className="search-result-subquestion" key={question.id}>
                    {multiple ? <h3>第 {question.order_index || group.items.indexOf(question) + 1} 题</h3> : null}
                    {question.options?.length ? <ol className="search-result-options">{question.options.map((option) => <li key={option.id}><HighlightedText text={option.text} query={submittedQuery} /></li>)}</ol> : null}
                  </section>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {result.total > result.page_size ? <nav className="search-pagination" aria-label="搜索结果分页"><button className="secondary-button" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={18} />上一页</button><span>{page} / {totalPages}</span><button className="secondary-button" type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>下一页<ArrowRight size={18} /></button></nav> : null}
    </section>
  );
}

export function WrongBookView({ level, items, onBack, onReview }) {
  const [page, setPage] = useState(1);
  const sortedItems = useMemo(
    () => [...items].sort((left, right) => new Date(right.lastWrongAt).getTime() - new Date(left.lastWrongAt).getTime()),
    [items],
  );
  const libraryItems = sortedItems.filter((item) => item.source === "library");
  const practiceItems = sortedItems.filter((item) => item.source === "practice");
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / WRONG_BOOK_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * WRONG_BOOK_PAGE_SIZE;
  const visibleItems = sortedItems.slice(pageStart, pageStart + WRONG_BOOK_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [level]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="wrong-page">
      <PageHeader onBack={onBack}>
        <div className="wrong-page-title">
          <div className="book-pill">错题本</div>
          <p>{level} · {items.length} 道题</p>
        </div>
      </PageHeader>

      {items.length ? (
        <>
          <section className="wrong-review-card">
            <div>
              <div className="book-badge">{level} 错题</div>
              <h2>错题复习</h2>
              <p>自动选择一组错题，每次最多复习 20 题。答对后会自动移出错题本。</p>
            </div>
            <div className="wrong-review-actions">
              <button className="primary-button" onClick={onReview} type="button">复习</button>
            </div>
          </section>

          <aside className="wrong-scope-note" aria-label="错题收录范围">
            <strong>收录范围</strong>
            <span>基础题库 {libraryItems.length} 题 · 专项练习 {practiceItems.length} 题</span>
            <p>专项练习包括文字词汇、文法和读解；整套真题与听力训练暂未收录。</p>
          </aside>

          <div className="wrong-list-heading">
            <h2>全部错题</h2>
            <span>显示 {pageStart + 1}–{Math.min(pageStart + WRONG_BOOK_PAGE_SIZE, sortedItems.length)}，共 {sortedItems.length} 题</span>
          </div>
          <div className="wrong-list">
            {visibleItems.map((item) => (
              <article className="wrong-item" key={item.key}>
                <div className="wrong-count">{item.wrongCount}</div>
                <div>
                  <h3>{item.stem}</h3>
                  <p>
                    正确答案：<HtmlInline html={item.answerText} />
                    {item.lastChosenText ? <> / 上次选择：<HtmlInline html={item.lastChosenText} /></> : ""}
                  </p>
                  <small>{item.subjectLabel} · {item.bookName}</small>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="wrong-pagination" aria-label="错题列表分页">
              <button className="secondary-button" type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ArrowLeft size={18} />上一页
              </button>
              <span>第 {currentPage} / {totalPages} 页</span>
              <button className="secondary-button" type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                下一页<ArrowRight size={18} />
              </button>
            </nav>
          ) : null}
        </>
      ) : <p className="empty-history">该分类暂无错题。</p>}
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
    } catch (error) {
      setMessage(
        String(error?.message || "").includes("Administrators cannot sign in")
          ? "管理员账号不能登录学习端，请使用后台登录。"
          : "登录失败，请检查用户名和密码。",
      );
    }
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <BrandMark size={52} />
          <div className="brand-title">JLPT <span>GO!</span></div>
        </div>
        <form className="new-user-form" onSubmit={submit}>
          <FieldInput label="Username" value={username} onChange={setUsername} placeholder="例：david" />
          <FieldInput label="Password" value={password} onChange={setPassword} placeholder="请输入密码" type="password" />
          {message ? <p className="form-error">{message}</p> : null}
          <button className="primary-button" type="submit" disabled={!username.trim() || !password}>登录</button>
        </form>
      </div>
    </section>
  );
}

export function UserView({ currentUser, attempts, onBack, onOpenStats, onLogout }) {
  return (
    <section className="user-page">
      <PageHeader onBack={onBack}>
        <div className="wrong-page-title"><div className="book-pill">个人资料</div></div>
      </PageHeader>

      <section className="profile-card">
        <div className="profile-avatar"><span>{currentUser?.display_name?.slice(0, 1) || "D"}</span></div>
        <div className="profile-identity">
          <h2>{currentUser?.display_name || "David"}</h2>
          <p>@{currentUser?.username || "david"}</p>
        </div>
        <button className="secondary-button logout-button" onClick={onLogout} type="button"><LogOut size={18} aria-hidden="true" />退出登录</button>
      </section>

      <button className="profile-stats-card" onClick={onOpenStats} type="button">
        <span><BarChart3 size={22} /></span>
        <div><strong>查看学习数据</strong><small>正确率趋势、连续学习与科目掌握度</small></div>
        <ChevronRight size={20} />
      </button>


      <HistoryPanel attempts={attempts} />

    </section>
  );
}

function ExitConfirmOverlay({ onStay, onLeave }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onStay(); }
      if (event.key === "Enter") { event.preventDefault(); onLeave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStay, onLeave]);
  return (
    <ModalOverlay title="退出本次练习？" onClose={onStay}>
      <p className="modal-footnote">退出后，本次作答和练习进度将不保存，也不会计入练习记录。</p>
      <div className="modal-actions">
        <button className="secondary-button" onClick={onLeave} type="button">退出练习</button>
        <button className="primary-button" onClick={onStay} type="button">继续练习</button>
      </div>
    </ModalOverlay>
  );
}

export function QuizView({ session, onBack, onDiscard, onChoose, onCheck, onNext, onMove, onComplete }) {
  const question = session.questions[session.index];
  const { checked, checkResult } = session;
  const isCorrect = Boolean(checkResult?.is_correct);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const immersive = session.feedbackMode === "immersive";
  const answered = immersive ? Object.keys(session.draftAnswers || {}).length : session.answers.length + (session.chosen !== null ? 1 : 0);
  const unanswered = session.questions.length - answered;
  const isLast = session.index === session.questions.length - 1;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const advanceImmersive = () => {
    if (!isLast) onMove(session.index + 1);
    else if (unanswered) setShowIncomplete(true);
    else onComplete();
  };

  useKeyboardAnswer({
    active: !showExitConfirm && !showShortcuts,
    optionCount: question.options.length,
    onNumber: (index) => onChoose(index),
    onAdvance: () => immersive ? advanceImmersive() : (checked ? onNext() : onCheck()),
    onExit: () => setShowExitConfirm((value) => !value),
    onHelp: () => {
      markKeyboardHintSeen();
      setShowShortcuts((value) => !value);
    },
  });

  return (
    <div className="quiz-view">
      <PageHeader onBack={() => setShowExitConfirm(true)}>
        <div className="quiz-progress">
          <Progress value={pct(session.index + (checked ? 1 : 0), session.questions.length)} />
          <span>当前位置 {session.index + 1}/{session.questions.length} · 已答 {answered} · 未答 {unanswered}</span>
        </div>
        <button
          className="shortcut-toggle"
          onClick={() => { markKeyboardHintSeen(); setShowShortcuts(true); }}
          type="button"
          aria-label="快捷键速查"
        >
          <Keyboard size={18} />
        </button>
      </PageHeader>

      <section className="question-area">
        <div className={"book-pill"}>{session.book.categoryLabel} · {session.book.book_name}</div>
        <h2>{question.stem}</h2>
      </section>

      <section className="options-grid keyboard-active">
        {question.options.map((option, index) => {
          const selected = session.chosen === index;
          const answer = checkResult?.correct_option_id === option.id;
          const state = !immersive && checked ? (answer ? "correct" : selected ? "wrong" : "") : selected ? "selected" : "";
          return (
            <OptionButton key={`${question.id}-${option.id}`} index={index} option={option} className={state} disabled={!immersive && checked} onClick={() => onChoose(index)}>
              {checked && answer ? <Check size={20} /> : null}
              {checked && selected && !answer ? <X size={20} /> : null}
            </OptionButton>
          );
        })}
      </section>

      {session.saveError ? <div className="exam-save-state error" role="alert">{session.saveError}。当前作答仍保留，请重试完成练习。</div> : null}

      <footer className={`answer-dock ${!immersive && checked ? (isCorrect ? "yes" : "no") : ""}`}>
        {!immersive && checked ? (
          <div className="feedback">
            <strong>{isCorrect ? "回答正确！" : "正确答案"}</strong>
            <span><HtmlInline html={checkResult.answer_text} /></span>
          </div>
        ) : (
          <div className="feedback muted">
            <strong>{session.chosen === null ? "请选择答案" : "答案已记录"}</strong>
            <span>{immersive ? "完成练习后统一查看答案和解析" : "检查后将锁定本题答案"}</span>
          </div>
        )}
        {immersive ? (
          <div className="practice-basic-actions">
            <button className="secondary-button" disabled={session.index === 0} onClick={() => onMove(session.index - 1)} type="button">上一题</button>
            <button className="primary-button" disabled={session.saving} onClick={advanceImmersive} type="button">{session.saving ? "正在保存…" : isLast ? "完成练习" : "下一题"} <kbd className="kbd-hint">↵</kbd></button>
          </div>
        ) : checked ? (
          <button className={`primary-button ${isCorrect ? "success-button" : ""}`.trim()} onClick={onNext} type="button">
            {session.index === session.questions.length - 1 ? "完成" : "下一题"} <kbd className="kbd-hint">↵</kbd>
          </button>
        ) : (
          <div className="practice-basic-actions">
            <button className="primary-button" disabled={session.chosen === null} onClick={onCheck} type="button">检查答案 <kbd className="kbd-hint">↵</kbd></button>
          </div>
        )}
      </footer>

      <KeyboardToast suppress={showExitConfirm || showShortcuts} />
      {showShortcuts ? (
        <ModalOverlay title="键盘快捷键" onClose={() => setShowShortcuts(false)}>
          <ShortcutHelp />
          <div className="modal-actions">
            <button className="primary-button" onClick={() => setShowShortcuts(false)} type="button">知道了</button>
          </div>
        </ModalOverlay>
      ) : null}
      {showExitConfirm ? (
        <ExitConfirmOverlay
          onStay={() => setShowExitConfirm(false)}
          onLeave={onDiscard || onBack}
        />
      ) : null}
      {showIncomplete ? <ModalOverlay title={`还有 ${unanswered} 题未作答`} onClose={() => setShowIncomplete(false)}><p className="modal-footnote">可以返回补答，也可以将未答题记为跳过并查看结果。</p><div className="modal-actions"><button className="secondary-button" onClick={() => setShowIncomplete(false)} type="button">返回补答</button><button className="primary-button" onClick={onComplete} type="button">结束并查看结果</button></div></ModalOverlay> : null}
    </div>
  );
}

export function ResultView({ attempt, questions = [], todayCount = 0, dailyGoal = 0, onRepeat, onLibrary, onReviewWrong }) {
  // 练习时选项是打乱过的，复盘按练习时看到的顺序排，题号才对得上。
  const shownOrder = new Map<any, any[]>(questions.map((question) => [question.id, (question.options || []).map((option) => option.id)]));
  const orderedOptions = (answer) => {
    const order = shownOrder.get(answer.questionId);
    const options = answer.options || [];
    if (!order?.length) return options;
    return [...options].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  };
  const [filter, setFilter] = useState<ResultFilter>("all");
  const statuses = attempt.answers.map(answerStatus);
  const counts = countStatuses(statuses);
  const missed = counts.wrong + counts.skipped;
  const total = attempt.total || attempt.answers.length;
  const score = pct(attempt.correct, total);
  const wrongReview = attempt.mode === "wrong_review";
  const clearedAll = wrongReview && missed === 0;
  const reviewFirst = !wrongReview && missed > 0;
  // B5 reward: full sakura burst when the wrong book clears or the daily goal is crossed by this attempt.
  const dailyCrossed = dailyGoal > 0 && todayCount >= dailyGoal && todayCount - (attempt.total || 0) < dailyGoal;
  const petals = clearedAll || dailyCrossed ? "full" : scoreTone(score) === "great" ? "light" : null;
  const entries = attempt.answers.map((answer, index) => ({ id: `${answer.questionId}-${index}`, number: index + 1, status: statuses[index] }));
  return (
    <ResultPage eyebrow={attempt.categoryLabel || "练习结果"} title={attempt.bookName || "练习结果"} onBack={onLibrary} backLabel="返回书目" petals={petals}>
      <ResultSummary
        score={score}
        counts={counts}
        total={total}
        headline={clearedAll ? "全部清完 🌸" : dailyCrossed ? "今日目标已达成 🌸" : null}
        note={counts.skipped ? "未作答的题计入总题数。" : null}
        actions={(
          <>
            {reviewFirst ? <button className="primary-button" onClick={onReviewWrong} type="button">复习本次错题（{missed} 题）</button> : null}
            <button className={reviewFirst ? "secondary-button" : "primary-button"} onClick={onRepeat} type="button"><RotateCcw size={18} />{wrongReview ? "再来一轮错题" : "再来一组"}</button>
            <button className="secondary-button" onClick={onLibrary} type="button">返回书目</button>
          </>
        )}
      />
      <ResultReview chunks={singleNavChunk(entries)} total={entries.length} missed={missed} filter={filter} onFilter={setFilter}>
        {attempt.answers.map((answer, index) => (filter === "missed" && statuses[index] === "correct" ? null : (
          <ResultGroupCard key={entries[index].id}>
            <ResultQuestion
              id={entries[index].id}
              number={index + 1}
              status={statuses[index]}
              stem={<p>{answer.stem}</p>}
              options={orderedOptions(answer)}
              chosenId={answer.chosenOptionId}
              correctId={answer.correctOptionId}
              chosenText={answer.chosenText}
              answerText={answer.answerText}
            />
          </ResultGroupCard>
        )))}
      </ResultReview>
    </ResultPage>
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
              <div className="history-details">
                <div className="history-book">{attempt.bookName}</div>
                <div className="history-meta">
                  <span>{attempt.categoryLabel || attempt.level}</span>
                  <span>{formatDate(attempt.createdAt)}</span>
                </div>
              </div>
              <div className="history-score">
                <strong>{pct(attempt.correct, attempt.total)}%</strong>
                <small>正确率</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-history">暂无学习记录。</p>
      )}
    </section>
  );
}
