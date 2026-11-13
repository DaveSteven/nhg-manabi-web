import { useMemo } from "react";
import { useAuthStore } from "../stores/auth";
import { usePreferencesStore } from "../stores/preferences";
import { useQuizSessionStore } from "../stores/quizSession";
import { useStudyData } from "./useLibraryData";
import { buildContinueSuggestions, countTodayQuestions } from "../lib/appHelpers";

// T-023 S1：学习数据派生结果（bookStats / allWrongItems / learningAttempts /
// continueSuggestions / todayCount）从 App useMemo 下沉为共享 hook。
// 数据源是 useStudyData 的 Query 缓存——多个视图各自调用本 hook 共享同一份请求，
// 不产生额外网络开销。books 由调用方传入（LibraryView 传当前科目的书列表，
// 其余页面不需要 continueSuggestions 的书目建议，可省略）。

export function useStudyDerived(books: any[] = []) {
  const authToken = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.currentUser);
  const level = usePreferencesStore((state) => state.level);
  const session = useQuizSessionStore((state) => state.quizSession);

  const studyQuery = useStudyData(level, authToken, currentUser?.id);
  const attempts = studyQuery.data?.attempts || [];
  const wrongItems = studyQuery.data?.wrongItems || [];
  const examAttempts = studyQuery.data?.examAttempts || [];
  const examRuns = studyQuery.data?.examRuns || [];
  const practiceAttempts = studyQuery.data?.practiceAttempts || [];
  const practiceWrongItems = studyQuery.data?.practiceWrongItems || [];

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

  return {
    studyQuery,
    attempts,
    wrongItems,
    examAttempts,
    examRuns,
    practiceAttempts,
    practiceWrongItems,
    bookStats,
    allWrongItems,
    learningAttempts,
    continueSuggestions,
    todayCount,
  };
}
