import {
  api,
  assetSrc,
  mapAttempt,
  mapExamAttempt,
  mapPracticeAttempt,
  mapPracticeWrong,
  mapWrong,
  writeExamCache,
} from "./study";

const QUIZ_SESSION_KEY = "manabi_quiz_session";
/** Pre-rename key; read once for migration, then always written under QUIZ_SESSION_KEY. */
const LEGACY_QUIZ_SESSION_KEY = "japanese-study-quiz-session";

/** Unfinished quiz sessions older than this are discarded on load (ux plan §七). */
export const QUIZ_SESSION_MAX_AGE_MS = 72 * 60 * 60 * 1000;
/** Wrong-question backlog that triggers the "clear wrong answers" suggestion (ux plan §二). */
export const WRONG_BACKLOG_THRESHOLD = 10;

export function isQuizSessionExpired(session) {
  const startedAt = new Date(session?.startedAt || 0).getTime();
  return !Number.isFinite(startedAt) || Date.now() - startedAt > QUIZ_SESSION_MAX_AGE_MS;
}

export function readStoredQuizSession() {
  try {
    const stored = localStorage.getItem(QUIZ_SESSION_KEY);
    if (stored !== null) return JSON.parse(stored);
    // One-time migration from the pre-rename key.
    const legacy = localStorage.getItem(LEGACY_QUIZ_SESSION_KEY);
    if (legacy !== null) {
      localStorage.removeItem(LEGACY_QUIZ_SESSION_KEY);
      return JSON.parse(legacy);
    }
    return null;
  } catch {
    localStorage.removeItem(QUIZ_SESSION_KEY);
    localStorage.removeItem(LEGACY_QUIZ_SESSION_KEY);
    return null;
  }
}

export function writeStoredQuizSession(session) {
  if (session) localStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(QUIZ_SESSION_KEY);
}

export function questionsForRunSection(allQuestions, run) {
  const section = run?.sections?.[run.current_section];
  if (!section) return [];
  const sectionIds = new Set(section.question_ids || []);
  const byIds = allQuestions.filter((question) => sectionIds.has(question.id));
  if (byIds.length) return byIds;
  return allQuestions.filter((question) => {
    const type = Number(question.question_type || 0);
    if (section.key === "listening") return type >= 41;
    if (section.key === "language_reading") return type < 41;
    if (section.key === "vocabulary") return type < 21;
    if (section.key === "grammar_reading") return type >= 21 && type < 41;
    return false;
  });
}

export async function preloadExamAssets(questions) {
  const assets = new Map();
  for (const question of questions) {
    if (question.image_url) assets.set(assetSrc(question.image_url), "image");
    if (question.media_url) assets.set(assetSrc(question.media_url), "audio");
  }
  await Promise.allSettled([...assets].map(([url, type]) => new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 12000);
    const finish = () => { window.clearTimeout(timeout); resolve(null); };
    const media: any = type === "image" ? new Image() : new Audio();
    if (type === "audio") media.preload = "metadata";
    media[type === "image" ? "onload" : "onloadedmetadata"] = finish;
    media.onerror = finish;
    media.src = url;
    if (type === "audio") media.load();
  })));
}

/** Everything per-user that depends on the selected level (except the exam list). */
export async function fetchStudyData(level, token) {
  const [attempts, wrong, examAttempts, examRuns, practiceAttempts, practiceWrong] = await Promise.all([
    api("/api/attempts?limit=50", {}, token),
    api(`/api/wrong-questions?level=${level}`, {}, token),
    api(`/api/exam-attempts?level=${level}&limit=50`, {}, token),
    api("/api/exam-runs", {}, token),
    api(`/api/practice-attempts?level=${level}&limit=50`, {}, token),
    api(`/api/practice-wrong-questions?level=${level}`, {}, token),
  ]);
  return {
    attempts: attempts.map(mapAttempt),
    wrongItems: wrong.map(mapWrong),
    examAttempts: examAttempts.map(mapExamAttempt),
    examRuns,
    practiceAttempts: practiceAttempts.map(mapPracticeAttempt),
    practiceWrongItems: practiceWrong.map(mapPracticeWrong),
  };
}

export function mapPracticeQuestions(rows, layerPrefix) {
  return rows.map((question) => ({
    ...question,
    source_exam_id: question.exam_id,
    source_exam_title: question.exam_title,
    layer_id: `${layerPrefix}-${question.id}`,
    order_index: question.practice_order,
  }));
}

/** One layer per question, for practice sessions that are not tied to a single exam. */
export function practiceLayers(questions, titlePrefix) {
  return questions.map((question) => ({
    id: question.layer_id,
    order_index: question.order_index,
    title: `${titlePrefix} · 第${question.order_index}题`,
    question_type: question.question_type,
  }));
}

export function makePracticeSession({ config, level, title, layers, questions }) {
  return {
    config,
    exam: { id: 0, level, title, layers },
    questions,
    index: 0,
    answers: {},
    finishedAttempt: null,
  };
}

export function persistExamProgress(userId, examId, runId, index, answers) {
  writeExamCache(userId, examId, { runId, index, answers, updatedAt: new Date().toISOString() });
}

export interface ContinueSuggestion {
  key: "resume" | "wrong" | "next-book" | "first-book";
  badge: string;
  title: string;
  detail: string;
  bookId?: number;
  useWrongReview?: boolean;
}

/**
 * Ordered "continue learning" recommendations for the home card (ux plan §二):
 * resume unfinished session → clear wrong-question backlog → next lesson → first book.
 * Pure data; the caller maps `action` keys to actual callbacks.
 */
export function buildContinueSuggestions({
  session,
  userId,
  wrongCount,
  libraryWrongCount,
  attempts,
  books,
}): ContinueSuggestion[] {
  const suggestions: ContinueSuggestion[] = [];

  if (session && session.userId === userId && !session.finishedAttempt && !isQuizSessionExpired(session)) {
    const total = session.questions?.length || 0;
    if (total) {
      suggestions.push({
        key: "resume",
        badge: "上次未完成",
        title: "继续上次练习",
        detail: `${session.book?.book_name || session.title || "练习"} · 做到第 ${Math.min(session.index + 1, total)} / ${total} 题`,
      });
    }
  }

  if (wrongCount >= WRONG_BACKLOG_THRESHOLD) {
    suggestions.push({
      key: "wrong",
      badge: "错题积压",
      title: `清错题：你有 ${wrongCount} 题待复习`,
      detail: "从错题本随机抽题复习，答对后自动移出错题本",
      useWrongReview: libraryWrongCount > 0,
    });
  }

  const lastBookId = [...attempts]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .find((attempt) => attempt.bookId)?.bookId;
  const lastBook = lastBookId ? books.find((book) => book.id === lastBookId) : null;
  const nextBook = lastBook ? books[books.indexOf(lastBook) + 1] : null;
  if (nextBook) {
    suggestions.push({
      key: "next-book",
      badge: "上次练到",
      title: `继续《${lastBook.book_name}》的下一课`,
      detail: `下一课：${nextBook.book_name} · ${nextBook.question_count} 道题`,
      bookId: nextBook.id,
    });
  }

  if (books.length) {
    const firstBook = books[0];
    suggestions.push({
      key: "first-book",
      badge: "今日推荐",
      title: `从《${firstBook.book_name}》开始`,
      detail: `${firstBook.categoryLabel} · ${firstBook.question_count} 道题`,
      bookId: firstBook.id,
    });
  }

  return suggestions;
}
