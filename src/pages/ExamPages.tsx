import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, ClipboardList, Clock3, Headphones, Keyboard, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import {
  assetSrc,
  buildExamProblemSections,
  buildReviewProblemGroups,
  calculateExamScore,
  countAnsweredQuestions,
  examQuestionCategoryLabel,
  examQuestionDisplayNumber,
  examSectionsForLevel,
  formatClock,
  groupQuestionsByPassage,
  latestExamAttemptByExam,
  pct,
  secondsUntil,
} from "../lib/study";
import { practiceQuestionGroups } from "../lib/appHelpers";
import { HtmlContent, hasVisibleHtml } from "../components/Html";
import {
  EmptyState,
  KeyboardToast,
  ModalOverlay,
  OptionButton,
  PageHeader,
  PetalFall,
  Progress,
  ResultActions,
  ResultScore,
  ShortcutHelp,
  TitleBlock,
} from "../components/CommonUi";
import { markKeyboardHintSeen, useKeyboardAnswer } from "../hooks/useKeyboardAnswer";
import { AnswerSheet, ExamReview, ListeningExamPlayer } from "../components/ExamParts";

const pad2 = (n) => String(n).padStart(2, "0");

const EXAM_SHORTCUT_ROWS: Array<[string, string]> = [
  ["1 ~ 4", "为当前未作答的小题选择选项"],
  ["Enter / Space", "进入下一组"],
  ["Esc", "暂停 / 退出确认"],
  ["?", "显示快捷键速查"],
];

const PRACTICE_SHORTCUT_ROWS: Array<[string, string]> = [
  ["1 ~ 4", "选择对应选项"],
  ["Enter / Space", "进入下一题"],
  ["Esc", "退出专项练习"],
  ["?", "显示快捷键速查"],
];
const scrollTop = () => requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
const enterFullscreen = () => document.documentElement.requestFullscreen?.();
const TIMER_NOTICES = [[600, "本科剩余 10 分钟"], [300, "本科剩余 5 分钟"], [60, "本科只剩 1 分钟"]] as const;

function PracticeExitModal({ onStay, onLeave }) {
  return (
    <ModalOverlay title="退出本次练习？" onClose={onStay}>
      <p className="modal-footnote">退出后，本次作答和练习进度将不保存，也不会计入练习记录。</p>
      <div className="modal-actions">
        <button className="secondary-button" onClick={onLeave} type="button">退出练习</button>
        <button className="primary-button" onClick={onStay} type="button">继续练习</button>
      </div>
    </ModalOverlay>
  );
}

