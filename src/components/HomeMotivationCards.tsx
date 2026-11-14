import React, { useEffect, useMemo, useState } from "react";
import { fetchStatsOverview } from "../lib/study";
import { readExamTarget, writeExamTarget } from "../lib/appHelpers";
import { daysUntilExam, examLabel, examPillLabel, resolveSelectedExam, upcomingExams } from "../lib/examDates";
import { weekDots } from "../lib/stats";
import { usePreferencesStore } from "../stores/preferences";
import UiSelect from "./UiSelect";

// T-030/T-033 首页动机两卡（决策 D22/D26）：考试倒计时 + 学习连续周卡。
// 位于「继续学习」卡上方并排的窄横卡；数据失败静默降级，不影响首屏其余区块。
// T-033 迭代：倒计时卡改上下两行（左上考试 pill + 左下大字）；周卡改顶行
// 「N 天连续 + 本周 N/7」+ 星期标签点阵 + 今天描边；streak=0 也显示 0 + 点阵（D26.1）。
const STREAK_DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"]; // 与 weekDots 周一起始一致

function ExamCountdownCard() {
  // 每次挂载取一次当天，倒计时精度到「天」，无需定时刷新
  const today = useMemo(() => new Date(), []);
  const exams = useMemo(() => upcomingExams(today), [today]);
  // localStorage 记忆仍有效则选中，否则默认下一个考试（AC③）；过期记忆不回写
  const [storedExam, setStoredExam] = useState(readExamTarget);
  const selected = resolveSelectedExam(storedExam, exams);
  const exam = exams.find((item) => item.date === selected);
  if (!exam) return null;
  const days = daysUntilExam(exam.date, today);
  return (
    <section className="motivation-card home-countdown-card" aria-label="考试倒计时">
      <UiSelect
        className="motivation-exam-pill"
        ariaLabel="目标考试"
        quiet
        value={exam.date}
        selectedLabel={examPillLabel(exam)}
        options={exams.map((item) => ({ value: item.date, label: examLabel(item) }))}
        onChange={(value) => {
          writeExamTarget(value);
          setStoredExam(value);
        }}
      />
      <div className="motivation-info">
        {days === 0 ? (
          <strong>就是今天</strong>
        ) : (
          <strong>
            <em>距考试</em> {days} <em>天</em>
          </strong>
        )}
      </div>
    </section>
  );
}

function StreakWeekCard({ activity, streak, loading }: { activity: any[]; streak: any; loading: boolean }) {
  // loading 先渲染卡片骨架避免布局跳动；streak 数据不可用时整卡隐藏
  if (loading) {
    return (
      <section className="motivation-card home-streak-card" aria-label="学习连续">
        <span className="motivation-placeholder">…</span>
      </section>
    );
  }
  if (!streak) return null;
  // streak=0 与 >0 共用渲染（D26.1）：0 天连续 + 点阵 + 今天描边，本身就是行动引导
  const dots = weekDots(activity);
  const activeCount = dots.filter((dot) => !dot.future && dot.answered > 0).length;
  return (
    <section className="motivation-card home-streak-card" aria-label="学习连续">
      <div className="streak-head">
        <strong>{streak.current} <em>天连续</em></strong>
        <small>本周 {activeCount}/7</small>
      </div>
      <div className="streak-week" aria-hidden="true">
        {dots.map((dot, index) => (
          <span key={dot.date} className="streak-day">
            <small>{STREAK_DAY_LABELS[index]}</small>
            <i
              className={[
                dot.answered > 0 && !dot.future ? "active" : "",
                dot.isToday ? "today" : "",
                dot.future ? "future" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          </span>
        ))}
      </div>
    </section>
  );
}

export default function HomeMotivationCards({ token }: { token: string }) {
  const level = usePreferencesStore((state) => state.level);
  // 复用统计页 overview 接口；失败整卡隐藏，不影响倒计时卡与首屏其余区块
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchStatsOverview(level, token)
      .then((data) => {
        if (alive) {
          setOverview(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [level, token]);

  return (
    <div className="home-motivation-row">
      <ExamCountdownCard />
      {loading ? (
        <StreakWeekCard activity={[]} streak={null} loading />
      ) : overview ? (
        <StreakWeekCard activity={overview.activity || []} streak={overview.streak} loading={false} />
      ) : null}
    </div>
  );
}
