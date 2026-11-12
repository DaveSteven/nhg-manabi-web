import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Flame,
  LineChart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Tooltip } from "../components/Tooltip";
import { EmptyState, PageHeader, ThemeToggle } from "../components/CommonUi";
import { fetchStatsExams, fetchStatsOverview, fetchStatsTrend } from "../lib/study";
import {
  compareRecentActivity,
  examPerformanceView,
  examScoreDelta,
  formatStatDate,
  heatLevel,
} from "../lib/stats";

const SUBJECT_COLORS = {
  vocabulary: "var(--chart-vocabulary)",
  grammar: "var(--chart-grammar)",
  reading: "var(--chart-reading)",
  listening: "var(--chart-listening)",
};

function changeText(value, suffix = "%") {
  if (value === null) return null;
  if (value === 0) return "与上个 30 天持平";
  return `比上个 30 天${value > 0 ? "提升" : "下降"} ${Math.abs(value)}${suffix}`;
}

function MetricCard({ icon: Icon, label, value, detail, tone = "" }) {
  return (
    <article className={`stats-metric-card ${tone}`.trim()}>
      <span className="stats-metric-icon"><Icon size={21} /></span>
      <div><small>{label}</small><strong>{value}</strong>{detail ? <p>{detail}</p> : null}</div>
    </article>
  );
}

function ActivityHeatmap({ activity }) {
  const maximum = Math.max(0, ...activity.map((item) => item.answered));
  const padding = activity.length ? new Date(`${activity[0].date}T00:00:00`).getDay() : 0;
  const cells = [...Array.from({ length: padding }, () => null), ...activity];
  return (
    <div className="stats-heatmap-wrap">
      <div className="stats-heatmap" role="img" aria-label="近一年每日学习题数热力图">
        {cells.map((item, index) => item ? (
          <Tooltip
            key={item.date}
            tip={`${formatStatDate(item.date)} · ${item.answered} 题 · 答对 ${item.correct} 题`}
            className={index % 7 < 3 ? "heat-tip-below" : ""}
          >
            <span className={`heat-cell heat-${heatLevel(item.answered, maximum)}`} aria-hidden="true" />
          </Tooltip>
        ) : <span className="heat-cell heat-blank" key={`blank-${index}`} />)}
      </div>
      <div className="heat-legend"><span>少</span>{[0, 1, 2, 3, 4].map((level) => <i className={`heat-cell heat-${level}`} key={level} />)}<span>多</span></div>
    </div>
  );
}

