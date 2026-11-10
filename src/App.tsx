import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  DEFAULT_LEVEL,
  SESSION_TOKEN_KEY,
  SUBJECTS,
  api,
  mapAttempt,
  mapBook,
  mapExam,
  mapPracticeAttempt,
  normalizeLevel,
  pct,
  readUserLevelCache,
  writeUserLevelCache,
} from "./lib/study";
import {
  buildContinueSuggestions,
  countTodayQuestions,
  fetchStudyData,
  isQuizSessionExpired,
  makePracticeSession,
  mapPracticeQuestions,
  practiceLayers,
  readDailyGoal,
  readPracticeMode,
  writeDailyGoal,
  writePracticeMode,
} from "./lib/appHelpers";
import { useExamFlow } from "./hooks/useExamFlow";
import { ExamIntroRoute, ExamReviewRoute, ExamRoute } from "./routes/ExamRoutes";
import {
  ExamListView,
  ExamSessionView,
  RandomPracticeSessionView,
  UnifiedPracticeSessionView,
  SearchView,
  GrammarPracticeSetupView,
  BasicPracticeSetupView,
  LibraryView,
  LoginView,
  QuizView,
  ResultView,
  Shell,
  UserView,
  WrongBookView,
  PRACTICE_CATEGORIES,
} from "./pages";

import Listening from "./pages/Listening";
import { StatsView } from "./pages/StatsPages";
import { PracticeResultView } from "./pages/PracticeResult";

