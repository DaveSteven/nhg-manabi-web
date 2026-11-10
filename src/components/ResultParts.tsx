import React, { useEffect } from "react";
import { Check, Minus, X } from "lucide-react";
import { HtmlContent, HtmlInline, hasVisibleHtml } from "./Html";
import { PageHeader, PetalFall } from "./CommonUi";

/**
 * 练习结果页的通用骨架（专项练习 / 基础题库 / 听力专项共用）。
 * 样式见 styles/_practiceResult.scss。模拟考试结果页不走这里。
 */

export type ResultStatus = "correct" | "wrong" | "skipped";
export type ResultFilter = "all" | "missed";

export const STATUS_LABEL: Record<ResultStatus, string> = { correct: "答对", wrong: "答错", skipped: "未作答" };
const STATUS_ICON: Record<ResultStatus, React.ReactNode> = {
  correct: <Check size={15} />,
  wrong: <X size={15} />,
  skipped: <Minus size={15} />,
};

export function answerStatus(answer): ResultStatus {
  if (!answer?.chosenOptionId) return "skipped";
  return answer.isCorrect ? "correct" : "wrong";
}

export function countStatuses(statuses: ResultStatus[]) {
  const counts = { correct: 0, wrong: 0, skipped: 0 };
  statuses.forEach((status) => { counts[status] += 1; });
  return counts;
}

export const resultQuestionAnchor = (id) => `practice-result-q-${id}`;

/** 页面外壳：页头（可选）+ 进入时回到顶部 + 花瓣。 */
export function ResultPage({ title = null, eyebrow = "练习结果", onBack = null, backLabel = "返回", petals = null, children }: {
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  onBack?: (() => void) | null;
  backLabel?: string;
  petals?: "light" | "full" | null;
  children: React.ReactNode;
}) {
  // 结果页是从长长的练习页切过来的，进入时回到顶部先看成绩。
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <section className="practice-result">
      {petals ? <PetalFall variant={petals} /> : null}
      {title ? (
        <PageHeader onBack={onBack} label={backLabel}>
          <div className="practice-result-heading">
            <small>{eyebrow}</small>
            <strong>{title}</strong>
          </div>
        </PageHeader>
      ) : null}
      {children}
    </section>
  );
}

export const scoreTone = (score: number) => (score >= 80 ? "great" : score >= 60 ? "good" : "low");

