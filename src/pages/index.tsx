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
  NotebookPen,
  RotateCcw,
  Search,
  Target,
  UserRoundPlus,
  X,
} from "lucide-react";
import { LEVELS, SUBJECTS, api, formatDate, pct, subjectLabel } from "../lib/study";
import UiSelect from "../components/UiSelect";
import { HtmlInline } from "../components/Html";
import { DailyRing, EmptyState, FieldInput, KeyboardToast, ModalOverlay, OptionButton, PageHeader, PetalFall, Progress, ResultScore, ReviewMark, ReviewOptions, SealMark, ShortcutHelp, ThemeToggle, TitleBlock } from "../components/CommonUi";
import { markKeyboardHintSeen, useKeyboardAnswer } from "../hooks/useKeyboardAnswer";
import { PRACTICE_CATEGORIES } from "./PracticePages";

export * from "./ExamPages";
export * from "./PracticePages";

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
  weakPracticeCategory = null,
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
  onOpenUser,
  onSearch,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showAllBooks, setShowAllBooks] = useState(false);
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

  // B9: books the user has fully cleared sink below the rest (stable sort keeps lesson order).
  const BOOK_PREVIEW_COUNT = 6;
  const sortedBooks = useMemo(() => {
    const isCleared = (book) => {
      const stats = bookStats.get(book.id);
      return stats ? pct(stats.correct, stats.total) >= 100 : false;
    };
    return [...books].sort((left, right) => Number(isCleared(left)) - Number(isCleared(right)));
  }, [books, bookStats]);
  const visibleBooks = showAllBooks ? sortedBooks : sortedBooks.slice(0, BOOK_PREVIEW_COUNT);

  return (
    <>
      <header className="topbar">
        <div className="topbar-brand">
          <SealMark size={44} />
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
          <div><h2>开始练习</h2><p>选择专项训练，或进行完整模拟考试</p></div>
        </div>
        <div className="home-module-grid">
          <article className="home-training-module featured">
            <div className="home-module-heading"><div><Target size={25} /><span><strong>专项练习</strong><small>针对不同能力单独强化</small></span></div><em>{weakPracticeCategory ? `${PRACTICE_CATEGORIES[weakPracticeCategory.category].label}正确率最低` : "推荐"}</em></div>
            <div className="home-module-actions">
              <button onClick={onOpenVocabularyPractice} disabled={!exams.length} title={exams.length ? undefined : "需先有该级别真题题库"} type="button"><Languages size={22} /><span><strong>文字词汇专项</strong><small>{exams.length ? "读音、词义和用法强化" : "需先有该级别真题题库"}</small></span><ChevronRight size={19} /></button>
              <button onClick={onOpenGrammarPractice} disabled={!exams.length} title={exams.length ? undefined : "需先有该级别真题题库"} type="button"><BrainCircuit size={22} /><span><strong>文法专项</strong><small>{exams.length ? "按题型、试卷和题量组题" : "需先有该级别真题题库"}</small></span><ChevronRight size={19} /></button>
              <button onClick={onOpenReadingPractice} disabled={!exams.length} title={exams.length ? undefined : "需先有该级别真题题库"} type="button"><BookOpen size={22} /><span><strong>读解专项</strong><small>{exams.length ? "短篇、长篇和信息检索" : "需先有该级别真题题库"}</small></span><ChevronRight size={19} /></button>
              <button onClick={onOpenListening} type="button"><Headphones size={22} /><span><strong>听力专项</strong><small>按试卷逐题精听与循环</small></span><ChevronRight size={19} /></button>
            </div>
          </article>
          <article className="home-training-module exam-module">
            <div className="home-module-heading"><div><ClipboardList size={25} /><span><strong>模拟考试</strong><small>按照正式考试结构完成整套试卷</small></span></div></div>
            <div className="home-exam-summary"><strong>{exams.length}</strong><span>{level} 历年试卷</span>{latestExamAttempt ? <small>最近成绩 {pct(latestExamAttempt.correct, latestExamAttempt.total)}% · {latestExamAttempt.correct}/{latestExamAttempt.total}</small> : <small>尚未参加考试</small>}</div>
            <button className="outline-button" onClick={onOpenExamList} type="button">选择模拟试卷 <ArrowRight size={19} /></button>
          </article>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <div>
            <h2>基础题库</h2>
            <p>
              选择知识领域后，按课练习
              {books.length ? ` · 已练 ${books.filter((book) => attempts.some((attempt) => attempt.bookId === book.id)).length}/${books.length} 课` : ""}
            </p>
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
          visibleBooks.map((book) => {
            const stats = bookStats.get(book.id);
            return (
              <article className="book-card" key={book.id} onClick={() => onStart(book)}>
                <div className="book-card-main">
                  <div className={"book-badge"}>
                    {book.categoryLabel}
                  </div>
                  <h2 className="book-display-number">{book.displayName}</h2>
                  <div className="book-meta">
                    <span>{book.question_count} 道题</span>
                    {stats ? <span>最高 {stats.best}%</span> : <span>未练习</span>}
                  </div>
                  <Progress
                    value={stats ? stats.best : 0}
                  />
                </div>
                <button
                  className="start-button"
                  type="button"
                  aria-label={`开始 ${book.book_name}`}
                >
                  <ChevronRight size={24} />
                </button>
              </article>
            );
          })
        ) : (
          <EmptyState title={`${level} ${currentSubjectLabel}`} text="该分类暂时没有题目。" />
        )}
      </section>

      {sortedBooks.length > BOOK_PREVIEW_COUNT ? (
        <button className="secondary-button show-all-books" onClick={() => setShowAllBooks((value) => !value)} type="button">
          {showAllBooks ? "收起书目" : `显示全部（${sortedBooks.length} 本）`}
        </button>
      ) : null}

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

