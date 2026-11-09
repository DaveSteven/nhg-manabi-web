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

const QUIZ_SESSION_KEY = "japanese-study-quiz-session";

export function readStoredQuizSession() {
  try {
    return JSON.parse(localStorage.getItem(QUIZ_SESSION_KEY) || "null");
  } catch {
    localStorage.removeItem(QUIZ_SESSION_KEY);
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
