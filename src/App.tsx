import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  DEFAULT_LEVEL,
  SESSION_TOKEN_KEY,
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
  fetchStudyData,
  makePracticeSession,
  mapPracticeQuestions,
  practiceLayers,
  readStoredQuizSession,
  writeStoredQuizSession,
} from "./lib/appHelpers";
import { useExamFlow } from "./hooks/useExamFlow";
import { ExamIntroRoute, ExamReviewRoute, ExamRoute } from "./routes/ExamRoutes";
import {
  ExamListView,
  ExamResultView,
  ExamSessionView,
  RandomPracticeSessionView,
  SearchView,
  GrammarPracticeSetupView,
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
import AdminQuestions from "./pages/AdminQuestions";

function App() {
  const navigate = useNavigate();
  const isAdminHost = window.location.hostname.toLowerCase() === "admin.manabi.cc";
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
  const [session, setSession] = useState(() => readStoredQuizSession());
  const [grammarPractice, setGrammarPractice] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [wrongItems, setWrongItems] = useState([]);
  const [practiceWrongItems, setPracticeWrongItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(false);
  const [error, setError] = useState("");
  const {
    examSession, setExamSession, examStarting, examSectionStarting, examSubmitting, examSaveState,
    loadExam, startExam, resumeExam, abandonExam, loadExamIntro, beginExam, reviewExamAttempt, loadExamReview,
    chooseExamOption, retryExamSave, moveExamQuestion, submitExam, startNextExamSection, leaveActiveExam,
  } = useExamFlow({ navigate, authToken, currentUser, exams, level, refreshStudyData, setExamRuns, setError, onLeave: () => resetToExamList() });
  const booksCache = useRef(new Map());
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

  useEffect(() => {
    let ignore = false;
    async function loadBooks() {
      if (!authToken || !currentUser) return;
      const cacheKey = `${level}:${subject}`;
      const cached = booksCache.current.get(cacheKey);
      setBooks(cached || []);
      setBooksLoading(!cached);
      try {
        const bookRows = await api(`/api/books?level=${level}&subject=${subject}`);
        const mappedBooks = bookRows.map(mapBook);
        booksCache.current.set(cacheKey, mappedBooks);
        if (!ignore) setBooks(mappedBooks);
      } catch (err) {
        if (!ignore) setError(`データを読み込めませんでした: ${err.message}`);
      } finally {
        if (!ignore) setBooksLoading(false);
      }
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
          api(`/api/exams?level=${level}`),
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

  useEffect(() => {
    if (!currentUser || !session) return;
    if (session.userId && session.userId !== currentUser.id) {
      setSession(null);
      return;
    }
    writeStoredQuizSession(session);
  }, [currentUser, session]);

  const bookStats = useMemo(() => {
    const stats = new Map();
    for (const attempt of attempts) {
      if (!attempt.bookId) continue;
      const existing = stats.get(attempt.bookId) || {
        tries: 0,
        best: 0,
        correct: 0,
        total: 0,
      };
      existing.tries += 1;
      existing.best = Math.max(existing.best, pct(attempt.correct, attempt.total));
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

  async function startBook(book) {
    setError("");
    const quiz = await api(`/api/books/${book.id}/quiz?limit=10`, {}, authToken);
    startSession(book, quiz, "book");
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
    startSession(source, quiz, "mixed");
  }

  async function startGrammarPractice(config) {
    setError("");
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
    const questions = loaded.flatMap(({ exam, questions }) => questions
      .filter((question) => allowedTypes.has(question.question_type))
      .map((question) => ({ ...question, source_exam_id: exam.id, source_exam_title: exam.title })));
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
      ...current,
      answers: { ...current.answers, [questionId]: optionId },
    }));
  }

  function moveGrammarQuestion(index) {
    setGrammarPractice((current) => ({
      ...current,
      index: Math.max(0, Math.min(current.questions.length - 1, index)),
    }));
  }

  async function submitGrammarPractice() {
    const category = grammarPractice.config.category;
    const categoryLabel = (PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar).label;
    const savedAttempt = mapPracticeAttempt(await api("/api/practice-attempts", {
      method: "POST",
      body: JSON.stringify({
        level,
        category,
        mode: grammarPractice.config.wrongReview ? "wrong_review" : "practice",
        title: `${level} ${categoryLabel}${grammarPractice.config.wrongReview ? "错题复习" : "专项练习"}`,
        answers: grammarPractice.questions.map((question) => ({
          question_id: question.id,
          chosen_option_id: grammarPractice.answers[question.id] || null,
        })),
      }),
    }, authToken));
    setGrammarPractice((current) => ({
      ...current,
      finishedAttempt: savedAttempt,
    }));
    await refreshStudyData(level, authToken);
  }

  async function startPracticeWrongReview(category) {
    setError("");
    const rows = await api(`/api/practice-wrong-questions/quiz?level=${level}&category=${category}&limit=20`, {}, authToken);
    const questions = mapPracticeQuestions(rows, "practice-wrong");
    const categoryLabel = (PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar).label;
    setGrammarPractice(makePracticeSession({
      config: { mode: "random", category, count: questions.length, wrongReview: true },
      level,
      title: `${level} ${categoryLabel}错题复习`,
      layers: practiceLayers(questions, `${categoryLabel}错题`),
      questions,
    }));
    navigate(`/${category}-practice`);
  }

  async function startWrongReview() {
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
    startSession(source, quiz, "wrong_review");
  }

  function startSession(source, quiz, mode) {
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
  const resetToExamList = () => resetTo("/exams");

  function chooseOption(optionIndex) {
    if (!session || session.checked) return;
    setSession((current) => ({ ...current, chosen: optionIndex }));
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
    const payload = {
      mode: session.mode,
      level: session.book.level,
      subject: session.book.subject,
      subject_label: session.book.subjectLabel,
      book_id: session.mode === "book" ? session.book.id : null,
      title: session.mode === "book" ? session.book.book_name : session.title,
      answers: finalAnswers.map((answer) => ({
        question_id: answer.questionId,
        chosen_option_id: answer.chosenOptionId,
      })),
    };
    const saved = mapAttempt(
      await api("/api/attempts", {
        method: "POST",
        body: JSON.stringify(payload),
      }, authToken),
    );
    await refreshStudyData(level, authToken);
    setSession((current) => ({ ...current, finishedAttempt: saved }));
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

  async function registerUser(form) {
    return api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(form),
    }, authToken);
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

  const gate = loading ? <div className="center-state">正在加载课程…</div>
    : !authToken || !currentUser ? <LoginView onLogin={login} />
    : isAdminHost && !currentUser.is_admin ? <div className="center-state error">该账号没有管理权限。<button className="secondary-button" type="button" onClick={logout}>退出登录</button></div>
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
            isAdminHost ? <Navigate to="/admin/questions" replace /> : <LibraryView
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
              onLevel={chooseLevel}
              onSubject={setSubject}
              onStart={startBook}
              onOpenGrammarPractice={() => openPractice("grammar")}
              onOpenVocabularyPractice={() => openPractice("vocabulary")}
              onOpenReadingPractice={() => openPractice("reading")}
              onOpenListening={() => navigate("/listening")}
              onOpenExamList={() => navigate("/exams")}
              onOpenWrongBook={() => navigate("/wrong")}
              onOpenUser={() => navigate("/user")}
              onSearch={(query) => navigate(`/search?q=${encodeURIComponent(query)}`)}
            />
          )}
        />
        <Route path="/search" element={<SearchView token={authToken} currentLevel={level} onBack={() => navigate("/")} />} />
        {Object.keys(PRACTICE_CATEGORIES).map((category) => (
          <Route
            key={category}
            path={`/${category}-practice`}
            element={grammarPractice?.finishedAttempt ? (
              <ExamResultView
                exam={grammarPractice.exam}
                attempt={grammarPractice.finishedAttempt}
                questions={grammarPractice.questions}
                practice
                practiceCategory={grammarPractice.config.category}
                onRepeat={() => setGrammarPractice(null)}
                onLibrary={resetToLibrary}
              />
            ) : grammarPractice ? (
              grammarPractice.config.mode === "random" ? (
                <RandomPracticeSessionView
                  session={grammarPractice}
                  onBack={() => setGrammarPractice(null)}
                  onChoose={chooseGrammarOption}
                  onMove={moveGrammarQuestion}
                  onSubmit={submitGrammarPractice}
                />
              ) : (
                <ExamSessionView
                  session={grammarPractice}
                  onBack={() => setGrammarPractice(null)}
                  onChoose={chooseGrammarOption}
                  onMove={moveGrammarQuestion}
                  onSubmit={submitGrammarPractice}
                />
              )
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
                onRepeat={() => (
                  session.mode === "mixed"
                    ? startMixedTest()
                    : session.mode === "wrong_review"
                      ? startWrongReview()
                      : startBook(session.book || selectedBook)
                )}
                onLibrary={resetToLibrary}
              />
            ) : session ? (
              <QuizView
                session={session}
                onBack={resetToLibrary}
                onChoose={chooseOption}
                onCheck={checkAnswer}
                onNext={nextQuestion}
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
              onReviewPractice={startPracticeWrongReview}
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
              onLogout={logout}
              onRegisterUser={registerUser}
              onOpenAdmin={() => navigate("/admin/questions")}
            />
          )}
        />
        <Route
          path="/admin/questions"
          element={currentUser.is_admin ? <AdminQuestions token={authToken} onBack={() => navigate("/")} /> : <Navigate to="/" replace />}
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