/** 成绩卡：左侧正确率，右侧统计行 / 题型条 / 操作按钮。 */
export function ResultSummary({ score, counts, total, headline = null, types = [], actions, note = null }: {
  score: number;
  counts: { correct: number; wrong: number; skipped: number };
  total: number;
  headline?: React.ReactNode;
  types?: Array<{ id: any; label: string; correct: number; total: number }>;
  actions: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <section className={`practice-result-summary tone-${scoreTone(score)}`} aria-label="本次成绩">
      <div className="practice-result-score">
        <strong>{score}<span>%</span></strong>
        <small>正确率</small>
      </div>
      <div className="practice-result-body">
        {headline ? <p className="practice-result-headline">{headline}</p> : null}
        <ul className="practice-result-tally" aria-label="作答统计">
          <li className="correct"><span>答对</span><strong>{counts.correct}</strong></li>
          <li className="wrong"><span>答错</span><strong>{counts.wrong}</strong></li>
          <li className="skipped"><span>未作答</span><strong>{counts.skipped}</strong></li>
          <li className="total"><span>共</span><strong>{total}</strong><span>题</span></li>
        </ul>
        {types.length ? (
          <ul className="practice-result-types" aria-label="题型正确率">
            {types.map((type) => {
              const value = type.total ? Math.round((type.correct / type.total) * 100) : 0;
              return (
                <li key={type.id}>
                  <span>{type.label}</span>
                  <div className="practice-result-bar" role="img" aria-label={`${type.label} 答对 ${type.correct} / ${type.total}`}><i style={{ width: `${value}%` }} /></div>
                  <small>{type.correct} / {type.total}</small>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="practice-result-actions">{actions}</div>
        {note ? <p className="practice-result-note">{note}</p> : null}
      </div>
    </section>
  );
}

export type ResultNavChunk = { key: string; shared: boolean; entries: Array<{ id: any; number: number; status: ResultStatus }> };

/** 题目解析区：标题 + 筛选 + 左侧题号导航 + 右侧题目列表（children）。 */
export function ResultReview({ chunks, total, missed, filter, onFilter, children }: {
  chunks: ResultNavChunk[];
  total: number;
  missed: number;
  filter: ResultFilter;
  onFilter: (filter: ResultFilter) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="practice-result-review" aria-labelledby="practice-result-review-title">
      <header className="practice-result-review-heading">
        <h2 id="practice-result-review-title">题目解析</h2>
        <div className="practice-result-filter" role="group" aria-label="筛选题目">
          <button aria-pressed={filter === "all"} onClick={() => onFilter("all")} type="button">全部 {total}</button>
          <button aria-pressed={filter === "missed"} disabled={!missed} onClick={() => onFilter("missed")} type="button">错题与未作答 {missed}</button>
        </div>
      </header>
      <div className="practice-result-review-layout">
        <nav className="practice-result-nav" aria-label="题号导航">
          {chunks.map((chunk) => (
            <div className={`practice-result-nav-group ${chunk.shared ? "shared" : ""}`.trim()} key={chunk.key}>
              {chunk.entries.map((entry) => {
                const hidden = filter === "missed" && entry.status === "correct";
                return (
                  <a
                    aria-label={`第 ${entry.number} 题，${STATUS_LABEL[entry.status]}`}
                    className={`${entry.status} ${hidden ? "dimmed" : ""}`.trim()}
                    href={hidden ? undefined : `#${resultQuestionAnchor(entry.id)}`}
                    key={entry.id}
                  >{entry.number}</a>
                );
              })}
            </div>
          ))}
          <div className="practice-result-legend" aria-hidden="true">
            <span className="correct">答对</span><span className="wrong">答错</span><span className="skipped">未作答</span>
          </div>
        </nav>
        <div className="practice-result-groups">{children}</div>
      </div>
    </section>
  );
}

/** 把一串单题合成一个导航块（没有共享材料的结果页用）。 */
export function singleNavChunk(entries: ResultNavChunk["entries"]): ResultNavChunk[] {
  return [{ key: "all", shared: false, entries }];
}

/** 一道题的复盘卡片。没有选项数据时退回「你的答案 / 正确答案」文字对照。 */
export function ResultQuestion({ id, number, status, meta = null, stem, media = null, options = [], chosenId = null, correctId = null, chosenText = null, answerText = null, analysis = null, children = null }: {
  id: any;
  number: number;
  status: ResultStatus;
  meta?: React.ReactNode;
  stem: React.ReactNode;
  media?: React.ReactNode;
  options?: Array<{ id: any; text: any }>;
  chosenId?: any;
  correctId?: any;
  chosenText?: any;
  answerText?: any;
  analysis?: any;
  children?: React.ReactNode;
}) {
  return (
    <section className={`practice-result-question ${status}`} id={resultQuestionAnchor(id)}>
      <header>
        <span className="practice-result-number">{number}</span>
        <span className={`practice-result-status ${status}`}>{STATUS_ICON[status]}{STATUS_LABEL[status]}</span>
        {meta ? <small>{meta}</small> : null}
      </header>
      {stem ? <div className="practice-result-stem">{stem}</div> : null}
      {media}
      {options.length ? (
        <ol className="practice-result-options">
          {options.map((option, index) => {
            const isCorrect = option.id === correctId;
            const isChosen = option.id === chosenId;
            return (
              <li className={isCorrect ? "correct" : isChosen ? "wrong" : ""} key={option.id}>
                <span className="practice-result-option-index">{index + 1}</span>
                <span className="practice-result-option-text"><HtmlInline html={option.text} /></span>
                {isCorrect ? <em>正确答案</em> : null}
                {isChosen && !isCorrect ? <em>你的选择</em> : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <dl className="practice-result-answer-pair">
          <div className={status === "correct" ? "correct" : "wrong"}><dt>你的答案</dt><dd>{chosenText ? <HtmlInline html={chosenText} /> : "未作答"}</dd></div>
          {status !== "correct" ? <div className="correct"><dt>正确答案</dt><dd><HtmlInline html={answerText} /></dd></div> : null}
        </dl>
      )}
      {hasVisibleHtml(analysis)
        ? <div className="practice-result-analysis"><strong>解析</strong><HtmlContent inline html={analysis} /></div>
        : null}
      {children}
    </section>
  );
}

/** 只有单题（无共享材料）时用的外框。 */
export function ResultGroupCard({ children }) {
  return <article className="practice-result-group">{children}</article>;
}
