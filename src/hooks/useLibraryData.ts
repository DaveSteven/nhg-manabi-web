import { useQuery } from "@tanstack/react-query";
import { api, mapBook, mapExam } from "../lib/study";
import { fetchStudyData } from "../lib/appHelpers";

// T-022 刀三：books / exams / 学习数据（错题、收藏、统计以外的服务端列表）统一走 Query 缓存，
// 替换 App 内 booksCache/levelDataCache 内存缓存。键带 userId 防跨账号串数据。

export async function fetchBooks(level: string, subject: string, token: string | null) {
  const rows = await api(`/api/books?level=${level}&subject=${subject}`, {}, token);
  return rows.map(mapBook);
}

export function useBooks(level: string, subject: string, token: string | null, userId?: string) {
  return useQuery({
    queryKey: ["books", userId, level, subject],
    queryFn: () => fetchBooks(level, subject, token),
    enabled: Boolean(token && userId),
    staleTime: 60_000,
  });
}

export function useExams(level: string, token: string | null, userId?: string) {
  return useQuery({
    queryKey: ["exams", userId, level],
    queryFn: async () => {
      const rows = await api(`/api/exams?level=${level}`, {}, token);
      return rows.map(mapExam);
    },
    enabled: Boolean(token && userId),
    staleTime: 60_000,
  });
}

export function useStudyData(level: string, token: string | null, userId?: string) {
  return useQuery({
    queryKey: ["study-data", userId, level],
    queryFn: () => fetchStudyData(level, token),
    enabled: Boolean(token && userId),
    staleTime: 30_000,
  });
}