export function WrongBookView({ level, items, onBack, onReview, onReviewPractice }) {
  const libraryItems = items.filter((item) => item.source === "library");
  const practiceCategories = Object.keys(PRACTICE_CATEGORIES).filter((category) =>
    items.some((item) => item.source === "practice" && item.subject === category),
  );
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
              <p>从错题中随机抽取最多 20 题。答对后会自动移出错题本。</p>
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

          <div className="wrong-list">
            {items.map((item) => (
              <article className="wrong-item" key={item.key}>
                <div className="wrong-count">{item.wrongCount}</div>
                <div>
                  <h3>{item.stem}</h3>
                  <p>
                    正确答案：<HtmlInline html={item.answerText} />
                    {item.lastChosenText ? <> / Last: <HtmlInline html={item.lastChosenText} /></> : ""}
                  </p>
                  <small>{item.subjectLabel} · {item.bookName}</small>
                </div>
              </article>
            ))}
          </div>
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
    } catch {
      setMessage("登录失败，请检查用户名和密码。");
    }
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <SealMark size={52} />
          <div className="brand-title">JLPT <span>GO!</span></div>
          <p>登录后继续你的 JLPT 学习</p>
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

export function UserView({ currentUser, attempts, onBack, onLogout, onRegisterUser }) {
  const [form, setForm] = useState({ username: "", displayName: "", password: "" });
  const [registering, setRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");
  const [registerError, setRegisterError] = useState("");
  const field = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  async function submitRegistration(event) {
    event.preventDefault();
    setRegistering(true);
    setRegisterMessage("");
    setRegisterError("");
    try {
      const user = await onRegisterUser({
        username: form.username.trim(),
        display_name: form.displayName.trim(),
        password: form.password,
      });
      setRegisterMessage(`用户 ${user.display_name}（@${user.username}）已创建。`);
      setForm({ username: "", displayName: "", password: "" });
    } catch (error) {
      setRegisterError(error.message || "创建用户失败，请稍后重试。");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <section className="user-page">
      <PageHeader onBack={onBack}>
        <div className="wrong-page-title"><div className="book-pill">个人资料</div></div>
      </PageHeader>

      <section className="profile-card">
        <div className="profile-avatar"><span>{currentUser?.display_name?.slice(0, 1) || "D"}</span></div>
        <div>
          <h2>{currentUser?.display_name || "David"}</h2>
          <p>@{currentUser?.username || "david"}</p>
        </div>
      </section>

      {currentUser?.is_admin ? (
        <section className="profile-admin-card">
          <div className="section-title">
            <UserRoundPlus size={22} />
            <div><h2>注册用户</h2><p>管理员可以创建学习账号。</p></div>
          </div>
          <form className="new-user-form" onSubmit={submitRegistration}>
            <FieldInput label="显示名称" value={form.displayName} onChange={field("displayName")} placeholder="例如：小明" />
            <FieldInput label="用户名" value={form.username} onChange={field("username")} placeholder="例如：xiaoming" autoCapitalize="none" />
            <FieldInput label="初始密码" value={form.password} onChange={field("password")} placeholder="请输入初始密码" type="password" />
            {registerError ? <p className="form-error" role="alert">{registerError}</p> : null}
            {registerMessage ? <p className="form-success" role="status">{registerMessage}</p> : null}
            <button className="primary-button" type="submit" disabled={registering || !form.username.trim() || !form.displayName.trim() || !form.password}>
              {registering ? "正在创建…" : "创建用户"}
            </button>
          </form>
        </section>
      ) : null}

      <HistoryPanel attempts={attempts} />

      <button className="secondary-button logout-button" onClick={onLogout} type="button">退出登录</button>
    </section>
  );
}

function ExitConfirmOverlay({ onStay, onLeave, onDiscard }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onStay(); }
      if (event.key === "Enter") { event.preventDefault(); onLeave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStay, onLeave]);
  return (
    <ModalOverlay title="暂停练习？">
      <p className="modal-footnote">退出后进度会保存，下次打开可从首页「继续学习」接着做。</p>
      <div className="modal-actions">
        {onDiscard ? <button className="discard-button" onClick={onDiscard} type="button">放弃本次练习</button> : null}
        <button className="secondary-button" onClick={onLeave} type="button">保存并退出</button>
        <button className="primary-button" onClick={onStay} type="button">继续练习</button>
      </div>
    </ModalOverlay>
  );
}

