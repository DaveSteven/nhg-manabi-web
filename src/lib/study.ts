export const API_BASE =
  import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");
export const SESSION_TOKEN_KEY = "japanese-study-session-token";
export const EXAM_CACHE_PREFIX = "japanese-study-exam-cache";
export const USER_LEVEL_CACHE_PREFIX = "japanese-study-user-level";

export const DEFAULT_LEVEL = "N5";
export const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
export const SUBJECTS = [
  { id: "grammar", label: "文法" },
  { id: "meaning", label: "词汇" },
  { id: "kanji", label: "汉字" },
];

export const JLPT_EXAM_SECTIONS = {
  N1: [{ key: "language_reading", label: "语言知识・阅读", durationMinutes: 110 }, { key: "listening", label: "听力", durationMinutes: 55 }],
  N2: [{ key: "language_reading", label: "语言知识・阅读", durationMinutes: 105 }, { key: "listening", label: "听力", durationMinutes: 50 }],
  N3: [{ key: "vocabulary", label: "文字词汇", durationMinutes: 30 }, { key: "grammar_reading", label: "文法・阅读", durationMinutes: 70 }, { key: "listening", label: "听力", durationMinutes: 40 }],
  N4: [{ key: "vocabulary", label: "文字词汇", durationMinutes: 25 }, { key: "grammar_reading", label: "文法・阅读", durationMinutes: 55 }, { key: "listening", label: "听力", durationMinutes: 35 }],
  N5: [{ key: "vocabulary", label: "文字词汇", durationMinutes: 20 }, { key: "grammar_reading", label: "文法・阅读", durationMinutes: 40 }, { key: "listening", label: "听力", durationMinutes: 30 }],
};

export function examSectionsForLevel(level) {
  return JLPT_EXAM_SECTIONS[level] || JLPT_EXAM_SECTIONS.N5;
}

export async function api(path: string, options: RequestInit = {}, token: string | null = null) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function latestExamAttemptByExam(attempts) {
  const latest = new Map();
  for (const attempt of attempts) {
    if (!latest.has(attempt.examId)) latest.set(attempt.examId, attempt);
  }
  return latest;
}

