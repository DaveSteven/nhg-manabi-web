import React, { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { fetchStatsOverview } from "../lib/study";
import { readExamTarget, writeExamTarget } from "../lib/appHelpers";
import { daysUntilExam, examLabel, resolveSelectedExam, upcomingExams } from "../lib/examDates";
import { weekDots } from "../lib/stats";
import { usePreferencesStore } from "../stores/preferences";
import UiSelect from "./UiSelect";

// T-030 首页动机两卡（决策 D22）：考试倒计时 + 学习连续周卡。
// 位于「继续学习」卡上方并排的窄横卡；数据失败静默降级，不影响首屏其余区块。
const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

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
      <div className="motivation-info">
        <small>距离 {examLabel(exam)}统考</small>
        {days === 0 ? (
          <strong>就是今天</strong>
        ) : (
          <strong>{days} <em>天</em></strong>
        )}
      </div>
      <UiSelect
        className="motivation-exam-select"
        ariaLabel="目标考试"
        compact
        value={exam.date}
        options={exams.map((item) => ({ value: item.date, label: examLabel(item) }))}
        onChange={(value) => {
          writeExamTarget(value);
          setStoredExam(value);
        }}
      />
    </section>
  );
}

function StreakWeekCard({ activity, streak, loading }: { activity: any[]; streak: any; loading: boolean }) {
  // streak=0 走引导文案（不渲染 0 大字与灰点阵，AC①）；loading 先渲染卡片骨架避免布局跳动
  if (loading) {
    return (
      <section className="motivation-card home-streak-card" aria-label="学习连续">
        <span className="motivation-placeholder">…</span>
      </section>
    );
  }
  if (streak && streak.current > 0) {
    const dots = weekDots(activity);
    const activeCount = dots.filter((dot) => !dot.future && dot.answered > 0).length;
    return (
      <section className="motivation-card home-streak-card" aria-label="学习连续">
        <div className="motivation-info">
          <small>连续学习</small>
          <strong>{streak.current} <em>天连续</em></strong>
        </div>
        <div className="streak-week">
          <div className="streak-dots" aria-hidden="true">
            {dots.map((dot) => (
              <span
                key={dot.date}
                className={dot.answered > 0 && !dot.future ? "active" : ""}
              />
            ))}
          </div>
          <small>本周 {activeCount}/7</small>
        </div>
      </section>
    );
  }
  if (streak) {
    const weekday = WEEKDAY_LABELS[new Date().getDay()];
    return (
      <section className="motivation-card home-streak-card guidance" aria-label="学习连续">
        <Flame size={18} aria-hidden="true" />
        <span>连续学习从今天开始，做 1 题点亮{weekday}</span>
      </section>
    );
  }
  return null;
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
