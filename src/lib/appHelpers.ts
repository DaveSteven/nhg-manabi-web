import {
  api,
  assetSrc,
  mapAttempt,
  mapExamAttempt,
  mapPracticeAttempt,
  mapPracticeWrong,
  mapWrong,
  parseApiDate,
  practiceName,
  writeExamCache,
} from "./study";

export const PRACTICE_MODE_KEY = "manabi_practice_mode";
export const PRACTICE_MODES = ["instant", "immersive"] as const;
export type PracticeMode = typeof PRACTICE_MODES[number];

export function readPracticeMode(): PracticeMode {
  const stored = localStorage.getItem(PRACTICE_MODE_KEY);
  return PRACTICE_MODES.includes(stored as PracticeMode) ? stored as PracticeMode : "instant";
}

export function writePracticeMode(mode: PracticeMode) {
  localStorage.setItem(PRACTICE_MODE_KEY, mode);
}

/** Unfinished quiz sessions older than this are discarded on load (ux plan §七). */
export const QUIZ_SESSION_MAX_AGE_MS = 72 * 60 * 60 * 1000;
/** Wrong-question backlog that triggers the "clear wrong answers" suggestion (ux plan §二). */
export const WRONG_BACKLOG_THRESHOLD = 10;

/** Daily question-count goal (ux plan §六): stored locally, no backend. */
export const DAILY_GOAL_KEY = "manabi_daily_goal";
export const DAILY_GOAL_OPTIONS = [10, 20, 50];
export const DEFAULT_DAILY_GOAL = 20;

export function readDailyGoal() {
  const value = Number(localStorage.getItem(DAILY_GOAL_KEY));
  return DAILY_GOAL_OPTIONS.includes(value) ? value : DEFAULT_DAILY_GOAL;
}

export function writeDailyGoal(goal) {
  localStorage.setItem(DAILY_GOAL_KEY, String(goal));
}

/** T-030 首页考试倒计时：目标考试记忆（ISO 日期）；是否仍有效（未过期）由调用方按 upcoming 列表校验。 */
export const EXAM_TARGET_KEY = "manabi_exam_target";

export function readExamTarget() {
  return localStorage.getItem(EXAM_TARGET_KEY) || "";
}

export function writeExamTarget(dateIso: string) {
  localStorage.setItem(EXAM_TARGET_KEY, dateIso);
}

/** Sum of questions answered today across quiz + practice attempts (local timezone). */
export function countTodayQuestions(attempts, now = new Date()) {
  const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  return attempts
    .filter((attempt) => {
      const date = parseApiDate(attempt.createdAt);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` === today;
    })
    .reduce((sum, attempt) => sum + (attempt.total || 0), 0);
}

export function isQuizSessionExpired(session) {
  const startedAt = new Date(session?.startedAt || 0).getTime();
  return !Number.isFinite(startedAt) || Date.now() - startedAt > QUIZ_SESSION_MAX_AGE_MS;
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

/** 试题收藏 MVP：ids 全量拉取（不带 level，题量小且可跨级显示按钮态）。 */
export function fetchFavoriteIds(token) {
  return api("/api/favorites/ids", {}, token);
}

/** 幂等收藏，重复收藏返回既有行。 */
export function toggleFavorite(source, questionId, token) {
  return api("/api/favorites", { method: "PUT", body: JSON.stringify({ source, question_id: questionId }) }, token);
}

export function unfavorite(source, questionId, token) {
  return api(`/api/favorites/${source}/${questionId}`, { method: "DELETE" }, token);
}

/** 收藏列表（用户页），params: { level?, source? } */
export function fetchFavorites(params: { level?: string; source?: string } = {}, token) {
  const search = new URLSearchParams();
  if (params.level) search.set("level", params.level);
  if (params.source) search.set("source", params.source);
  const query = search.toString();
  return api(`/api/favorites${query ? `?${query}` : ""}`, {}, token);
}

/** 收藏列表行 → 用户页展示结构；sourceTitle：教材题用书名，真题用试卷名。 */
export function mapFavorite(item) {
  return {
    key: `${item.source}:${item.question_id}`,
    source: item.source,
    questionId: item.question_id,
    stem: item.stem,
    level: item.level,
    category: item.category,
    categoryLabel: item.category_label,
    examId: item.exam_id ?? null,
    sourceTitle: item.source === "textbook" ? practiceName(item.book_name || "") : (item.exam_title || ""),
    answerText: item.answer_text,
    createdAt: item.created_at,
  };
}

/** level：真题等级（N1…），结果页年月 tag 展示用；调用方已知（接口按 level 过滤或来自收藏行）。 */
export function mapPracticeQuestions(rows, layerPrefix, level = "") {
  return rows.map((question) => ({
    ...question,
    source_exam_id: question.exam_id,
    source_exam_title: question.exam_title,
    source_level: level,
    source_layer_id: question.layer_id,
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
    checked: {},
    feedback: {},
    finishedAttempt: null,
    // T-014：attempt 级时长计时起点（提交时换算 duration_seconds；恢复路径须覆写为服务端起点）
    startedAt: new Date().toISOString(),
  };
}

/** Reading and shared-material questions move as a group; ordinary questions remain one item. */
export function practiceQuestionGroups(questions) {
  const groups: any[] = [];
  const byKey = new Map<string, any>();
  questions.forEach((question, index) => {
    const shared = question.question_type === 23 || (question.question_type >= 31 && question.question_type <= 36);
    // 一层可能装多篇文章（如短編読解 3 篇 × 小题）：有可见文章按文章分组，
    // 无文章的（信息检索整页图）保持整层一组，材料图不拆散。
    const visiblePassage = (question.passage || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .trim();
    const examKey = question.source_exam_id || question.exam_id || "exam";
    const layerKey = question.source_layer_id || question.layer_id || index;
    const key = shared ? `${examKey}:${visiblePassage ? `p:${visiblePassage}` : `l:${layerKey}`}` : `question:${question.id}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        questions: [],
        passage: question.passage || "",
        // 题组级材料图（信息检索页面图等），来自 API 的 layer_image_url。
        groupImage: question.layer_image_url || "",
        sourceExamTitle: question.source_exam_title || "",
        sourceLevel: question.source_level || "",
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.questions.push(question);
  });
  return groups;
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
      title: `上次做到「${lastBook.book_name}」，继续下一组`,
      detail: `下一组：${nextBook.book_name} · ${nextBook.question_count} 道题`,
      bookId: nextBook.id,
    });
  }

  if (books.length) {
    const firstBook = books[0];
    suggestions.push({
      key: "first-book",
      badge: "今日推荐",
      title: `从「${firstBook.book_name}」开始`,
      detail: `${firstBook.categoryLabel} · ${firstBook.question_count} 道题`,
      bookId: firstBook.id,
    });
  }

  return suggestions;
}