export function countAnsweredQuestions(questions, answers) {
  return questions.filter((question) => answers[question.id]).length;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function subjectLabel(subject) {
  return SUBJECTS.find((item) => item.id === subject)?.label || subject;
}

export function normalizeLevel(level) {
  return LEVELS.includes(level) ? level : DEFAULT_LEVEL;
}

export function userLevelCacheKey(userId) {
  return `${USER_LEVEL_CACHE_PREFIX}:${userId}`;
}

export function readUserLevelCache(userId) {
  return normalizeLevel(localStorage.getItem(userLevelCacheKey(userId)));
}

export function writeUserLevelCache(userId, level) {
  localStorage.setItem(userLevelCacheKey(userId), normalizeLevel(level));
}

export function normalizeJapaneseUiText(value) {
  return String(value || "").replaceAll("课", "課");
}

export function bookDisplayNumber(value) {
  const normalized = normalizeJapaneseUiText(value);
  const lessonNumber = normalized.match(/第\s*(\d+)\s*課/);
  if (lessonNumber) return lessonNumber[1].padStart(2, "0");
  return normalized;
}

export function mapBook(book) {
  return {
    ...book,
    book_id: book.id,
    book_name: normalizeJapaneseUiText(book.name),
    displayName: bookDisplayNumber(book.name),
    subjectLabel: book.subject_label,
    categoryLabel: `${book.level} ${book.subject_label}`,
  };
}

export function mapAttempt(attempt) {
  return {
    id: attempt.id,
    mode: attempt.mode,
    level: attempt.level,
    subject: attempt.subject,
    subjectLabel: attempt.subject_label,
    categoryLabel: `${attempt.level} ${attempt.subject_label}`,
    bookId: attempt.book_id,
    bookName: normalizeJapaneseUiText(attempt.title),
    correct: attempt.correct,
    total: attempt.total,
    createdAt: attempt.created_at,
    answers: (attempt.answers || []).map((answer) => ({
      questionId: answer.question_id,
      stem: answer.stem,
      chosenOptionId: answer.chosen_option_id,
      chosenText: answer.chosen_text,
      correctOptionId: answer.correct_option_id,
      answerText: answer.answer_text,
      isCorrect: answer.is_correct,
      options: (answer.options || []).map((option) => ({
        id: option.id,
        text: option.text,
      })),
    })),
  };
}

export function mapWrong(item) {
  return {
    key: `library:${item.level}:${item.subject}:${item.question_id}`,
    source: "library",
    questionId: item.question_id,
    stem: item.stem,
    level: item.level,
    subject: item.subject,
    subjectLabel: item.subject_label,
    categoryLabel: `${item.level} ${item.subject_label}`,
    bookId: item.book_id,
    bookName: normalizeJapaneseUiText(item.book_name),
    answerText: item.answer_text,
    wrongCount: item.wrong_count,
    lastChosenText: item.last_chosen_text,
    lastWrongAt: item.last_wrong_at,
  };
}

export function mapPracticeWrong(item) {
  return {
    key: `practice:${item.level}:${item.category}:${item.question_id}`,
    source: "practice",
    questionId: item.question_id,
    stem: item.title,
    level: item.level,
    subject: item.category,
    subjectLabel: item.category_label,
    categoryLabel: `${item.level} ${item.category_label}`,
    bookId: item.exam_id,
    bookName: item.exam_title,
    answerText: item.answer_text,
    wrongCount: item.wrong_count,
    lastChosenText: item.last_chosen_text,
    lastWrongAt: item.last_wrong_at,
  };
}

export function mapExam(exam) {
  return {
    id: exam.id,
    externalId: exam.external_id,
    level: exam.level,
    title: exam.title,
    examDate: exam.exam_date,
    mediaUrl: exam.media_url,
    questionCount: exam.question_count,
    layerCount: exam.layer_count,
    vocabularyNum: exam.vocabulary_num,
    grammarNum: exam.grammar_num,
    readingNum: exam.reading_num,
    listeningNum: exam.listening_num,
  };
}

export function mapExamAttempt(attempt) {
  return {
    id: attempt.id,
    examId: attempt.exam_id,
    level: attempt.level,
    title: attempt.title,
    correct: attempt.correct,
    total: attempt.total,
    createdAt: attempt.created_at,
    answers: (attempt.answers || []).map((answer) => ({
      questionId: answer.question_id,
      title: answer.title,
      chosenOptionId: answer.chosen_option_id,
      chosenText: answer.chosen_text,
      correctOptionId: answer.correct_option_id,
      answerText: answer.answer_text,
      analysis: answer.analysis,
      isCorrect: answer.is_correct,
    })),
  };
}

export function mapPracticeAttempt(attempt) {
  const categoryLabels = { vocabulary: "文字词汇", grammar: "文法", reading: "读解" };
  const categoryLabel = categoryLabels[attempt.category] || attempt.category;
  return {
    ...mapExamAttempt(attempt),
    mode: attempt.mode,
    subject: attempt.category,
    subjectLabel: categoryLabel,
    categoryLabel: `${attempt.level} ${categoryLabel}`,
    bookName: attempt.title,
  };
}

export function examPartLabel(layer) {
  if ((layer.question_type || 0) >= 41) return "听力";
  if ((layer.question_type || 0) >= 31) return "阅读";
  if ((layer.question_type || 0) >= 21) return "文法";
  return "文字与词汇";
}

export function examQuestionCategoryLabel(question) {
  const type = question.question_type || 0;
  if (type >= 41) return "听力";
  if (type >= 31) return "阅读";
  if (type >= 21) return "文法";
  return "文字与词汇";
}

export function isListeningQuestion(question) {
  return (question?.question_type || 0) >= 41;
}

export function isReadingQuestion(question) {
  const type = question?.question_type || 0;
  return type >= 31 && type < 41;
}

export function examProblemLabel(layer) {
  const extracted = (layer.title || "").match(/問題\s*(\d+)/);
  const number = extracted?.[1] || layer.order_index;
  return `問題${number}`;
}

export function buildExamProblemSections(exam, questions) {
  const questionsByLayer = new Map();
  for (const question of questions) {
    if (!questionsByLayer.has(question.layer_id)) questionsByLayer.set(question.layer_id, []);
    questionsByLayer.get(question.layer_id).push(question);
  }

  return [...(exam.layers || [])]
    .sort((left, right) => left.order_index - right.order_index)
    .map((layer) => ({
      id: layer.id,
      partLabel: examPartLabel(layer),
      problemLabel: examProblemLabel(layer),
      layer,
      questions: (questionsByLayer.get(layer.id) || []).sort((left, right) => left.order_index - right.order_index),
    }))
    .filter((section) => section.questions.length);
}

export function examQuestionDisplayNumber(section, question, sectionIndex, questionIndexById) {
  if (section?.partLabel === "听力") return sectionIndex + 1;
  return (questionIndexById.get(question.id) || 0) + 1;
}

export function buildReviewProblemGroups(exam, questions) {
  const questionIndexById = new Map(questions.map((question, index) => [question.id, index]));
  const problemSections = buildExamProblemSections(exam, questions);
  const grouped = [];
  const partCounters = new Map();

  for (const section of problemSections) {
    const current = grouped[grouped.length - 1];
    const partCount = partCounters.get(section.partLabel) || 0;
    const reviewSection = {
      ...section,
      items: section.questions.map((question, sectionIndex) => {
        const globalIndex = questionIndexById.get(question.id) || 0;
        return {
          question,
          index: globalIndex,
          displayNumber: examQuestionDisplayNumber(section, question, sectionIndex, questionIndexById),
        };
      }),
    };
    partCounters.set(section.partLabel, partCount + section.questions.length);

    if (current?.label === section.partLabel) {
      current.sections.push(reviewSection);
    } else {
      grouped.push({ label: section.partLabel, sections: [reviewSection] });
    }
  }

  return grouped;
}

export function groupQuestionsByPassage(questions) {
  const groups = [];
  for (const question of questions) {
    const previous = groups[groups.length - 1];
    const rawPassage = question.passage || "";
    const passage = rawPassage
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .trim() ? rawPassage : "";
    if (previous && previous.passage === passage) {
      previous.questions.push(question);
    } else {
      groups.push({ passage, questions: [question] });
    }
  }
  return groups;
}

export function groupReviewItemsByPassage(items) {
  const groups = [];
  for (const item of items) {
    const question = item.question || {};
    const rawPassage = question.passage || "";
    const passage = rawPassage
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .trim() ? rawPassage : "";
    const translation = question.translation || "";
    const key = passage ? `${passage}\n${translation}` : `${question.id || item.index}`;
    const previous = groups[groups.length - 1];
    if (previous && previous.key === key) {
      previous.items.push(item);
    } else {
      groups.push({ key, passage, translation, question, items: [item] });
    }
  }
  return groups;
}

export function examPassMark(level) {
  return {
    N1: 100,
    N2: 90,
    N3: 95,
    N4: 90,
    N5: 80,
  }[level] || 90;
}

export function calculateExamScore(attempt, questions) {
  const answerByQuestion = new Map<number, any>(attempt.answers.map((answer) => [answer.questionId, answer]));
  const languageKnowledgeQuestions = questions.filter((question) => (question.question_type || 0) < 31);
  const readingQuestions = questions.filter((question) => {
    const type = question.question_type || 0;
    return type >= 31 && type < 41;
  });
  const listeningQuestions = questions.filter((question) => (question.question_type || 0) >= 41);
  const countCorrect = (items) => items.reduce((sum, question) => (
    sum + (answerByQuestion.get(question.id)?.isCorrect ? 1 : 0)
  ), 0);
  const languageKnowledgeCorrect = countCorrect(languageKnowledgeQuestions);
  const readingCorrect = countCorrect(readingQuestions);
  const listeningCorrect = countCorrect(listeningQuestions);
  const usesThreeSections = ["N1", "N2", "N3"].includes(attempt.level);
  const languageReadingQuestions = [...languageKnowledgeQuestions, ...readingQuestions];
  const languageReadingCorrect = languageKnowledgeCorrect + readingCorrect;
  const languageKnowledgeScore = usesThreeSections && languageKnowledgeQuestions.length
    ? Math.round((languageKnowledgeCorrect / languageKnowledgeQuestions.length) * 60)
    : 0;
  const readingScore = usesThreeSections && readingQuestions.length
    ? Math.round((readingCorrect / readingQuestions.length) * 60)
    : 0;
  const languageReadingScore = !usesThreeSections && languageReadingQuestions.length
    ? Math.round((languageReadingCorrect / languageReadingQuestions.length) * 120)
    : languageKnowledgeScore + readingScore;
  const listeningScore = listeningQuestions.length
    ? Math.round((listeningCorrect / listeningQuestions.length) * 60)
    : 0;
  const totalScore = languageReadingScore + listeningScore;
  const overallPassMark = examPassMark(attempt.level);
  const languageReadingPassMark = 38;
  const listeningPassMark = 19;
  const sectionPassed = usesThreeSections
    ? languageKnowledgeScore >= 19 && readingScore >= 19 && listeningScore >= listeningPassMark
    : languageReadingScore >= languageReadingPassMark && listeningScore >= listeningPassMark;
  return {
    usesThreeSections,
    languageKnowledgeCorrect,
    languageKnowledgeTotal: languageKnowledgeQuestions.length,
    languageKnowledgeScore,
    languageKnowledgePassMark: 19,
    readingCorrect,
    readingTotal: readingQuestions.length,
    readingScore,
    readingPassMark: 19,
    languageReadingCorrect,
    languageReadingTotal: languageReadingQuestions.length,
    languageReadingScore,
    languageReadingPassMark,
    listeningCorrect,
    listeningTotal: listeningQuestions.length,
    listeningScore,
    listeningPassMark,
    totalScore,
    overallPassMark,
    passed: totalScore >= overallPassMark && sectionPassed,
  };
}

export function assetSrc(url) {
  if (!url) return "";
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

export function examCacheKey(userId, examId) {
  return `${EXAM_CACHE_PREFIX}:${userId}:${examId}`;
}

export function readExamCache(userId, examId) {
  try {
    return JSON.parse(localStorage.getItem(examCacheKey(userId, examId)) || "{}");
  } catch {
    return {};
  }
}

export function writeExamCache(userId, examId, data) {
  localStorage.setItem(examCacheKey(userId, examId), JSON.stringify(data));
}

export function clearExamCache(userId, examId) {
  localStorage.removeItem(examCacheKey(userId, examId));
}