function App() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [exams, setExams] = useState([]);
  const [examAttempts, setExamAttempts] = useState([]);
  const [examRuns, setExamRuns] = useState([]);
  const [practiceAttempts, setPracticeAttempts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(SESSION_TOKEN_KEY));
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [subject, setSubject] = useState("grammar");
  const [selectedBook, setSelectedBook] = useState(null);
  const [session, setSession] = useState(null);
  const [practiceMode, setPracticeMode] = useState(readPracticeMode);
  const [pendingPractice, setPendingPractice] = useState(null);
  const [grammarPractice, setGrammarPractice] = useState(null);
  const [practiceSubmitting, setPracticeSubmitting] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [wrongItems, setWrongItems] = useState([]);
  const [practiceWrongItems, setPracticeWrongItems] = useState([]);
  const [dailyGoal, setDailyGoal] = useState(() => readDailyGoal());
  const [loading, setLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(false);
  const [error, setError] = useState("");
  const {
    examSession, setExamSession, examStarting, examSectionStarting, examSubmitting, examSaveState,
    loadExam, startExam, resumeExam, abandonExam, loadExamIntro, beginExam, reviewExamAttempt, loadExamReview,
    chooseExamOption, retryExamSave, moveExamQuestion, submitExam, startNextExamSection, leaveActiveExam,
  } = useExamFlow({ navigate, authToken, currentUser, exams, level, refreshStudyData, setExamRuns, setError, onLeave: () => resetToExamList() });
  const booksCache = useRef(new Map());
  const booksInflight = useRef(new Map());
  const levelDataCache = useRef(new Map());

  function applyStudyData(data) {
    setAttempts(data.attempts);
    setWrongItems(data.wrongItems);
    setExamAttempts(data.examAttempts);
    setExamRuns(data.examRuns);
    setPracticeAttempts(data.practiceAttempts);
    setPracticeWrongItems(data.practiceWrongItems);
  }

  async function refreshStudyData(nextLevel = level, token = authToken) {
    if (!token) return;
    applyStudyData(await fetchStudyData(nextLevel, token));
  }

  function clearSessions() {
    setSelectedBook(null);
    setSession(null);
    setExamSession(null);
  }

  useEffect(() => {
    let ignore = false;
    async function restoreSession() {
      setLoading(true);
      setError("");
      try {
        const restoredUser = authToken ? await api("/api/me", {}, authToken) : null;
        if (!ignore) {
          setCurrentUser(restoredUser);
          if (restoredUser) {
            setLevel(normalizeLevel(restoredUser.current_level || readUserLevelCache(restoredUser.id)));
          }
        }
      } catch (err) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        if (!ignore) {
          setAuthToken(null);
          setCurrentUser(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    restoreSession();
    return () => {
      ignore = true;
    };
  }, []);

  function fetchBooks(targetLevel, targetSubject) {
    const key = `${targetLevel}:${targetSubject}`;
    const pending = booksInflight.current.get(key);
    if (pending) return pending;
    const request = api(`/api/books?level=${targetLevel}&subject=${targetSubject}`, {}, authToken)
      .then((rows) => {
        const mapped = rows.map(mapBook);
        booksCache.current.set(key, mapped);
        return mapped;
      })
      .finally(() => booksInflight.current.delete(key));
    booksInflight.current.set(key, request);
    return request;
  }

  useEffect(() => {
    let ignore = false;
    async function loadBooks() {
      if (!authToken || !currentUser) return;
      const cacheKey = `${level}:${subject}`;
      const cached = booksCache.current.get(cacheKey);
      // 命中缓存时直接展示，避免清空列表导致页面高度塌陷再撑开（切换 tab 抖动）
      if (cached) setBooks(cached);
      setBooksLoading(!cached);
      try {
        const mappedBooks = await fetchBooks(level, subject);
        if (!ignore) setBooks(mappedBooks);
      } catch (err) {
        if (!ignore) setError(`データを読み込めませんでした: ${err.message}`);
      } finally {
        if (!ignore) setBooksLoading(false);
      }
      // 后台预取同等级的其他科目，让首次切换 tab 也能命中缓存
      SUBJECTS.forEach((item) => {
        if (item.id !== subject && !booksCache.current.has(`${level}:${item.id}`)) {
          fetchBooks(level, item.id).catch(() => {});
        }
      });
    }
    loadBooks();
    return () => {
      ignore = true;
    };
  }, [level, subject, currentUser?.id, authToken]);

  useEffect(() => {
    let ignore = false;
    async function loadLevelData() {
      if (!authToken || !currentUser) return;
      const cacheKey = `${currentUser.id}:${level}`;
      const cached = levelDataCache.current.get(cacheKey);
      if (cached) {
        setExams(cached.exams);
        applyStudyData(cached);
      }
      try {
        const [examRows, studyData] = await Promise.all([
          api(`/api/exams?level=${level}`, {}, authToken),
          fetchStudyData(level, authToken),
        ]);
        const nextData = { exams: examRows.map(mapExam), ...studyData };
        levelDataCache.current.set(cacheKey, nextData);
        if (!ignore) {
          setExams(nextData.exams);
          applyStudyData(nextData);
        }
      } catch (err) {
        if (!ignore) setError(`データを読み込めませんでした: ${err.message}`);
      }
    }
    loadLevelData();
    return () => {
      ignore = true;
    };
  }, [level, currentUser?.id, authToken]);

  const changePracticeMode = (mode) => { writePracticeMode(mode); setPracticeMode(mode); };

  const bookStats = useMemo(() => {
    const stats = new Map();
    for (const attempt of attempts) {
      if (!attempt.bookId) continue;
      const existing = stats.get(attempt.bookId) || {
        tries: 0,
        correct: 0,
        total: 0,
      };
      existing.tries += 1;
      existing.correct += attempt.correct;
      existing.total += attempt.total;
      stats.set(attempt.bookId, existing);
    }
    return stats;
  }, [attempts]);

  const allWrongItems = useMemo(
    () => [...wrongItems, ...practiceWrongItems]
      .sort((left, right) => new Date(right.lastWrongAt).getTime() - new Date(left.lastWrongAt).getTime()),
    [wrongItems, practiceWrongItems],
  );
  const learningAttempts = useMemo(
    () => [...attempts, ...practiceAttempts]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [attempts, practiceAttempts],
  );
  const continueSuggestions = useMemo(() => buildContinueSuggestions({
    session: null,
    userId: currentUser?.id,
    wrongCount: allWrongItems.length,
    libraryWrongCount: wrongItems.length,
    attempts,
    books,
  }), [currentUser?.id, allWrongItems, wrongItems, attempts, books]);

  const todayCount = useMemo(() => countTodayQuestions(learningAttempts), [learningAttempts]);

  function changeDailyGoal(goal) {
    writeDailyGoal(goal);
    setDailyGoal(goal);
  }

  // B1: rebuild an in-place session from exactly the wrong answers of the finished attempt
  // (falls back to the server wrong-question quiz when option data is incomplete).
  function reviewAttemptWrong() {
    const attempt = session?.finishedAttempt;
    if (!attempt) return;
    const wrongAnswers = attempt.answers.filter((answer) => !answer.isCorrect);
    const reviewable = wrongAnswers.filter((answer) => answer.options?.length >= 2);
    if (reviewable.length && reviewable.length === wrongAnswers.length) {
      preparePractice({
        id: null,
        book_id: null,
        book_name: "错题重练",
        level: attempt.level,
        subject: "wrong_review",
        subjectLabel: "错题",
        categoryLabel: `${attempt.level} 错题`,
      }, {
        title: "错题重练",
        questions: reviewable.map((answer) => ({ id: answer.questionId, stem: answer.stem, options: answer.options })),
      }, "wrong_review");
      return;
    }
    startWrongReview();
  }

  async function startBook(book) {
    setError("");
    const quiz = await api(`/api/books/${book.id}/quiz?limit=10`, {}, authToken);
    preparePractice(book, quiz, "book");
  }

  async function startMixedTest() {
    setError("");
    const quiz = await api(`/api/quiz/mixed?level=${level}&subject=${subject}&limit=20`, {}, authToken);
    const source = {
      id: null,
      book_id: null,
      book_name: quiz.title,
      level,
      subject,
      subjectLabel: quiz.subject_label,
      categoryLabel: `${level} ${quiz.subject_label}`,
    };
    preparePractice(source, quiz, "mixed");
  }

  async function startGrammarPractice(config) {
    setError("");
    changePracticeMode(config.feedbackMode || readPracticeMode());
    const label = (PRACTICE_CATEGORIES[config.category] || PRACTICE_CATEGORIES.grammar).label;
    const title = `${level} ${label}专项`;
    if (config.mode === "random") {
      const rows = await api(`/api/exam-practice/random?level=${level}&types=${config.types.join(",")}&limit=${config.count}`, {}, authToken);
      const questions = mapPracticeQuestions(rows, "practice");
      setGrammarPractice(makePracticeSession({ config, level, title, questions, layers: practiceLayers(questions, `${label}专项`) }));
      return;
    }
    const selectedExams = config.mode === "exam" ? exams.filter((exam) => exam.id === Number(config.examId)) : exams;
    const loaded = await Promise.all(selectedExams.map(async (exam) => {
      const [detail, questions] = await Promise.all([
        api(`/api/exams/${exam.id}`, {}, authToken),
        api(`/api/exams/${exam.id}/questions`, {}, authToken),
      ]);
      return { exam, detail, questions };
    }));
    const allowedTypes = new Set(config.types.map(Number));
    const layerImageByExam = new Map(loaded.map(({ detail }) => [detail.id, new Map((detail.layers || []).map((layer) => [layer.id, layer.image_url || ""]))]));
    const questions = loaded.flatMap(({ exam, questions }) => questions
      .filter((question) => allowedTypes.has(question.question_type))
      .map((question) => ({
        ...question,
        source_exam_id: exam.id,
        source_exam_title: exam.title,
        layer_image_url: layerImageByExam.get(exam.id)?.get(question.layer_id) || "",
      })));
    if (!questions.length) throw new Error("所选条件下没有可用的专项题目");
    const layerIds = new Set(questions.map((question) => question.layer_id));
    const layers = loaded.flatMap(({ detail }) => detail.layers || [])
      .filter((layer) => layerIds.has(layer.id))
      .map((layer, index) => ({ ...layer, order_index: index + 1 }));
    setGrammarPractice(makePracticeSession({ config, level, title, layers, questions }));
  }

  function openPractice(category) {
    setGrammarPractice(null);
    navigate(`/${category}-practice`);
  }

  function chooseGrammarOption(questionId, optionId) {
    setGrammarPractice((current) => ({
      ...(current || {}),
      ...(current?.checked?.[questionId] ? {} : {
        answers: { ...current.answers, [questionId]: optionId },
      }),
    }));
  }

  async function checkGrammarQuestions(questions) {
    if (!grammarPractice) return;
    const answerable = questions.filter((question) => grammarPractice.answers[question.id] && !grammarPractice.checked?.[question.id]);
    setPracticeSubmitting(true);
    try {
      const results = await Promise.all(answerable.map((question) => api("/api/exam-practice/check", {
        method: "POST",
        body: JSON.stringify({ question_id: question.id, chosen_option_id: grammarPractice.answers[question.id] }),
      }, authToken)));
      setGrammarPractice((current) => ({
        ...current,
        checked: { ...current.checked, ...Object.fromEntries(questions.map((question) => [question.id, true])) },
        feedback: { ...current.feedback, ...Object.fromEntries(results.map((result) => [result.question_id, result])) },
      }));
    } finally {
      setPracticeSubmitting(false);
    }
  }

  function moveGrammarQuestion(index) {
    setGrammarPractice((current) => ({
      ...current,
      index: Math.max(0, Math.min(current.questions.length - 1, index)),
    }));
  }

  async function submitGrammarPractice() {
    if (!grammarPractice || practiceSubmitting) return;
    setPracticeSubmitting(true);
    const category = grammarPractice.config.category;
    const categoryLabel = (PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar).label;
    try {
      const savedAttempt = mapPracticeAttempt(await api("/api/practice-attempts", {
        method: "POST",
        body: JSON.stringify({
          level,
          category,
          mode: grammarPractice.config.wrongReview ? "wrong_review" : "practice",
          title: `${level} ${categoryLabel}${grammarPractice.config.wrongReview ? "错题复习" : "专项练习"}`,
          answers: grammarPractice.questions.map((question) => ({ question_id: question.id, chosen_option_id: grammarPractice.answers[question.id] || null })),
        }),
      }, authToken));
      setGrammarPractice((current) => ({ ...current, finishedAttempt: savedAttempt }));
      await refreshStudyData(level, authToken);
    } catch (error) {
      setError("");
      setGrammarPractice((current) => ({ ...current, saveError: error.message || "保存失败，请重试" }));
    } finally {
      setPracticeSubmitting(false);
    }
  }

  async function startPracticeWrongReview(category) {
    setError("");
    const rows = await api(`/api/practice-wrong-questions/quiz?level=${level}&category=${category}&limit=20`, {}, authToken);
    const questions = mapPracticeQuestions(rows, "practice-wrong");
    const categoryLabel = (PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar).label;
    setGrammarPractice(makePracticeSession({
      config: { mode: "random", feedbackMode: readPracticeMode(), category, count: questions.length, wrongReview: true },
      level,
      title: `${level} ${categoryLabel}错题复习`,
      layers: practiceLayers(questions, `${categoryLabel}错题`),
      questions,
    }));
    navigate(`/${category}-practice`);
  }

  async function startWrongReview() {
    if (!allWrongItems.length) return;
    // Select across all sources so practice-only books can use the same entry.
    const selected = allWrongItems[Math.floor(Math.random() * allWrongItems.length)];
    if (selected.source === "practice") {
      await startPracticeWrongReview(selected.subject);
      return;
    }
    setError("");
    const quiz = await api(`/api/wrong-questions/quiz?level=${level}&limit=20`, {}, authToken);
    const source = {
      id: null,
      book_id: null,
      book_name: quiz.title,
      level,
      subject: "wrong_review",
      subjectLabel: "错题",
      categoryLabel: `${level} 错题`,
    };
    preparePractice(source, quiz, "wrong_review");
  }

  function preparePractice(source, quiz, mode) {
    setPendingPractice({ source, quiz, mode });
    navigate("/practice-setup");
  }

  function startPreparedPractice(feedbackMode) {
    if (!pendingPractice) return;
    changePracticeMode(feedbackMode);
    startSession(pendingPractice.source, pendingPractice.quiz, pendingPractice.mode, feedbackMode);
    setPendingPractice(null);
  }

  function startSession(source, quiz, mode, feedbackMode = practiceMode) {
    setSelectedBook(source);
    setSession({
      userId: currentUser.id,
      book: source,
      title: quiz.title,
      questions: quiz.questions,
      index: 0,
      answers: [],
      chosen: null,
      checked: false,
      checkResult: null,
      feedbackMode,
      draftAnswers: {},
      mode,
      startedAt: new Date().toISOString(),
    });
    navigate("/quiz");
  }

  function resetTo(path) {
    clearSessions();
    navigate(path);
  }
  const resetToLibrary = () => resetTo("/");

  // B4: explicit discard — drop the stored session entirely instead of pausing it.
  function discardQuizSession() {
    setSession(null);
    navigate("/");
  }
  const resetToExamList = () => resetTo("/exams");

  function chooseOption(optionIndex) {
    if (!session || session.checked) return;
    const question = session.questions[session.index];
    setSession((current) => ({ ...current, chosen: optionIndex, draftAnswers: { ...current.draftAnswers, [question.id]: question.options[optionIndex].id } }));
  }

  function moveQuizQuestion(index) {
    setSession((current) => {
      const nextIndex = Math.max(0, Math.min(current.questions.length - 1, index));
      const question = current.questions[nextIndex];
      const chosenId = current.draftAnswers?.[question.id];
      return { ...current, index: nextIndex, chosen: chosenId ? question.options.findIndex((option) => option.id === chosenId) : null, checked: false, checkResult: null };
    });
  }

  function completeImmersiveQuiz() {
    const finalAnswers = session.questions.map((question) => ({ questionId: question.id, chosenOptionId: session.draftAnswers?.[question.id] || null }));
    finishSession(finalAnswers);
  }

  async function checkAnswer() {
    if (!session || session.chosen === null) return;
    const question = session.questions[session.index];
    const chosenOption = question.options[session.chosen];
    const result = await api("/api/check-answer", {
      method: "POST",
      body: JSON.stringify({
        question_id: question.id,
        chosen_option_id: chosenOption.id,
      }),
    }, authToken);
    setSession((current) => ({
      ...current,
      checked: true,
      checkResult: result,
    }));
  }

  async function finishSession(finalAnswers) {
    if (session?.saving) return;
    setSession((current) => ({ ...current, saving: true, saveError: "" }));
    const payload = {
      mode: session.mode,
      level: session.book.level,
      subject: session.book.subject,
      subject_label: session.book.subjectLabel,
      book_id: session.mode === "book" ? session.book.id : null,
      // 保存原始名称（如"第 01 课"），界面显示时再由 practiceName 统一转换
      title: session.mode === "book" ? session.book.name || session.book.book_name : session.title,
      answers: finalAnswers.map((answer) => ({
        question_id: answer.questionId,
        chosen_option_id: answer.chosenOptionId,
      })),
    };
    try {
      const saved = mapAttempt(await api("/api/attempts", { method: "POST", body: JSON.stringify(payload) }, authToken));
      await refreshStudyData(level, authToken);
      setSession((current) => ({ ...current, saving: false, finishedAttempt: saved }));
    } catch (error) {
      setSession((current) => ({ ...current, saving: false, saveError: error.message || "保存失败，请重试" }));
    }
  }

  async function applySession(session) {
    localStorage.setItem(SESSION_TOKEN_KEY, session.token);
    setAuthToken(session.token);
    setCurrentUser(session.user);
    setLevel(normalizeLevel(session.user?.current_level || readUserLevelCache(session.user?.id)));
    resetTo("/");
  }

  async function chooseLevel(nextLevel) {
    const normalized = normalizeLevel(nextLevel);
    setLevel(normalized);
    if (currentUser) {
      writeUserLevelCache(currentUser.id, normalized);
      setCurrentUser((user) => user ? { ...user, current_level: normalized } : user);
    }
    if (!authToken || !currentUser || currentUser.current_level === normalized) return;

    try {
      const updatedUser = await api("/api/me/level", {
        method: "POST",
        body: JSON.stringify({ current_level: normalized }),
      }, authToken);
      setCurrentUser(updatedUser);
      writeUserLevelCache(updatedUser.id, updatedUser.current_level);
    } catch (err) {
      console.warn("Could not save current level to the API; using local cache.", err);
    }
  }

  async function login(form) {
    const session = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(form),
    });
    await applySession(session);
  }

  async function logout() {
    if (authToken) {
      await api("/api/auth/logout", { method: "POST" }, authToken).catch(() => null);
    }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setAuthToken(null);
    setCurrentUser(null);
    setAttempts([]);
    setExamAttempts([]);
    setWrongItems([]);
    resetTo("/");
  }

  function nextQuestion() {
    const question = session.questions[session.index];
    const chosenOption = question.options[session.chosen];
    const answer = {
      questionId: question.id,
      stem: question.stem,
      chosenOptionId: chosenOption.id,
      chosenText: chosenOption.text,
      correctOptionId: session.checkResult.correct_option_id,
      answerText: session.checkResult.answer_text,
      isCorrect: session.checkResult.is_correct,
    };
    const finalAnswers = [...session.answers, answer];

    if (session.index === session.questions.length - 1) {
      finishSession(finalAnswers);
      return;
    }

    setSession((current) => ({
      ...current,
      index: current.index + 1,
      answers: finalAnswers,
      chosen: null,
      checked: false,
      checkResult: null,
    }));
  }

  const gate = loading ? <div className="center-state">正在加载题库…</div>
    : !authToken || !currentUser ? <LoginView onLogin={login} />
    : error ? <div className="center-state error">{error}</div>
    : null;
  if (gate) return <Shell>{gate}</Shell>;

  return (
    <Shell>
      <Routes>
        <Route path="/listening/:examId?/:questionId?" element={<Listening key={currentUser.id} userId={currentUser.id} token={authToken} globalLevel={level} />} />
        <Route
          path="/"
          element={(
            <LibraryView
              books={books}
              exams={exams}
              booksLoading={booksLoading}
              level={level}
              subject={subject}
              attempts={attempts}
              examAttempts={examAttempts}
              wrongItems={allWrongItems}
              bookStats={bookStats}
              currentUser={currentUser}
              continueSuggestions={continueSuggestions}
              todayCount={todayCount}
              dailyGoal={dailyGoal}
              onDailyGoal={changeDailyGoal}
              onResume={() => navigate("/quiz")}
              onReviewWrong={() => (wrongItems.length ? startWrongReview() : navigate("/wrong"))}
              onLevel={chooseLevel}
              onSubject={setSubject}
              onStart={startBook}
              onOpenGrammarPractice={() => openPractice("grammar")}
              onOpenVocabularyPractice={() => openPractice("vocabulary")}
              onOpenReadingPractice={() => openPractice("reading")}
              onOpenListening={() => navigate("/listening")}
              onOpenExamList={() => navigate("/exams")}
              onOpenWrongBook={() => navigate("/wrong")}
              onOpenStats={() => navigate("/stats")}
              onOpenUser={() => navigate("/user")}
              onSearch={(query) => navigate(`/search?q=${encodeURIComponent(query)}`)}
            />
          )}
        />
        <Route path="/search" element={<SearchView token={authToken} currentLevel={level} onBack={() => navigate("/")} />} />
        {/* 开始练习时 pendingPractice 先被清空、路由跳转在 transition 里稍后生效；这里已有会话就直接进 /quiz，别被弹回首页。 */}
        <Route path="/practice-setup" element={pendingPractice ? <BasicPracticeSetupView source={pendingPractice.source} questionCount={pendingPractice.quiz.questions.length} initialMode={readPracticeMode()} onBack={() => { setPendingPractice(null); navigate(-1); }} onStart={startPreparedPractice} /> : <Navigate to={session ? "/quiz" : "/"} replace />} />
        {Object.keys(PRACTICE_CATEGORIES).map((category) => (
          <Route
            key={category}
            path={`/${category}-practice`}
            element={grammarPractice?.finishedAttempt ? (
              <PracticeResultView
                attempt={grammarPractice.finishedAttempt}
                questions={grammarPractice.questions}
                category={grammarPractice.config.category}
                onRepeat={() => setGrammarPractice(null)}
                onReviewWrong={() => startPracticeWrongReview(grammarPractice.config.category)}
                onLibrary={resetToLibrary}
              />
            ) : grammarPractice ? (
              <UnifiedPracticeSessionView
                session={grammarPractice}
                onBack={() => setGrammarPractice(null)}
                onChoose={chooseGrammarOption}
                onMove={moveGrammarQuestion}
                onCheck={checkGrammarQuestions}
                onSubmit={submitGrammarPractice}
                submitting={practiceSubmitting}
              />
            ) : (
              <GrammarPracticeSetupView
                exams={exams}
                level={level}
                category={category}
                onBack={resetToLibrary}
                onStart={startGrammarPractice}
              />
            )}
          />
        ))}
        <Route
          path="/quiz"
          element={
            session?.finishedAttempt ? (
              <ResultView
                attempt={session.finishedAttempt}
                questions={session.questions}
                todayCount={todayCount}
                dailyGoal={dailyGoal}
                onRepeat={() => (
                  session.mode === "mixed"
                    ? startMixedTest()
                    : session.mode === "wrong_review"
                      ? startWrongReview()
                      : startBook(session.book || selectedBook)
                )}
                onLibrary={resetToLibrary}
                onReviewWrong={reviewAttemptWrong}
              />
            ) : session ? (
              <QuizView
                session={session}
                onBack={resetToLibrary}
                onDiscard={discardQuizSession}
                onChoose={chooseOption}
                onCheck={checkAnswer}
                onNext={nextQuestion}
                onMove={moveQuizQuestion}
                onComplete={completeImmersiveQuiz}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/wrong"
          element={(
            <WrongBookView
              level={level}
              items={allWrongItems}
              onBack={resetToLibrary}
              onReview={startWrongReview}
            />
          )}
        />
        <Route
          path="/stats"
          element={(
            <StatsView
              level={level}
              token={authToken}
              onBack={resetToLibrary}
              onAction={(category) => navigate(category === "listening" ? "/listening" : `/${category}-practice`)}
              onExams={() => navigate("/exams")}
            />
          )}
        />
        <Route
          path="/user"
          element={(
            <UserView
              currentUser={currentUser}
              attempts={learningAttempts}
              onBack={resetToLibrary}
              onOpenStats={() => navigate("/stats")}
              onLogout={logout}
            />
          )}
        />
        <Route
          path="/exams"
          element={(
            <ExamListView
              exams={exams}
              level={level}
              examAttempts={examAttempts}
              examRuns={examRuns}
              onBack={resetToLibrary}
              onStartExam={startExam}
              onResumeExam={resumeExam}
              onAbandonExam={abandonExam}
              onReviewAttempt={reviewExamAttempt}
            />
          )}
        />
        <Route
          path="/exams/:examId/start"
          element={(
            <ExamIntroRoute
              examSession={examSession}
              onLoadIntro={loadExamIntro}
              onBack={resetToExamList}
              onStart={beginExam}
              starting={examStarting}
            />
          )}
        />
        <Route
          path="/exams/:examId"
          element={(
            <ExamRoute
              examSession={examSession}
              onLoadExam={loadExam}
              onBack={leaveActiveExam}
              onChoose={chooseExamOption}
              onMove={moveExamQuestion}
              onSubmit={submitExam}
              onStartNext={startNextExamSection}
              saveState={examSaveState}
              onRetrySave={retryExamSave}
              submitting={examSubmitting}
              sectionStarting={examSectionStarting}
            />
          )}
        />
        <Route
          path="/exams/:examId/review/:attemptId"
          element={(
            <ExamReviewRoute
              examSession={examSession}
              onLoadReview={loadExamReview}
              onBack={resetToExamList}
              onRepeat={startExam}
            />
          )}
        />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;
