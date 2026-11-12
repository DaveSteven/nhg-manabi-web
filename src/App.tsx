import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_LEVEL,
  SUBJECTS,
  abandonPracticeSession,
  api,
  completePracticeSession,
  createPracticeSession,
  fetchActivePracticeSession,
  mapAttempt,
  mapBook,
  mapExam,
  mapPracticeAttempt,
  normalizeLevel,
  pct,
  readUserLevelCache,
  savePracticeSessionAnswer,
  writeUserLevelCache,
} from "./lib/study";
import { useAuthStore } from "./stores/auth";
import { useQuizSessionStore } from "./stores/quizSession";
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
import useFavorites from "./hooks/useFavorites";
import { fetchBooks, useBooks, useExams, useStudyData } from "./hooks/useLibraryData";
import { ExamIntroRoute, ExamReviewRoute, ExamRoute } from "./routes/ExamRoutes";
import {
  ExamListView,
  ExamSessionView,
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
  FavoritesView,
  PRACTICE_CATEGORIES,
} from "./pages";

import Listening from "./pages/Listening";
import { StatsView } from "./pages/StatsPages";
import { PracticeResultView } from "./pages/PracticeResult";

function App() {
  const navigate = useNavigate();
  // T-022 刀三：books/exams/学习数据（错题、作答记录等）迁 Query 缓存，替换内存 cache ref
  const queryClient = useQueryClient();
  // T-022 刀一：auth 状态在 useAuthStore（zustand persist，只存 token）
  const currentUser = useAuthStore((state) => state.currentUser);
  const authToken = useAuthStore((state) => state.token);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const clearAuth = useAuthStore((state) => state.clear);
  // T-022 刀二：quiz/专项练习会话状态在 useQuizSessionStore，事实源为服务端 practice_sessions
  const session = useQuizSessionStore((state) => state.quizSession);
  const setSession = useQuizSessionStore((state) => state.setQuizSession);
  const grammarPractice = useQuizSessionStore((state) => state.grammarPractice);
  const setGrammarPractice = useQuizSessionStore((state) => state.setGrammarPractice);
  const practiceSubmitting = useQuizSessionStore((state) => state.practiceSubmitting);
  const setPracticeSubmitting = useQuizSessionStore((state) => state.setPracticeSubmitting);
  const quizRestoring = useQuizSessionStore((state) => state.quizRestoring);
  const setQuizRestoring = useQuizSessionStore((state) => state.setQuizRestoring);
  const setQuizSaveState = useQuizSessionStore((state) => state.setQuizSaveState);
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [subject, setSubject] = useState("grammar");
  const [selectedBook, setSelectedBook] = useState(null);
  const [practiceMode, setPracticeMode] = useState(readPracticeMode);
  const [pendingPractice, setPendingPractice] = useState(null);
  const [dailyGoal, setDailyGoal] = useState(() => readDailyGoal());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 收藏态：进入做题/复习/听力场景拉一次 ids 存内存，按钮据此显示；模考进行中不显示收藏按钮
  const favorites = useFavorites(authToken);
  const booksQuery = useBooks(level, subject, authToken, currentUser?.id);
  const examsQuery = useExams(level, authToken, currentUser?.id);
  const studyQuery = useStudyData(level, authToken, currentUser?.id);
  const books = booksQuery.data || [];
  const exams = examsQuery.data || [];
  const attempts = studyQuery.data?.attempts || [];
  const wrongItems = studyQuery.data?.wrongItems || [];
  const examAttempts = studyQuery.data?.examAttempts || [];
  const examRuns = studyQuery.data?.examRuns || [];
  const practiceAttempts = studyQuery.data?.practiceAttempts || [];
  const practiceWrongItems = studyQuery.data?.practiceWrongItems || [];
  const booksLoading = booksQuery.isFetching && !booksQuery.data;
  const {
    examSession, setExamSession, examStarting, examSectionStarting, examSubmitting, examSaveState,
    loadExam, startExam, resumeExam, abandonExam, loadExamIntro, beginExam, reviewExamAttempt, loadExamReview,
    chooseExamOption, retryExamSave, moveExamQuestion, submitExam, startNextExamSection, leaveActiveExam,
  } = useExamFlow({ navigate, authToken, currentUser, exams, level, refreshStudyData, onExamRunAbandoned: invalidateStudyData, setError, onLeave: () => resetToExamList() });
  // T-022 刀二：quiz/专项练习进度串行保存队列（镜像模考 examSaveQueue 模式）
  const quizSaveQueue = useRef(Promise.resolve());
  const quizSaveVersion = useRef(0);

  function invalidateStudyData() {
    return queryClient.invalidateQueries({ queryKey: ["study-data", currentUser?.id, level] });
  }

  async function refreshStudyData() {
    await invalidateStudyData();
  }

  // ---- T-022 刀二：practice_sessions 同步（串行队列；无 sessionId 时为纯内存会话，队列空转） ----

  function enqueueQuizSave(task: () => Promise<any>) {
    const version = ++quizSaveVersion.current;
    setQuizSaveState("saving");
    quizSaveQueue.current = quizSaveQueue.current.then(async () => {
      try {
        await task();
        if (version === quizSaveVersion.current) setQuizSaveState("saved");
      } catch (error) {
        console.warn("practice session save failed", error);
        if (version === quizSaveVersion.current) setQuizSaveState("error");
      }
    });
    return quizSaveQueue.current;
  }

  function syncQuizAnswer(currentSession: any, questionId: number, payload: any, index = currentSession?.index) {
    if (!currentSession?.sessionId) return;
    enqueueQuizSave(() => savePracticeSessionAnswer(authToken, currentSession.sessionId, questionId, { payload, current_index: index }));
  }

  function syncQuizIndex(currentSession: any, questionId: number, index: number) {
    if (!currentSession?.sessionId) return;
    enqueueQuizSave(() => savePracticeSessionAnswer(authToken, currentSession.sessionId, questionId, { current_index: index }));
  }

  /** 开练时创建服务端会话（best-effort：失败退化为纯内存会话，不阻断开练）。 */
  async function attachPracticeServerSession(sessionObject: any, options: { source: string; label: string; meta: object }) {
    try {
      const created = await createPracticeSession(authToken, {
        source: options.source,
        label: options.label,
        question_ids: sessionObject.questions.map((question: any) => question.id),
        meta: options.meta,
      });
      return { ...sessionObject, sessionId: created.id };
    } catch (error) {
      console.warn("practice session create failed; falling back to memory-only", error);
      return sessionObject;
    }
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
          setAuthUser(restoredUser);
          if (restoredUser) {
            setLevel(normalizeLevel(restoredUser.current_level || readUserLevelCache(restoredUser.id)));
          }
        }
      } catch (err) {
        if (!ignore) {
          clearAuth();
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

  // T-022 刀二：从服务端恢复进行中的练习会话（刷新/重开浏览器，AC-02）。
  // 72h 为前端建议规则：超期会话不自动恢复（服务端保留，下次开练按单活跃规则替换）。
  useEffect(() => {
    let ignore = false;
    async function restoreQuizFromServer() {
      if (!authToken) {
        setQuizRestoring(false);
        return;
      }
      // auth 恢复（/api/me）进行中：保持 restoring 阻塞 /quiz 守卫，等 currentUser 就绪后本 effect 重跑
      if (!currentUser) return;
      setQuizRestoring(true);
      try {
        const active = await fetchActivePracticeSession(authToken);
        if (ignore || !active || active.status !== "in_progress") return;
        const startedAt = active.meta?.startedAt || active.created_at;
        if (isQuizSessionExpired({ startedAt })) return;
        const clampIndex = (questions) => Math.max(0, Math.min(questions.length - 1, Number(active.current_index) || 0));
        if (active.meta?.flow === "grammar") {
          const rows = await api(`/api/exam-practice/questions?ids=${active.question_ids.join(",")}`, {}, authToken);
          if (ignore || !rows.length) return;
          const { config, title, level: sessionLevel } = active.meta;
          const questions = mapPracticeQuestions(rows, "practice", sessionLevel);
          const answers: Record<string, any> = {};
          const checked: Record<string, any> = {};
          const feedback: Record<string, any> = {};
          for (const [questionId, payload] of Object.entries(active.answers || {}) as [string, any][]) {
            if (!payload || typeof payload !== "object") continue;
            if ("a" in payload && payload.a !== null) answers[questionId] = payload.a;
            if (payload.c) checked[questionId] = true;
            if (payload.f) feedback[questionId] = payload.f;
          }
          setGrammarPractice({
            ...makePracticeSession({ config, level: sessionLevel, title, layers: practiceLayers(questions, title), questions }),
            sessionId: active.id,
            index: clampIndex(questions),
            answers,
            checked,
            feedback,
          });
        } else if (active.meta?.flow === "quiz") {
          const quiz = await api(`/api/questions/quiz?ids=${active.question_ids.join(",")}`, {}, authToken);
          if (ignore || !quiz.length) return;
          const draftAnswers: Record<string, any> = {};
          for (const [questionId, payload] of Object.entries(active.answers || {}) as [string, any][]) {
            if (payload && typeof payload === "object" && payload.d != null) draftAnswers[questionId] = payload.d;
          }
          setSession({
            userId: currentUser.id,
            sessionId: active.id,
            book: active.meta.book,
            title: active.meta.title,
            questions: quiz,
            index: clampIndex(quiz),
            answers: [],
            chosen: null,
            checked: false,
            checkResult: null,
            feedbackMode: active.meta.feedbackMode ?? practiceMode,
            draftAnswers,
            mode: active.meta.mode,
            startedAt,
          });
        }
      } catch (error) {
        console.warn("practice session restore failed", error);
      } finally {
        if (!ignore) setQuizRestoring(false);
      }
    }
    restoreQuizFromServer();
    return () => {
      ignore = true;
    };
  }, [authToken, currentUser?.id]);

  // 拉取失败统一透出到页面错误条
  useEffect(() => {
    const queryError = booksQuery.error || examsQuery.error || studyQuery.error;
    if (queryError) setError(`データを読み込めませんでした: ${queryError.message}`);
  }, [booksQuery.error, examsQuery.error, studyQuery.error]);

  // 后台预取同等级其他科目的 books，让首次切换 tab 也能命中缓存
  useEffect(() => {
    if (!authToken || !currentUser) return;
    SUBJECTS.forEach((item) => {
      if (item.id !== subject) {
        queryClient.prefetchQuery({
          queryKey: ["books", currentUser.id, level, item.id],
          queryFn: () => fetchBooks(level, item.id, authToken),
          staleTime: 60_000,
        });
      }
    });
  }, [authToken, currentUser, level, subject, queryClient]);

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
    session,
    userId: currentUser?.id,
    wrongCount: allWrongItems.length,
    libraryWrongCount: wrongItems.length,
    attempts,
    books,
  }), [session, currentUser?.id, allWrongItems, wrongItems, attempts, books]);

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
      const questions = mapPracticeQuestions(rows, "practice", level);
      setGrammarPractice(await attachPracticeServerSession(
        makePracticeSession({ config, level, title, questions, layers: practiceLayers(questions, `${label}专项`) }),
        { source: "exam_practice", label: title, meta: { flow: "grammar", config, title, level } },
      ));
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
    const layerImageByExam = new Map<number, Map<number, string>>(loaded.map(({ detail }) => [detail.id, new Map((detail.layers || []).map((layer) => [layer.id, layer.image_url || ""]))]));
    const questions = loaded.flatMap(({ exam, questions }) => questions
      .filter((question) => allowedTypes.has(question.question_type))
      .map((question) => ({
        ...question,
        source_exam_id: exam.id,
        source_exam_title: exam.title,
        source_level: exam.level,
        layer_image_url: layerImageByExam.get(exam.id)?.get(question.layer_id) || "",
      })));
    if (!questions.length) throw new Error("所选条件下没有可用的专项题目");
    const layerIds = new Set(questions.map((question) => question.layer_id));
    const layers = loaded.flatMap(({ detail }) => detail.layers || [])
      .filter((layer) => layerIds.has(layer.id))
      .map((layer, index) => ({ ...layer, order_index: index + 1 }));
    setGrammarPractice(await attachPracticeServerSession(
      makePracticeSession({ config, level, title, layers, questions }),
      { source: "exam_practice", label: title, meta: { flow: "grammar", config, title, level } },
    ));
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
    if (!grammarPractice?.checked?.[questionId]) {
      syncQuizAnswer(grammarPractice, questionId, { a: optionId });
    }
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
      // 服务端进度：作答 + 即时判反馈一并写入（{a: 选项id, c: 已判, f: 判题结果}）
      for (const result of results) {
        syncQuizAnswer(grammarPractice, result.question_id, { a: grammarPractice.answers[result.question_id], c: true, f: result });
      }
    } finally {
      setPracticeSubmitting(false);
    }
  }

  function moveGrammarQuestion(index) {
    setGrammarPractice((current) => ({
      ...current,
      index: Math.max(0, Math.min(current.questions.length - 1, index)),
    }));
    const nextIndex = grammarPractice ? Math.max(0, Math.min(grammarPractice.questions.length - 1, index)) : 0;
    const question = grammarPractice?.questions?.[nextIndex];
    if (question) syncQuizIndex(grammarPractice, question.id, nextIndex);
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
      if (grammarPractice?.sessionId) {
        enqueueQuizSave(() => completePracticeSession(authToken, grammarPractice.sessionId).catch(() => null));
      }
      await refreshStudyData();
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
    const questions = mapPracticeQuestions(rows, "practice-wrong", level);
    const categoryLabel = (PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar).label;
    setGrammarPractice(await attachPracticeServerSession(
      makePracticeSession({
        config: { mode: "random", feedbackMode: readPracticeMode(), category, count: questions.length, wrongReview: true },
        level,
        title: `${level} ${categoryLabel}错题复习`,
        layers: practiceLayers(questions, `${categoryLabel}错题`),
        questions,
      }),
      {
        source: "exam_practice",
        label: `${level} ${categoryLabel}错题复习`,
        meta: { flow: "grammar", config: { mode: "random", feedbackMode: readPracticeMode(), category, count: questions.length, wrongReview: true }, title: `${level} ${categoryLabel}错题复习`, level },
      },
    ));
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

  // 收藏题「点开即练」：听力走深链，真题进专项单题模式，教材题取单题卷直接进 /quiz，
  // 不经过 /practice-setup 的模式选择，练习模式沿用上次使用（readPracticeMode）。
  async function startFavoriteTextbookQuestion(questionId) {
    if (!questionId) return;
    setError("");
    const quiz = await api(`/api/questions/${questionId}/quiz`, {}, authToken);
    const source = {
      id: null,
      book_id: null,
      book_name: "收藏题练习",
      level: quiz.level,
      subject: quiz.subject,
      subjectLabel: quiz.subject_label,
      categoryLabel: `${quiz.level} ${quiz.subject_label}`,
    };
    startSession(source, quiz, "favorite_review", readPracticeMode());
  }

  async function startFavoriteExamQuestion(item) {
    if (item.category === "listening") {
      navigate(`/listening/${item.examId}/${item.questionId}`);
      return;
    }
    setError("");
    // 组级收藏（T-021/D13）：打开收藏行进整组练习，代理题 id 换回所在组的全部小题。
    const rows = await api(`/api/exam-practice/questions/${item.questionId}/group`, {}, authToken);
    const questions = mapPracticeQuestions(rows, "favorite", item.level || level);
    const categoryLabel = (PRACTICE_CATEGORIES[item.category] || PRACTICE_CATEGORIES.vocabulary).label;
    setGrammarPractice(await attachPracticeServerSession(
      makePracticeSession({
        config: { mode: "random", feedbackMode: readPracticeMode(), category: item.category, count: questions.length },
        level: item.level || level,
        title: `${categoryLabel}收藏题`,
        layers: practiceLayers(questions, "收藏题"),
        questions,
      }),
      {
        source: "exam_practice",
        label: `${categoryLabel}收藏题`,
        meta: { flow: "grammar", config: { mode: "random", feedbackMode: readPracticeMode(), category: item.category, count: questions.length }, title: `${categoryLabel}收藏题`, level: item.level || level },
      },
    ));
    navigate(`/${item.category}-practice`);
  }

  async function openFavorite(item) {
    try {
      if (item.source === "exam") await startFavoriteExamQuestion(item);
      else await startFavoriteTextbookQuestion(item.questionId);
    } catch (err) {
      setError(`无法打开该题：${err.message}`);
    }
  }

  function preparePractice(source, quiz, mode) {
    setPendingPractice({ source, quiz, mode });
    navigate("/practice-setup");
  }

  async function startPreparedPractice(feedbackMode) {
    if (!pendingPractice) return;
    changePracticeMode(feedbackMode);
    await startSession(pendingPractice.source, pendingPractice.quiz, pendingPractice.mode, feedbackMode);
    setPendingPractice(null);
  }

  async function startSession(source, quiz, mode, feedbackMode = practiceMode) {
    setSelectedBook(source);
    const startedAt = new Date().toISOString();
    const withServerSession = await attachPracticeServerSession(
      { questions: quiz.questions },
      {
        source: mode,
        label: quiz.title || "",
        meta: { flow: "quiz", mode, book: source, title: quiz.title, feedbackMode, startedAt },
      },
    );
    setSession({
      userId: currentUser.id,
      sessionId: withServerSession.sessionId || null,
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
      startedAt,
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
    if (session?.sessionId) {
      enqueueQuizSave(() => abandonPracticeSession(authToken, session.sessionId).catch(() => null));
    }
    setSession(null);
    navigate("/");
  }

  // 专项练习中途退出：与旧行为一致视为放弃（服务端会话置 abandoned，可被下次开练替换）
  function exitGrammarPractice() {
    if (grammarPractice?.sessionId && !grammarPractice?.finishedAttempt) {
      enqueueQuizSave(() => abandonPracticeSession(authToken, grammarPractice.sessionId).catch(() => null));
    }
    setGrammarPractice(null);
  }
  const resetToExamList = () => resetTo("/exams");

  function chooseOption(optionIndex) {
    if (!session || session.checked) return;
    const question = session.questions[session.index];
    setSession((current) => ({ ...current, chosen: optionIndex, draftAnswers: { ...current.draftAnswers, [question.id]: question.options[optionIndex].id } }));
    syncQuizAnswer(session, question.id, { d: question.options[optionIndex].id });
  }

  function moveQuizQuestion(index) {
    setSession((current) => {
      const nextIndex = Math.max(0, Math.min(current.questions.length - 1, index));
      const question = current.questions[nextIndex];
      const chosenId = current.draftAnswers?.[question.id];
      return { ...current, index: nextIndex, chosen: chosenId ? question.options.findIndex((option) => option.id === chosenId) : null, checked: false, checkResult: null };
    });
    const nextIndex = session ? Math.max(0, Math.min(session.questions.length - 1, index)) : 0;
    const question = session?.questions?.[nextIndex];
    if (question) syncQuizIndex(session, question.id, nextIndex);
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
      if (session?.sessionId) {
        enqueueQuizSave(() => completePracticeSession(authToken, session.sessionId).catch(() => null));
      }
      await refreshStudyData();
      setSession((current) => ({ ...current, saving: false, finishedAttempt: saved }));
    } catch (error) {
      setSession((current) => ({ ...current, saving: false, saveError: error.message || "保存失败，请重试" }));
    }
  }

  async function applySession(session) {
    setAuthSession(session.token, session.user);
    setLevel(normalizeLevel(session.user?.current_level || readUserLevelCache(session.user?.id)));
    resetTo("/");
  }

  async function chooseLevel(nextLevel) {
    const normalized = normalizeLevel(nextLevel);
    setLevel(normalized);
    if (currentUser) {
      writeUserLevelCache(currentUser.id, normalized);
      setAuthUser((user) => user ? { ...user, current_level: normalized } : user);
    }
    if (!authToken || !currentUser || currentUser.current_level === normalized) return;

    try {
      const updatedUser = await api("/api/me/level", {
        method: "POST",
        body: JSON.stringify({ current_level: normalized }),
      }, authToken);
      setAuthUser(updatedUser);
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
    clearAuth();
    setSession(null);
    setGrammarPractice(null);
    // 清空 Query 缓存，避免跨账号读到上一账号的 books/exams/学习数据
    queryClient.clear();
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
        <Route path="/listening/:examId?/:questionId?" element={<Listening key={currentUser.id} userId={currentUser.id} token={authToken} globalLevel={level} favorites={favorites} />} />
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
                onBack={exitGrammarPractice}
                onChoose={chooseGrammarOption}
                onMove={moveGrammarQuestion}
                onCheck={checkGrammarQuestions}
                onSubmit={submitGrammarPractice}
                submitting={practiceSubmitting}
                favorites={favorites}
              />
            ) : quizRestoring ? (
              <div className="center-state">正在恢复练习…</div>
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
                      : session.mode === "favorite_review"
                        ? startFavoriteTextbookQuestion(session.questions[0]?.id)
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
                favorites={favorites}
              />
            ) : quizRestoring ? (
              <div className="center-state">正在恢复练习…</div>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/favorites"
          element={<FavoritesView token={authToken} onBack={resetToLibrary} onOpen={openFavorite} />}
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
              onReviewAttempt={reviewExamAttempt}
            />
          )}
        />
        <Route
          path="/user"
          element={(
            <UserView
              currentUser={currentUser}
              level={level}
              token={authToken}
              onBack={resetToLibrary}
              onOpenStats={() => navigate("/stats")}
              onOpenFavorites={() => navigate("/favorites")}
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
              onLoadIntro={loadExamIntro}
              onBack={resetToExamList}
              onStart={beginExam}
            />
          )}
        />
        <Route
          path="/exams/:examId"
          element={(
            <ExamRoute
              onLoadExam={loadExam}
              onBack={leaveActiveExam}
              onChoose={chooseExamOption}
              onMove={moveExamQuestion}
              onSubmit={submitExam}
              onStartNext={startNextExamSection}
              onRetrySave={retryExamSave}
            />
          )}
        />
        <Route
          path="/exams/:examId/review/:attemptId"
          element={(
            <ExamReviewRoute
              onLoadReview={loadExamReview}
              onBack={resetToExamList}
              onRepeat={startExam}
              favorites={favorites}
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
