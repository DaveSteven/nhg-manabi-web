import React, { useMemo, useState } from "react";
import { Headphones } from "lucide-react";
import {
  assetSrc,
  examQuestionDisplayNumber,
  groupReviewItemsByPassage,
  isListeningQuestion,
  isReadingQuestion,
} from "../lib/study";
import { BilingualTranscript, HtmlContent } from "./Html";
import { ReviewMark, ReviewOptions } from "./CommonUi";
import { Tooltip } from "./Tooltip";
import { useKeyboardAnswer } from "../hooks/useKeyboardAnswer";

const pad2 = (n) => String(n).padStart(2, "0");

/** Group consecutive problem sections that share the same part label (语言知识 / 阅读 / 听力). */
function groupByPart(problemSections) {
  const parts: { label: string; sections: any[] }[] = [];
  for (const section of problemSections) {
    const last = parts[parts.length - 1];
    if (last?.label === section.partLabel) last.sections.push(section);
    else parts.push({ label: section.partLabel, sections: [section] });
  }
  return parts;
}

export function AnswerSheet({ exam, problemSections, currentProblem, answers, questionIndexById, onJump, onJumpProblem }) {
  return (
    <aside className="answer-sheet">
      <div className="book-pill subject-reading">{exam.level} · {exam.title}</div>
      <div className="answer-section-list">
        {groupByPart(problemSections).map((part) => (
          <section className="answer-part" key={part.label}>
            <div className="sheet-title">- {part.label} -</div>
            {part.sections.map((section) => (
              <section className={`answer-section ${section.id === currentProblem?.id ? "active" : ""}`} key={section.id}>
                <button className="answer-section-title" onClick={() => onJumpProblem(problemSections.indexOf(section))} type="button">
                  <span>{section.problemLabel}</span>
                  <small>{section.questions.filter((q) => answers[q.id]).length}/{section.questions.length}</small>
                </button>
                <div className="answer-grid">
                  {section.questions.map((item, i) => (
                    <button
                      key={item.id}
                      className={`answer-dot ${answers[item.id] ? "answered" : ""}`}
                      onClick={() => onJump(questionIndexById.get(item.id) || 0)}
                      type="button"
                    >
                      {pad2(examQuestionDisplayNumber(section, item, i, questionIndexById))}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

export function ListeningExamPlayer({ audioRef, audioUrl, audioError, started, onStart, onEnded, onError }) {
  const failed = Boolean(audioError || !audioUrl);
  return (
    <section className={`listening-exam-player ${failed ? "error" : ""}`}>
      <Headphones size={28} />
      <div>
        <strong>{failed ? "听力音频加载失败" : started ? "听力音频播放中" : "准备播放听力音频"}</strong>
        <p>{audioError || (!audioUrl ? "当前题组缺少音频，请重试或稍后继续考试。" : "音频只能播放一次，结束后将自动进入下一组。")}</p>
      </div>
      {!started
        ? <button className="primary-button" type="button" disabled={!audioUrl} onClick={onStart}>{audioError ? "重新加载" : "开始播放"}</button>
        : <span>正在播放</span>}
      <audio ref={audioRef} src={assetSrc(audioUrl)} preload="auto" onEnded={onEnded} onError={onError} controls={false} />
    </section>
  );
}

function ReviewItem({ question, answer, displayNumber, index, hasGroupPassage }) {
  const reading = isReadingQuestion(question);
  const listening = isListeningQuestion(question);
  const plain = !listening && !reading;
  const ownPassage = !hasGroupPassage;
  return (
    <article className="review-item exam-review-item" id={`exam-review-${answer.questionId}`}>
      <ReviewMark ok={answer.isCorrect} />
      <div>
        <div className="review-title-row">
          <span className="review-question-number">{displayNumber}</span>
          <div className="review-title"><HtmlContent html={answer.title || question?.title || ""} /></div>
        </div>
        {question?.image_url ? <img className="review-image" src={assetSrc(question.image_url)} alt="" /> : null}
        {question?.media_url ? <audio className="exam-audio compact" controls src={assetSrc(question.media_url)} /> : null}
        {listening && (question?.subtitle || question?.translation)
          ? <BilingualTranscript sourceHtml={question.subtitle} translationHtml={question.translation} /> : null}
        {ownPassage && reading && (question?.passage || question?.translation)
          ? <BilingualTranscript sourceHtml={question.passage} translationHtml={question.translation} variant="reading" /> : null}
        {ownPassage && !reading && question?.passage ? <HtmlContent html={question.passage} /> : null}
        {answer.unanswered ? <p className="review-unanswered">未作答</p> : null}
        {question?.options?.length ? (
          <ReviewOptions
            options={question.options}
            questionId={answer.questionId}
            chosenOptionId={answer.chosenOptionId}
            correctOptionId={answer.correctOptionId}
            label={`${index + 1}番の選択肢`}
          />
        ) : null}
        {answer.analysis ? <section className="analysis-text"><HtmlContent inline html={answer.analysis} /></section> : null}
        {ownPassage && plain && question?.translation
          ? <section className="translation-block"><HtmlContent html={question.translation} /></section> : null}
      </div>
    </article>
  );
}

function PassageGroupHeader({ group }) {
  if (!group.passage) return null;
  const reading = isReadingQuestion(group.question);
  if (reading) return <BilingualTranscript sourceHtml={group.passage} translationHtml={group.translation} variant="reading" />;
  return (
    <>
      <section className="review-shared-passage"><HtmlContent html={group.passage} /></section>
      {!isListeningQuestion(group.question) && group.translation
        ? <section className="translation-block"><HtmlContent html={group.translation} /></section> : null}
    </>
  );
}

export function ExamReview({ reviewProblemGroups, answerByQuestion, answerForQuestion }) {
  const orderedIds = useMemo(
    () => reviewProblemGroups.flatMap((group) => group.sections.flatMap((section) => section.items.map((item) => item.question.id))),
    [reviewProblemGroups],
  );
  const [focusIndex, setFocusIndex] = useState(0);
  const jumpToIndex = (index) => {
    if (!orderedIds.length) return;
    const clamped = Math.max(0, Math.min(orderedIds.length - 1, index));
    setFocusIndex(clamped);
    document.getElementById(`exam-review-${orderedIds[clamped]}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // B3: ← → walk through questions in display order.
  useKeyboardAnswer({ onPrev: () => jumpToIndex(focusIndex - 1), onNext: () => jumpToIndex(focusIndex + 1) });

  return (
    <div className="result-review-layout">
      <aside className="review-jump-panel" aria-label="复习题目导航">
        <div className="review-jump-title">题号</div>
        {reviewProblemGroups.map((group) => (
          <section className="review-jump-section" key={group.label}>
            <div className="review-jump-group-title">{group.label}</div>
            {group.sections.map((section) => (
              <section className="review-jump-problem" key={section.id}>
                <div className="review-jump-problem-title">{section.problemLabel}</div>
                <div className="review-jump-grid">
                  {section.items.map(({ question, displayNumber }) => (
                    <Tooltip
                      key={question.id}
                      className="jump-tip"
                      tip={`${displayNumber}番 · ${answerByQuestion.get(question.id)?.isCorrect ? "正确" : "有误"}`}
                    >
                      <button
                        aria-label={`${group.label} ${section.problemLabel} ${displayNumber}番`}
                        className={[
                          "review-jump-dot",
                          answerByQuestion.get(question.id)?.isCorrect ? "right" : "miss",
                          question.id === orderedIds[focusIndex] ? "focused" : "",
                        ].filter(Boolean).join(" ")}
                        onClick={() => jumpToIndex(orderedIds.indexOf(question.id))}
                        type="button"
                      >
                        {displayNumber}
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </section>
            ))}
          </section>
        ))}
      </aside>

      <section className="review-list">
        {reviewProblemGroups.map((group) => (
          <section className="review-part-block" key={group.label}>
            <div className="review-part-heading">{group.label}</div>
            {group.sections.map((section) => (
              <section className="review-problem-block" key={section.id}>
                <div className="review-problem-heading">{section.problemLabel}</div>
                {section.layer?.image_url ? <img className="review-image" src={assetSrc(section.layer.image_url)} alt="" /> : null}
                {groupReviewItemsByPassage(section.items).map((passageGroup, groupIndex) => (
                  <section
                    className={`review-passage-group ${passageGroup.passage ? "has-shared-passage" : "single-question-group"}`}
                    key={`${section.id}-${passageGroup.key}-${groupIndex}`}
                  >
                    <PassageGroupHeader group={passageGroup} />
                    {passageGroup.items.map(({ question, index, displayNumber }) => (
                      <ReviewItem
                        key={`${question.id}-${index}`}
                        question={question}
                        answer={answerForQuestion(question)}
                        displayNumber={displayNumber}
                        index={index}
                        hasGroupPassage={Boolean(passageGroup.passage)}
                      />
                    ))}
                  </section>
                ))}
              </section>
            ))}
          </section>
        ))}
      </section>
    </div>
  );
}