export function UnifiedPracticeSessionView({ session, onBack, onChoose, onMove, onCheck, onSubmit, submitting = false }) {
  const groups = practiceQuestionGroups(session.questions);
  const currentQuestion = session.questions[session.index] || session.questions[0];
  const groupIndex = Math.max(0, groups.findIndex((group) => group.questions.some((question) => question.id === currentQuestion?.id)));
  const group = groups[groupIndex] || { questions: [] };
  const feedbackMode = session.config.feedbackMode || "immersive";
  const instant = feedbackMode === "instant";
  const groupChecked = group.questions.length > 0 && group.questions.every((question) => session.checked?.[question.id]);
  const answered = session.questions.filter((question) => session.answers[question.id]).length;
  const unanswered = session.questions.length - answered;
  const groupAnswered = group.questions.filter((question) => session.answers[question.id]).length;
  const groupType = Number(group.questions[0]?.question_type || 0);
  const sharedMaterialGroup = groupType === 23 || (groupType >= 31 && groupType <= 36);
  const [showExit, setShowExit] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [showQuestionNav, setShowQuestionNav] = useState(true);
  const isLast = groupIndex === groups.length - 1;
  const firstEditable = group.questions.find((question) => !session.checked?.[question.id]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const moveGroup = (nextIndex) => {
    const target = groups[Math.max(0, Math.min(groups.length - 1, nextIndex))];
    const question = target?.questions[0];
    if (question) { onMove(session.questions.findIndex((item) => item.id === question.id)); scrollTop(); }
  };
  const complete = () => {
    if (unanswered > 0) setShowIncomplete(true);
    else onSubmit();
  };
  const checkGroup = () => {
    const missing = group.questions.filter((question) => !session.answers[question.id]).length;
    if (missing) { setShowIncomplete(true); return; }
    onCheck(group.questions);
  };
  const primary = () => {
    if (instant && !groupChecked) { checkGroup(); return; }
    if (isLast) complete();
    else moveGroup(groupIndex + 1);
  };
  const activeQuestion = firstEditable || group.questions[0];
  useKeyboardAnswer({
    active: !showExit && !showIncomplete && !showShortcuts,
    optionCount: activeQuestion?.options?.length || 0,
    onNumber: (index) => activeQuestion && onChoose(activeQuestion.id, activeQuestion.options[index].id),
    onAdvance: primary,
    onExit: () => setShowExit(true),
    onHelp: () => { markKeyboardHintSeen(); setShowShortcuts(true); },
  });

  return (
    <section className="unified-practice-view">
      <PageHeader onBack={() => setShowExit(true)}>
        <div className="practice-progress-summary">
          <Progress value={pct(answered, session.questions.length)} />
          <span>当前位置 {groupIndex + 1}/{groups.length}</span><span>已答 {answered}</span><span>未答 {unanswered}</span>
        </div>
        <button className="secondary-button practice-nav-toggle" onClick={() => setShowQuestionNav((value) => !value)} type="button" aria-expanded={showQuestionNav} aria-controls="practice-question-navigation">
          {showQuestionNav ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          <span>{showQuestionNav ? "收起题号" : "展开题号"}</span>
        </button>
        <button className="shortcut-toggle" onClick={() => setShowShortcuts(true)} type="button" aria-label="快捷键速查"><Keyboard size={18} /></button>
      </PageHeader>

      <section className={`practice-workspace ${showQuestionNav ? "nav-open" : ""}`.trim()}>
        {showQuestionNav ? (
          <aside className="practice-question-panel" id="practice-question-navigation">
            <div className="practice-question-panel-heading"><ClipboardList size={18} /><strong>题目导航</strong><small>{answered}/{session.questions.length}</small></div>
            <nav className="practice-question-nav" aria-label="题目导航">
              {groups.map((item, index) => {
                const itemAnswered = item.questions.filter((question) => session.answers[question.id]).length;
                const complete = itemAnswered === item.questions.length;
                const stateLabel = complete ? "已作答" : itemAnswered ? "部分作答" : "未作答";
                const itemType = Number(item.questions[0]?.question_type || 0);
                const itemUnit = itemType === 23 || (itemType >= 31 && itemType <= 36) ? "篇" : "题";
                return <button aria-label={`第 ${index + 1} ${itemUnit}，${stateLabel}`} className={`${index === groupIndex ? "active" : ""} ${complete ? "answered" : itemAnswered ? "partial" : ""}`.trim()} onClick={() => moveGroup(index)} type="button" key={item.key}>{index + 1}</button>;
              })}
            </nav>
          </aside>
        ) : null}

        <div className="practice-main-column">
          <article className="practice-group-card">
            <header className="practice-group-heading">
              <strong>{sharedMaterialGroup ? `第 ${groupIndex + 1} 篇 · 本篇已答 ${groupAnswered}/${group.questions.length}` : `第 ${session.index + 1} 题`}</strong>
              <div><span className="book-pill">{session.exam.level} · {examQuestionCategoryLabel(group.questions[0])}</span><small>{group.sourceExamTitle}</small></div>
            </header>
            {hasVisibleHtml(group.passage) ? <section className="exam-passage practice-shared-passage" id="practice-passage"><HtmlContent html={group.passage} /></section> : null}
            {group.questions.map((question, questionIndex) => {
              const chosen = session.answers[question.id] || null;
              const feedback = session.feedback?.[question.id];
              const locked = Boolean(session.checked?.[question.id]);
              return (
                <section className="practice-sub-question" id={`practice-question-${question.id}`} key={question.id}>
                  <div className="random-practice-title">{group.questions.length > 1 ? <span>{questionIndex + 1}.</span> : null}<HtmlContent html={question.title} /></div>
                  {question.image_url ? <img className="exam-image" src={assetSrc(question.image_url)} alt="" /> : null}
                  <section className="options-grid exam-options">
                    {question.options.map((option, optionIndex) => {
                      const state = feedback ? (option.id === feedback.correct_option_id ? "correct" : option.id === chosen ? "wrong" : "") : option.id === chosen ? "selected" : "";
                      return <OptionButton key={option.id} index={optionIndex} option={option} className={state} disabled={locked || submitting} onClick={() => onChoose(question.id, option.id)} />;
                    })}
                  </section>
                  {feedback ? <section className={`practice-inline-feedback ${feedback.is_correct ? "correct" : "wrong"}`}><strong>{feedback.is_correct ? "回答正确" : "回答有误"}</strong><p>正确答案：<HtmlContent inline html={feedback.answer_text} /></p>{feedback.analysis ? <div className="analysis-text"><HtmlContent inline html={feedback.analysis} /></div> : null}</section> : null}
                </section>
              );
            })}
            {sharedMaterialGroup && hasVisibleHtml(group.passage) ? <div className="practice-reading-jumps"><a href="#practice-passage">回到文章</a><a href={`#practice-question-${group.questions[0]?.id}`}>回到作答位置</a></div> : null}
          </article>

          {session.saveError ? <div className="exam-save-state error" role="alert">{session.saveError}。当前页面的作答仍保留，请点击“完成练习”重试。</div> : null}

          <footer className="practice-action-bar">
            <button className="secondary-button" disabled={groupIndex === 0 || submitting} onClick={() => moveGroup(groupIndex - 1)} type="button">上一{sharedMaterialGroup ? "篇" : "题"}</button>
            <button className="primary-button" disabled={(instant && !groupChecked && groupAnswered === 0) || submitting} onClick={primary} type="button">
              {submitting ? "正在保存…" : instant && !groupChecked ? (sharedMaterialGroup ? "检查本篇" : "检查答案") : isLast ? "完成练习" : `下一${sharedMaterialGroup ? "篇" : "题"}`}
            </button>
          </footer>
        </div>
      </section>

      {showExit ? <PracticeExitModal onStay={() => setShowExit(false)} onLeave={onBack} /> : null}
      {showIncomplete ? <ModalOverlay title={instant && !groupChecked ? "本组还有未答题" : `还有 ${unanswered} 题未作答`} onClose={() => setShowIncomplete(false)}><p className="modal-footnote">可以返回补答，也可以将未答题记为跳过并查看结果。</p><div className="modal-actions"><button className="secondary-button" onClick={() => setShowIncomplete(false)} type="button">返回补答</button><button className="primary-button" onClick={() => { setShowIncomplete(false); instant && !groupChecked ? onCheck(group.questions) : onSubmit(); }} type="button">{instant && !groupChecked ? "明确跳过并检查" : "结束并查看结果"}</button></div></ModalOverlay> : null}
      {showShortcuts ? <ModalOverlay title="键盘快捷键" onClose={() => setShowShortcuts(false)}><ShortcutHelp rows={[["1 ~ 4", "选择对应选项"], ["Enter / Space", instant ? "检查答案 / 进入下一题" : "进入下一题"], ["Esc", "退出练习"], ["?", "显示快捷键速查"]]} /><div className="modal-actions"><button className="primary-button" onClick={() => setShowShortcuts(false)} type="button">知道了</button></div></ModalOverlay> : null}
    </section>
  );
}

/** Exam date as a comparable number; titles already carry the date, so it is only used for ordering. */
function examDateTime(exam) {
  const raw = exam.examDate;
  if (raw === null || raw === undefined || raw === "") return NaN;
  const value = Number(raw);
  return Number.isFinite(value) && String(raw).trim() !== "" && /^\d+$/.test(String(raw).trim())
    ? value
    : new Date(raw).getTime();
}

/** Active-run banner card with its own ticking clock, so the list does not re-render every second (B10 #6). */
function ActiveRunCard({ exam, run, onResumeExam, onAbandonExam }) {
  const expiresAt = run.section_expires_at;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const resting = run.status === "awaiting_section" || !expiresAt;
  const remainingSeconds = expiresAt ? secondsUntil(expiresAt, now) : 0;
  const urgent = !resting && remainingSeconds <= 300;
  const clock = resting ? "休息中" : formatClock(Math.max(0, remainingSeconds));
  const sub = resting ? "等待开始下一科" : `本科剩余 ${Math.max(1, Math.ceil(remainingSeconds / 60))} 分钟`;
  const section = run.sections?.[run.current_section];

  return (
    <article className="exam-card active-run">
      <div className={`active-run-clockbox ${urgent ? "urgent" : ""}`.trim()}>
        <strong>{clock}</strong>
        <small><Clock3 size={14} />继续上次考试</small>
      </div>
      <div className="active-run-context">
        <h3>{exam.title}</h3>
        <p>{section?.label ? <>{section.label} · </> : null}{sub}</p>
      </div>
      <div className="active-run-actions">
        <button className="primary-button" onClick={() => onResumeExam(exam, run)} type="button">继续考试</button>
        <button className="active-run-abandon" onClick={() => onAbandonExam(exam, run)} type="button">放弃考试</button>
      </div>
    </article>
  );
}

export function ExamListView({ exams, level, examAttempts, examRuns = [], onBack, onStartExam, onResumeExam, onAbandonExam, onReviewAttempt }) {
  const examStats = latestExamAttemptByExam(examAttempts);
  const activeRuns = new Map<number, any>(examRuns.map((run) => [run.exam_id, run]));
  const byDateDesc = (left, right) => (Number.isFinite(examDateTime(right)) ? examDateTime(right) : 0) - (Number.isFinite(examDateTime(left)) ? examDateTime(left) : 0);
  const activeExams = exams.filter((exam) => activeRuns.has(exam.id));
  const freshExams = exams.filter((exam) => !activeRuns.has(exam.id) && !examStats.get(exam.id)).sort(byDateDesc);
  const doneExams = exams.filter((exam) => !activeRuns.has(exam.id) && examStats.get(exam.id)).sort(byDateDesc);

  const renderCard = (exam) => {
    const activeRun = activeRuns.get(exam.id);
    if (activeRun) {
      return <ActiveRunCard key={exam.id} exam={exam} run={activeRun} onResumeExam={onResumeExam} onAbandonExam={onAbandonExam} />;
    }
    const last = examStats.get(exam.id);
    return (
      <article className={`exam-card ${last ? "done" : ""}`.trim()} key={exam.id}>
        <div>
          <div className="book-badge">{exam.level}</div>
          <h3>{exam.title}</h3>
          {last ? <p>最近成绩 {pct(last.correct, last.total)}% · {last.correct}/{last.total}</p> : null}
        </div>
        <div className="exam-card-actions">
          {last ? <button className="secondary-button review-exam-button" onClick={() => onReviewAttempt(last)} type="button">查看解析</button> : null}
          <button className="start-button" onClick={() => onStartExam(exam)} type="button" aria-label={`开始 ${exam.title}`}><ChevronRight size={24} /></button>
        </div>
      </article>
    );
  };

  return (
    <section className="exam-list-view">
      <PageHeader onBack={onBack}><TitleBlock eyebrow="考试题库" title="模拟考试" /></PageHeader>
      {exams.length ? (
        <>
          {activeExams.length ? <div className="exam-list">{activeExams.map(renderCard)}</div> : null}
          {freshExams.length ? (
            <>
              {doneExams.length ? <div className="exam-group-title">未挑战</div> : null}
              <div className="exam-list">{freshExams.map(renderCard)}</div>
            </>
          ) : null}
          {doneExams.length ? (
            <>
              <div className="exam-group-title">已完成</div>
              <div className="exam-list">{doneExams.map(renderCard)}</div>
            </>
          ) : null}
        </>
      ) : <EmptyState title={`${level} 考试题库`} text="该等级暂时没有考试数据。" />}
    </section>
  );
}

export function ExamIntroView({ exam, onBack, onStart, starting = false }) {
  const sections = examSectionsForLevel(exam.level);
  const totalMinutes = sections.reduce((sum, section) => sum + section.durationMinutes, 0);
  return (
    <section className="exam-intro-view">
      <PageHeader onBack={onBack}>
        <TitleBlock eyebrow="JLPT 标准模拟考试" title={exam.title} subtitle={`${exam.level} · 共 ${exam.questionCount || exam.question_count || 0} 题`} />
      </PageHeader>
      <section className="exam-intro-card">
        <div className="exam-intro-summary"><Clock3 size={30} /><div><span>预计考试用时</span><strong>{totalMinutes} 分钟</strong></div></div>
        <div className="exam-section-schedule">
          {sections.map((section, index) => <div key={section.key}><span>{index + 1}</span><div><strong>{section.label}</strong><small>{section.durationMinutes} 分钟</small></div></div>)}
        </div>
        <ul className="exam-rules">
          <li>每科独立计时，到时自动提交并锁定本科答案。</li>
          <li>进入下一科后不能返回上一科修改答案。</li>
          <li>刷新或暂时离开页面不会暂停倒计时。</li>
          <li>科目之间不计时，确认后才开始下一科。</li>
        </ul>
        <div className="result-actions">
          <button className="primary-button" onClick={onStart} disabled={starting} type="button">{starting ? "正在加载试卷资源…" : "确认并开始第一科"}</button>
          <button className="secondary-button" onClick={enterFullscreen} disabled={starting} type="button">全屏考试</button>
          <button className="secondary-button" onClick={onBack} disabled={starting} type="button">返回试卷列表</button>
        </div>
      </section>
    </section>
  );
}

function playTestTone() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  gain.gain.value = 0.08;
  oscillator.frequency.value = 440;
  oscillator.start();
  oscillator.stop(context.currentTime + 0.7);
  oscillator.onended = () => context.close();
}

export function ExamSectionBreakView({ session, onStartNext, starting = false }) {
  const section = session.run.sections[session.run.current_section];
  return (
    <section className="exam-intro-view">
      <div className="exam-intro-card exam-break-card">
        <div className="book-badge">上一科已提交</div>
        <h1>准备开始：{section.label}</h1>
        <p>本部分考试时间为 {section.duration_minutes} 分钟。点击后立即开始计时，之后不能返回上一科。</p>
        {section.key === "listening" ? (
          <section className="listening-device-check">
            <Headphones size={28} />
            <div><strong>听力设备检查</strong><span>请佩戴耳机并确认能听到测试音。</span></div>
            <button className="secondary-button" onClick={playTestTone} disabled={starting} type="button">播放测试音</button>
          </section>
        ) : null}
        <div className="result-actions">
          <button className="primary-button" onClick={onStartNext} disabled={starting} type="button">{starting ? "正在开始…" : "开始本部分"}</button>
          <button className="secondary-button" onClick={enterFullscreen} disabled={starting} type="button">进入全屏</button>
        </div>
      </div>
    </section>
  );
}

export function RandomPracticeSessionView({ session, onBack, onChoose, onMove, onSubmit }) {
  const question = session.questions[session.index];
  const chosenOptionId = session.answers[question.id] || null;
  const isLast = session.index === session.questions.length - 1;
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleExit = () => {
    if (window.confirm("退出后本次专项练习进度不会保存。确定退出吗？")) onBack();
  };
  useKeyboardAnswer({
    active: !showShortcuts,
    optionCount: question.options.length,
    onNumber: (index) => onChoose(question.id, question.options[index].id),
    onAdvance: isLast ? undefined : () => onMove(session.index + 1),
    onExit: handleExit,
    onHelp: () => { markKeyboardHintSeen(); setShowShortcuts((value) => !value); },
  });

  return (
    <section className="random-practice-view">
      <PageHeader onBack={onBack}>
        <div className="quiz-progress"><Progress value={pct(session.index + 1, session.questions.length)} /><span>{session.index + 1} / {session.questions.length}</span></div>
        <button
          className="shortcut-toggle"
          onClick={() => { markKeyboardHintSeen(); setShowShortcuts(true); }}
          type="button"
          aria-label="快捷键速查"
        >
          <Keyboard size={18} />
        </button>
      </PageHeader>
      <article className="random-practice-question">
        <div className="random-practice-meta"><span className="book-pill">{session.exam.level} · {examQuestionCategoryLabel(question)}</span><small>{question.source_exam_title}</small></div>
        <div className="random-practice-number">第 {question.practice_order || session.index + 1} 题</div>
        {hasVisibleHtml(question.passage) ? <section className="exam-passage"><HtmlContent html={question.passage} /></section> : null}
        <div className="random-practice-title"><HtmlContent html={question.title} /></div>
        {question.image_url ? <img className="exam-image" src={assetSrc(question.image_url)} alt="" /> : null}
        <section className="options-grid exam-options keyboard-active">
          {question.options.map((option, index) => (
            <OptionButton key={option.id} index={index} option={option} className={chosenOptionId === option.id ? "selected" : ""} onClick={() => onChoose(question.id, option.id)}><span /></OptionButton>
          ))}
        </section>
      </article>
      <footer className="exam-nav random-practice-nav">
        <button className="secondary-button" disabled={session.index === 0} onClick={() => onMove(session.index - 1)} type="button">上一题</button>
        {isLast
          ? <button className="primary-button" onClick={onSubmit} type="button">提交</button>
          : <button className="primary-button" onClick={() => onMove(session.index + 1)} type="button">下一题 <kbd className="kbd-hint">↵</kbd></button>}
      </footer>

      <KeyboardToast suppress={showShortcuts} />
      {showShortcuts ? (
        <ModalOverlay title="键盘快捷键" onClose={() => setShowShortcuts(false)}>
          <ShortcutHelp rows={PRACTICE_SHORTCUT_ROWS} />
          <div className="modal-actions">
            <button className="primary-button" onClick={() => setShowShortcuts(false)} type="button">知道了</button>
          </div>
        </ModalOverlay>
      ) : null}
    </section>
  );
}

export function ExamSessionView({ session, onBack, onChoose, onMove, onSubmit, saveState = "idle", onRetrySave = () => {}, submitting = false }) {
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerNotice, setTimerNotice] = useState("");
  const [listeningStarted, setListeningStarted] = useState(false);
  const [audioError, setAudioError] = useState("");
  const expiredRef = useRef(false);
  const previousRemainingRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const submitRef = useRef(onSubmit);
  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);

  const expiresAt = session.run?.section_expires_at;
  useEffect(() => {
    if (!expiresAt) return undefined;
    expiredRef.current = false;
    const update = () => {
      const remaining = secondsUntil(expiresAt);
      setRemainingSeconds(remaining);
      const previous = previousRemainingRef.current;
      for (const [threshold, message] of TIMER_NOTICES) {
        if (previous !== null && previous > threshold && remaining <= threshold) setTimerNotice(message);
      }
      previousRemainingRef.current = remaining;
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        submitRef.current(true);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (!session.run || session.run.status !== "in_progress") return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session.run?.id, session.run?.status]);

  const question = session.questions[session.index];
  const answeredCount = countAnsweredQuestions(session.questions, session.answers);
  const problemSections = buildExamProblemSections(session.exam, session.questions);
  const questionIndexById = new Map(session.questions.map((item, index) => [item.id, index]));
  const currentProblemIndex = Math.max(0, problemSections.findIndex((s) => s.questions.some((item) => item.id === question.id)));
  const currentProblem = problemSections[currentProblemIndex] || problemSections[0];
  const problemPages = problemSections.flatMap((section, problemIndex) =>
    groupQuestionsByPassage(section.questions).map((group, groupIndex) => ({ ...group, section, problemIndex, groupIndex })),
  );
  const currentPageIndex = Math.max(0, problemPages.findIndex((page) => page.questions.some((item) => item.id === question.id)));
  const currentPage: any = problemPages[currentPageIndex] || { passage: "", questions: currentProblem?.questions || [], section: currentProblem };
  const currentProblemPages = problemPages.filter((page) => page.problemIndex === currentProblemIndex);
  const currentProblemPageIndex = Math.max(0, currentProblemPages.indexOf(currentPage));
  const isTimedListening = session.run?.sections?.[session.run.current_section]?.key === "listening";
  const currentAudioUrl = currentPage.questions.find((item) => item.media_url)?.media_url || "";
  const canPrev = currentPageIndex > 0;
  const canNext = currentPageIndex < problemPages.length - 1;

  const jump = (questionIndex) => { onMove(questionIndex); scrollTop(); };
  const jumpToFirstOf = (target) => {
    const first = target?.questions[0];
    if (first) jump(questionIndexById.get(first.id) || 0);
  };
  const moveToPage = (pageIndex) => jumpToFirstOf(problemPages[pageIndex]);

  // B3 keyboard: digits answer the first unanswered sub-question on the page; Enter advances a group.
  const activeQuestion = currentPage.questions.find((item) => !session.answers[item.id]) || null;
  const handleKeyboardExit = () => {
    // Real exam runs confirm inside onBack (leaveActiveExam); standalone practice needs its own guard.
    if (session.run) {
      onBack();
      return;
    }
    if (window.confirm("退出后本次专项练习进度不会保存。确定退出吗？")) onBack();
  };
  useKeyboardAnswer({
    active: !showShortcuts,
    optionCount: activeQuestion ? activeQuestion.options.length : 0,
    onNumber: (index) => {
      if (activeQuestion) onChoose(activeQuestion.id, activeQuestion.options[index].id);
    },
    onAdvance: !isTimedListening && canNext ? () => moveToPage(currentPageIndex + 1) : undefined,
    onExit: handleKeyboardExit,
    onHelp: () => { markKeyboardHintSeen(); setShowShortcuts((value) => !value); },
  });

  useEffect(() => {
    setAudioError("");
    if (!isTimedListening || !listeningStarted || !audioRef.current || !currentAudioUrl) return;
    audioRef.current.play().catch(() => {
      setListeningStarted(false);
      setAudioError("音频无法播放，请检查网络后重试。");
    });
  }, [currentPageIndex, currentAudioUrl, isTimedListening, listeningStarted]);

  const finishListeningAudio = () => (canNext ? moveToPage(currentPageIndex + 1) : onSubmit(true));
  const startListening = () => { setAudioError(""); audioRef.current?.load(); setListeningStarted(true); };
  const failListening = () => { setListeningStarted(false); setAudioError("音频加载失败，请检查网络后重试。"); };

  return (
    <div className="exam-view">
      <PageHeader onBack={onBack}>
        <div className="quiz-progress">
          <Progress value={pct(answeredCount, session.questions.length)} />
          <span>{answeredCount} / {session.questions.length}</span>
        </div>
        <div className="exam-header-actions">
          {session.run ? (
            <>
              <div className={`exam-timer ${remainingSeconds <= 300 ? "urgent" : ""}`}><Clock3 size={18} /><strong>{formatClock(remainingSeconds)}</strong></div>
              <button className={`exam-save-state ${saveState}`} onClick={saveState === "error" ? onRetrySave : undefined} disabled={saveState !== "error"} type="button">
                {saveState === "saving" ? "保存中…" : saveState === "error" ? "保存失败，点击重试" : "已保存"}
              </button>
            </>
          ) : null}
          {!isTimedListening ? (
            <button
              className={`secondary-button answer-sheet-toggle ${showAnswerSheet ? "active" : ""}`}
              onClick={() => setShowAnswerSheet((value) => !value)}
              type="button"
              aria-expanded={showAnswerSheet}
              aria-pressed={showAnswerSheet}
            >
              <ClipboardList size={18} />
              {showAnswerSheet ? "收起答题卡" : "答题卡"}
            </button>
          ) : null}
          <button
            className="shortcut-toggle"
            onClick={() => { markKeyboardHintSeen(); setShowShortcuts(true); }}
            type="button"
            aria-label="快捷键速查"
          >
            <Keyboard size={18} />
          </button>
          <button className="primary-button" onClick={() => onSubmit(false)} disabled={submitting || saveState === "saving"} type="button">
            {submitting ? "正在提交…" : session.run ? "提交本科" : "提交"}
          </button>
        </div>
      </PageHeader>

      <section className={`exam-layout ${showAnswerSheet ? "sheet-open" : ""}`}>
        {timerNotice ? <div className="exam-time-notice" role="status"><Clock3 size={18} />{timerNotice}<button onClick={() => setTimerNotice("")} type="button"><X size={16} /></button></div> : null}
        {showAnswerSheet ? (
          <AnswerSheet
            exam={session.exam}
            problemSections={problemSections}
            currentProblem={currentProblem}
            answers={session.answers}
            questionIndexById={questionIndexById}
            onJump={jump}
            onJumpProblem={(i) => jumpToFirstOf(problemSections[i])}
          />
        ) : null}

        <section className="exam-question-panel">
          <div className="book-badge">{currentProblem?.partLabel}</div>
          <div className="exam-question-head">
            <span>{currentProblem?.problemLabel.replace("問題", "")}</span>
            <p>{currentProblem?.layer.title}</p>
            {currentProblem?.partLabel === "阅读" && currentProblemPages.length > 1 ? <small>第 {currentProblemPageIndex + 1} / {currentProblemPages.length} 页</small> : null}
          </div>

          {currentProblem?.layer?.image_url ? <img className="exam-image exam-shared-image" src={assetSrc(currentProblem.layer.image_url)} alt="" /> : null}

          {isTimedListening ? (
            <ListeningExamPlayer
              audioRef={audioRef}
              audioUrl={currentAudioUrl}
              audioError={audioError}
              started={listeningStarted}
              onStart={startListening}
              onEnded={finishListeningAudio}
              onError={failListening}
            />
          ) : null}

          <section className="exam-problem-page">
            <section className="exam-passage-group" key={`${currentProblem?.id}-${currentPage.groupIndex || 0}`}>
              {hasVisibleHtml(currentPage.passage) ? <section className="exam-passage"><HtmlContent html={currentPage.passage} /></section> : null}
              {currentPage.questions.map((item) => {
                const sectionQuestionIndex = Math.max(0, currentProblem?.questions.findIndex((q) => q.id === item.id) ?? 0);
                const displayNumber = examQuestionDisplayNumber(currentProblem, item, sectionQuestionIndex, questionIndexById);
                const chosenOptionId = session.answers[item.id] || null;
                return (
                  <article className="exam-sub-question" key={item.id}>
                    <div className="exam-sub-question-title"><span>{pad2(displayNumber)}.</span><HtmlContent html={item.title} /></div>
                    {item.media_url && !isTimedListening ? <audio className="exam-audio" controls src={assetSrc(item.media_url)} /> : null}
                    {item.image_url ? <img className="exam-image" src={assetSrc(item.image_url)} alt="" /> : null}
                    <section className={`options-grid exam-options ${item.id === activeQuestion?.id ? "keyboard-active" : ""}`.trim()}>
                      {item.options.map((option, index) => (
                        <OptionButton
                          key={`${item.id}-${option.id}`}
                          index={index}
                          option={option}
                          className={chosenOptionId === option.id ? "selected" : ""}
                          onClick={() => onChoose(item.id, option.id)}
                          disabled={submitting}
                        />
                      ))}
                    </section>
                  </article>
                );
              })}
            </section>
          </section>

          {!isTimedListening ? (
            <footer className="exam-nav">
              <button className="secondary-button" onClick={() => moveToPage(currentPageIndex - 1)} disabled={!canPrev} type="button">上一组</button>
              <button className="primary-button" onClick={() => moveToPage(currentPageIndex + 1)} disabled={!canNext} type="button">下一组 <kbd className="kbd-hint">↵</kbd></button>
            </footer>
          ) : null}
        </section>
      </section>

      <KeyboardToast suppress={showShortcuts} />
      {showShortcuts ? (
        <ModalOverlay title="键盘快捷键" onClose={() => setShowShortcuts(false)}>
          <ShortcutHelp rows={EXAM_SHORTCUT_ROWS} />
          <div className="modal-actions">
            <button className="primary-button" onClick={() => setShowShortcuts(false)} type="button">知道了</button>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function ScoreCell({ label, score, max, correct, total, passMark }: any) {
  return (
    <div>
      <span>{label}</span>
      <strong>{score} / {max}</strong>
      <small>{correct}/{total} · 参考线 {passMark}</small>
    </div>
  );
}

function EstimatedScore({ est }) {
  return (
    <section className={`exam-score-summary ${est.passed ? "passed" : "failed"}`}>
      <div>
        <span>估算分数</span>
        <strong>{est.totalScore} / 180</strong>
        <small>{est.passed ? "预计合格" : "预计不合格"} · 合格线 {est.overallPassMark}</small>
      </div>
      {est.usesThreeSections ? (
        <>
          <ScoreCell label="语言知识" max={60} score={est.languageKnowledgeScore} correct={est.languageKnowledgeCorrect} total={est.languageKnowledgeTotal} passMark={est.languageKnowledgePassMark} />
          <ScoreCell label="阅读" max={60} score={est.readingScore} correct={est.readingCorrect} total={est.readingTotal} passMark={est.readingPassMark} />
        </>
      ) : (
        <ScoreCell label="语言知识与阅读" max={120} score={est.languageReadingScore} correct={est.languageReadingCorrect} total={est.languageReadingTotal} passMark={est.languageReadingPassMark} />
      )}
      <ScoreCell label="听力" max={60} score={est.listeningScore} correct={est.listeningCorrect} total={est.listeningTotal} passMark={est.listeningPassMark} />
    </section>
  );
}

export function ExamResultView({ exam, attempt, questions, onRepeat, onLibrary }) {
  const answerByQuestion = new Map<number, any>(attempt.answers.map((answer) => [answer.questionId, answer]));
  const answerForQuestion = (question) =>
    answerByQuestion.get(question.id) || {
      questionId: question.id,
      title: question.title,
      chosenOptionId: null,
      chosenText: null,
      correctOptionId: null,
      answerText: "",
      analysis: question.analysis || "",
      isCorrect: false,
      unanswered: true,
    };
  // 专项练习有独立结果页（pages/PracticeResult.tsx），这里只服务模拟考试。
  return (
    <section className="result-view exam-result-view">
      <PetalFall variant="full" />
      <ResultScore score={pct(attempt.correct, attempt.total)}>答对 {attempt.correct} / {attempt.total} · {attempt.title}</ResultScore>
      <EstimatedScore est={calculateExamScore(attempt, questions)} />
      <ResultActions onRepeat={onRepeat} repeatLabel="再做一次" onLibrary={onLibrary} libraryLabel="试卷列表" />
      <ExamReview
        reviewProblemGroups={buildReviewProblemGroups(exam, questions)}
        answerByQuestion={answerByQuestion}
        answerForQuestion={answerForQuestion}
      />
    </section>
  );
}