function AccuracyLineChart({ points }) {
  const chartPoints = points.filter((point) => point.accuracy !== null);
  if (!chartPoints.length) return <EmptyState title="暂无正确率数据" />;
  const width = 720;
  const height = 220;
  const padX = 34;
  const padY = 24;
  const x = (index) => chartPoints.length === 1 ? width / 2 : padX + index / (chartPoints.length - 1) * (width - padX * 2);
  const y = (accuracy) => padY + (100 - accuracy) / 100 * (height - padY * 2);
  const path = chartPoints.map((point, index) => `${x(index)},${y(point.accuracy)}`).join(" ");
  return (
    <div className="stats-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="正确率趋势折线图">
        {[0, 50, 100].map((value) => (
          <g key={value}>
            <line x1={padX} x2={width - padX} y1={y(value)} y2={y(value)} className="chart-grid-line" />
            <text x="2" y={y(value) + 4}>{value}%</text>
          </g>
        ))}
        {chartPoints.length > 1 ? <polyline points={path} className="chart-line" /> : null}
        {chartPoints.map((point, index) => (
          <circle key={`${point.period}-${index}`} cx={x(index)} cy={y(point.accuracy)} r="5" className="chart-node" tabIndex={0}>
            <title>{`${formatStatDate(point.period)} · 正确率 ${point.accuracy}% · ${point.answered} 题`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-axis-labels"><span>{formatStatDate(chartPoints[0].period)}</span><span>{formatStatDate(chartPoints.at(-1).period)}</span></div>
    </div>
  );
}

function SubjectBars({ subjects, onAction }) {
  return (
    <div className="stats-subject-list">
      {subjects.map((item) => (
        <Tooltip key={item.subject} tip={item.total ? `${item.correct}/${item.total} 题答对` : `${item.label}暂无练习数据`}>
          <button type="button" className="stats-subject-row" onClick={() => onAction(item.subject)}>
            <span className="subject-name"><i style={{ background: SUBJECT_COLORS[item.subject] }} />{item.label}</span>
            <span className="subject-track"><i style={{ width: `${item.accuracy || 0}%`, background: SUBJECT_COLORS[item.subject] }} /></span>
            <strong>{item.accuracy === null ? "—" : `${item.accuracy}%`}</strong>
            <ArrowRight size={17} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

/** T-013：三大块行点击后的练习去向（言語知識 → 较弱子科目）。 */
function examSectionActionSubject(section) {
  if (section.section === "listening") return "listening";
  if (section.section === "reading") return "reading";
  const measured = section.parts.filter((part) => part.accuracy !== null);
  return measured.sort((left, right) => left.accuracy - right.accuracy)[0]?.subject || "grammar";
}

/** 三大块条形：复用 stats-subject-row；言語知識按各子科目答对占比堆叠双段。 */
function ExamSectionBars({ sections, onAction }) {
  return (
    <div className="stats-subject-list">
      {sections.map((section) => {
        const stacked = section.parts.length > 1;
        return (
          <Tooltip key={section.section} tip={section.total ? `${section.correct}/${section.total} 题答对` : `${section.label}暂无练习数据`}>
            <button type="button" className="stats-subject-row" onClick={() => onAction(examSectionActionSubject(section))}>
              <span className="subject-name">{section.label}</span>
              <span className={`subject-track${stacked ? " subject-track--stacked" : ""}`}>
                {section.total
                  ? section.parts.map((part) => (
                    <i
                      key={part.subject}
                      style={{ width: `${part.correct / section.total * 100}%`, background: SUBJECT_COLORS[part.subject] }}
                    />
                  ))
                  : null}
              </span>
              <strong>{section.accuracy === null ? "—" : `${section.accuracy}%`}</strong>
              <ArrowRight size={17} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** 真题分数曲线：节点可点击进对应回顾页（区别于趋势图的纯查看）。 */
function ExamScoreChart({ points, onReviewAttempt }) {
  const chartPoints = points.filter((point) => point.score !== null);
  if (!chartPoints.length) return null;
  const width = 720;
  const height = 220;
  const padX = 34;
  const padY = 24;
  const x = (index) => chartPoints.length === 1 ? width / 2 : padX + index / (chartPoints.length - 1) * (width - padX * 2);
  const y = (score) => padY + (100 - score) / 100 * (height - padY * 2);
  const path = chartPoints.map((point, index) => `${x(index)},${y(point.score)}`).join(" ");
  const review = (point) => onReviewAttempt({ examId: point.examId, id: point.attemptId });
  return (
    <div className="stats-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="真题分数折线图">
        {[0, 50, 100].map((value) => (
          <g key={value}>
            <line x1={padX} x2={width - padX} y1={y(value)} y2={y(value)} className="chart-grid-line" />
            <text x="2" y={y(value) + 4}>{value}%</text>
          </g>
        ))}
        {chartPoints.length > 1 ? <polyline points={path} className="chart-line" /> : null}
        {chartPoints.map((point, index) => (
          <circle
            key={`${point.attemptId}-${index}`}
            cx={x(index)}
            cy={y(point.score)}
            r="5"
            className="chart-node chart-node--action"
            tabIndex={0}
            role="button"
            aria-label={`${point.title} ${point.score}%，查看该次解析`}
            onClick={() => review(point)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") review(point);
            }}
          >
            <title>{`${point.title} ${point.score}% · 点击查看该次解析`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-axis-labels">
        <span>{formatStatDate(chartPoints[0].createdAt.slice(0, 10))}</span>
        <span>{formatStatDate(chartPoints.at(-1).createdAt.slice(0, 10))}</span>
      </div>
    </div>
  );
}

export function StatsView({ level, token, onBack, onAction, onExams, onReviewAttempt }) {
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [examStats, setExamStats] = useState(null);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetchStatsOverview(level, token),
      fetchStatsTrend({ level, days, granularity: days <= 90 ? "day" : "week" }, token),
      fetchStatsExams(level, token),
    ]).then(([nextOverview, nextTrend, nextExamStats]) => {
      if (!ignore) { setOverview(nextOverview); setTrend(nextTrend.points); setExamStats(nextExamStats); }
    }).catch((reason) => {
      if (!ignore) setError(reason.message || "统计数据加载失败");
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, [days, level, token]);

  const comparison = useMemo(() => compareRecentActivity(overview?.activity || []), [overview]);
  const weakest = useMemo(() => {
    const measured = (overview?.breakdown_by_subject || []).filter((item) => item.accuracy !== null);
    return measured.sort((left, right) => left.accuracy - right.accuracy)[0] || null;
  }, [overview]);
  const examPerformance = useMemo(() => examPerformanceView(examStats), [examStats]);
  const examPoints = examPerformance.points;
  const latestExamPoint = examPoints.at(-1) || null;
  const examDelta = examScoreDelta(examPoints);
  const weakestExamSection = useMemo(() => {
    const measured = examPerformance.sections.filter((item) => item.accuracy !== null);
    return measured.sort((left, right) => left.accuracy - right.accuracy)[0] || null;
  }, [examPerformance]);

  if (loading && !overview) return <div className="center-state">加载中…</div>;
  if (error && !overview) return <div className="center-state error">{error}</div>;

  const totals = overview.totals;
  const hasData = totals.questions_answered > 0;
  return (
    <section className="stats-page">
      <PageHeader onBack={onBack} className="stats-header">
        <div className="stats-title"><small>{level} 学习报告</small><h1>数据中心</h1></div>
        <ThemeToggle />
      </PageHeader>

      {!hasData ? (
        <section className="stats-empty-card">
          <Sparkles size={36} />
          <h2>暂无学习记录</h2>
          <button className="primary-button" type="button" onClick={() => onAction("vocabulary")}>开始练习</button>
        </section>
      ) : (
        <>
          <div className="stats-metric-grid">
            <MetricCard icon={BookOpenCheck} label="累计做题" value={`${totals.questions_answered} 题`} detail={changeText(comparison.volumeChange)} />
            <MetricCard icon={BarChart3} label="总正确率" value={`${totals.overall_accuracy}%`} detail={changeText(comparison.accuracyChange, " 个百分点")} />
            <MetricCard icon={Flame} label="连续学习" value={`${overview.streak.current} 天`} detail={`最长连续 ${overview.streak.longest} 天`} tone="streak" />
            <MetricCard icon={Target} label="累计考试" value={`${totals.exam_attempts} 次`} detail={`另有 ${totals.practice_attempts + totals.listening_attempts} 次练习`} />
          </div>

          <div className="stats-layout">
            <main className="stats-main-column">
              <section className="stats-panel">
                <div className="stats-panel-heading"><div><span><CalendarDays size={20} /> 学习热力图</span><h2>近一年学习记录</h2></div><strong>连续 {overview.streak.current} 天</strong></div>
                <ActivityHeatmap activity={overview.activity} />
                <div className="stats-conclusion"><p>{comparison.recent.answered ? `最近 30 天完成 ${comparison.recent.answered} 题。` : "最近 30 天暂无学习记录。"}</p><button type="button" onClick={() => onAction(weakest?.subject || "vocabulary")}>开始练习 <ArrowRight size={16} /></button></div>
              </section>

              <section className="stats-panel">
                <div className="stats-panel-heading trend-heading"><div><span><TrendingUp size={20} /> 正确率趋势</span><h2>正确率变化</h2></div><div className="stats-range-tabs">{[[90, "90 天"], [180, "半年"], [365, "一年"]].map(([value, label]) => <button className={days === Number(value) ? "active" : ""} onClick={() => setDays(Number(value))} type="button" key={value}>{label}</button>)}</div></div>
                <AccuracyLineChart points={trend} />
                <div className="stats-conclusion"><p>{comparison.accuracyChange === null ? "暂无对比数据。" : comparison.accuracyChange === 0 ? "最近 30 天正确率与上个 30 天持平。" : comparison.accuracyChange > 0 ? `最近 30 天正确率上升 ${comparison.accuracyChange} 个百分点。` : `最近 30 天正确率下降 ${Math.abs(comparison.accuracyChange)} 个百分点。`}</p><button type="button" onClick={() => onAction(weakest?.subject || "grammar")}>专项练习 <ArrowRight size={16} /></button></div>
              </section>

              <section className="stats-panel">
                <div className="stats-panel-heading"><div><span><BarChart3 size={20} /> 科目统计</span><h2>各科正确率</h2></div></div>
                <SubjectBars subjects={overview.breakdown_by_subject} onAction={onAction} />
                <div className="stats-conclusion"><p>{weakest ? `${weakest.label}正确率最低（${weakest.accuracy}%）。` : "暂无科目数据。"}</p><button type="button" onClick={() => onAction(weakest?.subject || "reading")}>开始{weakest?.label || "科目"}专项 <ArrowRight size={16} /></button></div>
              </section>

              {examPoints.length ? (
                <section className="stats-panel">
                  <div className="stats-panel-heading"><div><span><LineChart size={20} /> 真题成绩</span><h2>分数走势与三大块</h2></div><span className="stats-goal-badge">目标分未设置</span></div>
                  <ExamScoreChart points={examPoints} onReviewAttempt={onReviewAttempt} />
                  <div className="stats-conclusion">
                    <p>{latestExamPoint ? `最近一次 ${latestExamPoint.title} ${latestExamPoint.score}%${examDelta === null ? "" : examDelta === 0 ? "，与上次持平" : `，较上次${examDelta > 0 ? " ↑" : " ↓"}${Math.abs(examDelta)}`}` : "暂无真题成绩。"}</p>
                    {latestExamPoint ? <button type="button" onClick={() => onReviewAttempt({ examId: latestExamPoint.examId, id: latestExamPoint.attemptId })}>查看最近解析 <ArrowRight size={16} /></button> : null}
                  </div>
                  <ExamSectionBars sections={examPerformance.sections} onAction={onAction} />
                  <div className="stats-conclusion"><p>{weakestExamSection ? `${weakestExamSection.label}正确率最低（${weakestExamSection.accuracy}%）。` : "暂无三大块数据。"}</p><button type="button" onClick={() => onAction(weakestExamSection ? examSectionActionSubject(weakestExamSection) : "grammar")}>{weakestExamSection ? `${weakestExamSection.label}专项练习` : "开始练习"} <ArrowRight size={16} /></button></div>
                </section>
              ) : null}
            </main>

            <aside className="stats-insights" aria-label="学习概况">
              <div className="stats-insights-title"><Sparkles size={19} /><h2>学习概况</h2></div>
              <article><span className="insight-icon weak"><TrendingDown size={19} /></span><small>薄弱科目</small><h3>{weakest ? `${weakest.label}正确率最低` : "暂无科目数据"}</h3><button type="button" onClick={() => onAction(weakest?.subject || "reading")}>去专项练习 <ArrowRight size={15} /></button></article>
              <article><span className="insight-icon"><Flame size={19} /></span><small>连续学习</small><h3>{overview.streak.current ? `已连续学习 ${overview.streak.current} 天` : "当前连续学习 0 天"}</h3><p>最长连续学习 {overview.streak.longest} 天。</p><button type="button" onClick={() => onAction("grammar")}>开始练习 <ArrowRight size={15} /></button></article>
              <article><span className="insight-icon exam"><Target size={19} /></span><small>模拟考试</small><h3>{totals.exam_attempts ? `已完成 ${totals.exam_attempts} 次模拟考试` : "暂无考试成绩"}</h3><button type="button" onClick={onExams}>查看模拟考试 <ArrowRight size={15} /></button></article>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
