import React, { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { assetSrc, isReadingQuestion, pct } from "../lib/study";
import { useAuthStore } from "../stores/auth";
import { useQuizSessionStore } from "../stores/quizSession";
import { useQuizFlow } from "../hooks/useQuizFlow";
import { practiceQuestionGroups } from "../lib/appHelpers";
import { useQuestionPersonal } from "../lib/questionStats";
import { BilingualTranscript, HtmlContent, cleanHtml } from "../components/Html";
import { QuestionPersonalBadge } from "../components/QuestionPersonalBadge";
import {
  ResultFilter,
  ResultGroupCard,
  ResultNavChunk,
  ResultPage,
  ResultQuestion,
  ResultReview,
  ResultSummary,
  answerStatus,
  countStatuses,
  scoreTone,
} from "../components/ResultParts";
import { PRACTICE_CATEGORIES } from "./PracticePages";
import { ZoomImage } from "../components/ZoomImage";

/**
 * 专项练习（文字词汇 / 文法 / 读解）的结果页。
 * 与模拟考试结果页（ExamResultView / ExamReview）完全分开：按练习时的「题 / 篇」分组复盘，
 * 共享文章只出现一次；跳过与答错分开标记。
 */

const isSharedType = (type) => type === 23 || (type >= 31 && type <= 36);

export function PracticeResultView() {
  // T-023 S3：自取专项练习结果（grammarPractice.finishedAttempt）与动作；路由侧保证已完成态才渲染
  const grammarPractice = useQuizSessionStore((state) => state.grammarPractice);
  const setGrammarPractice = useQuizSessionStore((state) => state.setGrammarPractice);
  const { resetToLibrary: onLibrary, startPracticeWrongReview } = useQuizFlow();
  const attempt = grammarPractice.finishedAttempt;
  const questions = grammarPractice.questions;
  const category = grammarPractice.config.category || "grammar";
  const onRepeat = () => setGrammarPractice(null);
  const onReviewWrong = () => startPracticeWrongReview(category);
  const [filter, setFilter] = useState<ResultFilter>("all");
  // 个人维度（T-011）：专项练习结果按 exam_question 口径批量拉取，作答过的题才显示
  const authToken = useAuthStore((state) => state.token);
  const personalStats = useQuestionPersonal(
    "exam_question",
    questions.map((question) => question.id),
    authToken,
  );

  const answerById = useMemo(() => new Map<number, any>(attempt.answers.map((answer) => [answer.questionId, answer])), [attempt]);
  const statusOf = (question) => answerStatus(answerById.get(question.id));

  // 题号沿用练习顺序 1..n；分组与练习页一致（同一篇文章的小题合为一组）。
  const numberById = new Map<number, number>(questions.map((question, index) => [question.id, index + 1]));
  const groups = practiceQuestionGroups(questions);

  const counts = countStatuses(questions.map(statusOf));
  const total = attempt.total || questions.length;
  const score = pct(attempt.correct, total);
  const missed = counts.wrong + counts.skipped;

  const types = (PRACTICE_CATEGORIES[category] || PRACTICE_CATEGORIES.grammar).types
    .map((type) => {
      const typeQuestions = questions.filter((question) => question.question_type === type.id);
      return { id: type.id, label: type.label, total: typeQuestions.length, correct: typeQuestions.filter((question) => statusOf(question) === "correct").length };
    })
    .filter((type) => type.total);

  // 题号导航：连续的单题并成一格网格，共享文章的小题单独圈成一组。
  const navChunks: ResultNavChunk[] = [];
  groups.forEach((group) => {
    const shared = group.questions.length > 1;
    const entries = group.questions.map((question) => ({ id: question.id, number: numberById.get(question.id), status: statusOf(question) }));
    const last = navChunks[navChunks.length - 1];
    if (!shared && last && !last.shared) last.entries.push(...entries);
    else navChunks.push({ key: group.key, shared, entries });
  });

  const visibleGroups = groups
    .map((group) => ({ group, visible: filter === "missed" ? group.questions.filter((question) => statusOf(question) !== "correct") : group.questions }))
    .filter((item) => item.visible.length);

  const reviewFirst = missed > 0 && onReviewWrong;

  return (
    <ResultPage title={attempt.title} onBack={onLibrary} backLabel="返回首页" petals={scoreTone(score) === "great" ? "light" : null}>
      <ResultSummary
        score={score}
        counts={counts}
        total={total}
        types={types}
        note={counts.skipped ? "未作答的题计入总题数，并会加入错题本。" : null}
        actions={(
          <>
            {reviewFirst ? <button className="primary-button" onClick={onReviewWrong} type="button">重练错题</button> : null}
            <button className={reviewFirst ? "secondary-button" : "primary-button"} onClick={onRepeat} type="button"><RotateCcw size={18} />再练一组</button>
            <button className="secondary-button" onClick={onLibrary} type="button">返回首页</button>
          </>
        )}
      />

      <ResultReview chunks={navChunks} total={questions.length} missed={missed} filter={filter} onFilter={setFilter}>
        {visibleGroups.map(({ group, visible }) => (
          <ReviewGroup group={group} visible={visible} key={group.key} numberById={numberById} answerById={answerById} statusOf={statusOf} personalStats={personalStats} />
        ))}
      </ResultReview>
    </ResultPage>
  );
}

function ReviewGroup({ group, visible, numberById, answerById, statusOf, personalStats }) {
  const first = group.questions[0];
  // 信息检索等材料可能只有图片，不能用 hasVisibleHtml（只认文字）判断。
  const hasPassage = Boolean(cleanHtml(group.passage));
  const shared = isSharedType(Number(first?.question_type || 0)) && (hasPassage || group.questions.length > 1);
  const reading = isReadingQuestion(first);
  const numbers = group.questions.map((question) => numberById.get(question.id));
  const range = numbers.length > 1 ? `${Math.min(...numbers)} – ${Math.max(...numbers)}` : `${numbers[0]}`;
  const correct = group.questions.filter((question) => statusOf(question) === "correct").length;
  const hiddenCount = group.questions.length - visible.length;
  return (
    <ResultGroupCard>
      {shared ? (
        <>
          <header className="practice-result-group-heading">
            <strong>共享文章</strong>
            <span>第 {range} 题 · 答对 {correct} / {group.questions.length}</span>
            {group.sourceExamTitle || group.sourceLevel ? <small>{[group.sourceLevel, group.sourceExamTitle].filter(Boolean).join(" · ")}</small> : null}
          </header>
          {group.groupImage ? <ZoomImage className="exam-image" src={assetSrc(group.groupImage)} /> : null}
          {hasPassage ? (
            <details className={`practice-result-passage ${reading ? "reading" : ""}`.trim()} open>
              <summary>文章</summary>
              {reading
                ? <BilingualTranscript sourceHtml={group.passage} translationHtml={first.translation} variant="reading" />
                : <HtmlContent html={group.passage} />}
            </details>
          ) : null}
        </>
      ) : null}
      {visible.map((question) => {
        const answer = answerById.get(question.id);
        return (
          <ResultQuestion
            key={question.id}
            id={question.id}
            number={numberById.get(question.id)}
            status={statusOf(question)}
            meta={(
              <>
                <QuestionPersonalBadge stats={personalStats} questionId={question.id} />
                {shared ? null : <span className="result-meta-tag">{[group.sourceLevel, group.sourceExamTitle].filter(Boolean).join(" · ")}</span>}
              </>
            )}
            stem={<HtmlContent html={answer?.title || question.title || ""} />}
            media={question.image_url ? <ZoomImage className="exam-image" src={assetSrc(question.image_url)} /> : null}
            options={question.options || []}
            chosenId={answer?.chosenOptionId || null}
            correctId={answer?.correctOptionId || null}
            analysis={answer?.analysis || question.analysis}
          />
        );
      })}
      {hiddenCount > 0 ? <p className="practice-result-group-note">本篇另有 {hiddenCount} 道答对的题已隐藏</p> : null}
    </ResultGroupCard>
  );
}