export function QuizView({ session, onBack, onPause, onDiscard, onChoose, onCheck, onNext }) {
  const question = session.questions[session.index];
  const { checked, checkResult } = session;
  const isCorrect = Boolean(checkResult?.is_correct);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardAnswer({
    active: !showExitConfirm && !showShortcuts,
    optionCount: question.options.length,
    onNumber: (index) => onChoose(index),
    onAdvance: () => (checked ? onNext() : onCheck()),
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
          <span>{session.index + 1} / {session.questions.length}</span>
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
          const state = checked ? (answer ? "correct" : selected ? "wrong" : "") : selected ? "selected" : "";
          return (
            <OptionButton key={`${question.id}-${option.id}`} index={index} option={option} className={state} onClick={() => onChoose(index)}>
              {checked && answer ? <Check size={20} /> : null}
              {checked && selected && !answer ? <X size={20} /> : null}
            </OptionButton>
          );
        })}
      </section>

      <footer className={`answer-dock ${checked ? (isCorrect ? "yes" : "no") : ""}`}>
        {checked ? (
          <div className="feedback">
            <strong>{isCorrect ? "回答正确！" : "正确答案"}</strong>
            <span><HtmlInline html={checkResult.answer_text} /></span>
          </div>
        ) : (
          <div className="feedback muted">
            <strong>请选择一个答案</strong>
            <span>{session.mode === "mixed" ? "综合测试，共 20 题" : "课程练习，共 10 题"}</span>
          </div>
        )}
        {checked ? (
          <button className={`primary-button ${isCorrect ? "success-button" : ""}`.trim()} onClick={onNext} type="button">
            {session.index === session.questions.length - 1 ? "完成" : "下一题"} <kbd className="kbd-hint">↵</kbd>
          </button>
        ) : (
          <button className="primary-button" disabled={session.chosen === null} onClick={onCheck} type="button">
            检查答案 <kbd className="kbd-hint">↵</kbd>
          </button>
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
          onLeave={onPause || onBack}
          onDiscard={onDiscard}
        />
      ) : null}
    </div>
  );
}

export function ResultView({ attempt, todayCount = 0, dailyGoal = 0, onRepeat, onLibrary, onReviewWrong }) {
  const wrongAnswers = attempt.answers.filter((answer) => !answer.isCorrect);
  const wrongCount = wrongAnswers.length;
  const wrongReview = attempt.mode === "wrong_review";
  const clearedAll = wrongReview && wrongCount === 0;
  const reviewWrongFirst = !wrongReview && wrongCount > 0;
  // B5 reward: full sakura burst when the wrong book clears or the daily goal is crossed by this attempt.
  const dailyCrossed = dailyGoal > 0 && todayCount >= dailyGoal && todayCount - (attempt.total || 0) < dailyGoal;
  const celebrate = clearedAll || dailyCrossed;
  return (
    <section className="result-view">
      <PetalFall variant={celebrate ? "full" : "light"} />
      <ResultScore score={pct(attempt.correct, attempt.total)}>
        {clearedAll ? <>全部清完 🌸 · 答对 {attempt.correct} / {attempt.total}</> : <>答对 {attempt.correct} / {attempt.total}</>}
      </ResultScore>
      <div className="result-actions">
        {reviewWrongFirst ? (
          <button className="primary-button" onClick={onReviewWrong} type="button"><RotateCcw size={20} />复习本次错题（{wrongCount} 题）</button>
        ) : null}
        <button className={reviewWrongFirst ? "secondary-button" : "primary-button"} onClick={onRepeat} type="button">
          <RotateCcw size={20} />{wrongReview ? "再来一轮错题" : "再来一组"}
        </button>
        <button className="secondary-button" onClick={onLibrary} type="button">返回书目</button>
      </div>

      <section className="review-list">
        {attempt.answers.map((answer, index) => (
          <article className="review-item" key={`${answer.questionId}-${index}`}>
            <ReviewMark ok={answer.isCorrect} />
            <div>
              <h3>{answer.stem}</h3>
              {answer.options?.length ? (
                <ReviewOptions
                  options={answer.options}
                  questionId={answer.questionId}
                  chosenOptionId={answer.chosenOptionId}
                  correctOptionId={answer.correctOptionId}
                  label={`${index + 1}番の選択肢`}
                />
              ) : (
                <p>
                  你的答案： {answer.chosenText ? <HtmlInline html={answer.chosenText} /> : "-"} / 正确答案：<HtmlInline html={answer.answerText} />
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
