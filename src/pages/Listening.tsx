import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Eye, EyeOff, CheckCircle2, CircleAlert, RotateCcw, ClipboardList } from "lucide-react";
import { api, assetSrc } from "../lib/study";
import UiSelect from "../components/UiSelect";

function plain(html = "") { return new DOMParser().parseFromString(html, "text/html").body.textContent?.replace(/<MOJiTest_URL>/g, "").trim() || ""; }
function analysisParagraphs(html: string) {
  const body = new DOMParser().parseFromString(html || '', 'text/html').body;
  body.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  body.querySelectorAll('p, div, li').forEach(el => el.append('\n'));
  return (body.textContent || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
}
function time(value: string) {
  const m = value?.match(/^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0") / 1000 : NaN;
}
export function segments(html: string) {
  return Array.from(new DOMParser().parseFromString(html || "", "text/html").querySelectorAll('[data-starttime][data-endtime]')).map(el => ({ start: time(el.getAttribute('data-starttime')), end: time(el.getAttribute('data-endtime')), text: el.textContent?.trim() || "" })).filter(s => Number.isFinite(s.start) && s.end > s.start);
}
function read(key) { try { const v = JSON.parse(localStorage.getItem(key) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } }
const LISTENING_TYPES = [
  { id: 41, label: '课题理解', description: '听懂任务并选择接下来应做的事情' },
  { id: 42, label: '要点理解', description: '抓住问题要求的关键信息' },
  { id: 43, label: '概要理解', description: '理解对话或讲话的整体主旨' },
  { id: 44, label: '表达选择', description: '根据场景选择合适的表达' },
  { id: 45, label: '即时应答', description: '选择最自然的即时回应' },
  { id: 46, label: '综合理解', description: '综合多段信息进行判断' },
];

export default function Listening({ userId, token, globalLevel }) {
  const { examId, questionId } = useParams();
  const navigate = useNavigate();
  const key = `listening:${userId}`;
  const [progress, setProgress] = useState(() => read(key));
  const level = globalLevel;
  const [year, setYear] = useState(() => read(key).year || '');
  const [exams, setExams] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [practiceMode, setPracticeMode] = useState('random');
  const [practiceExamId, setPracticeExamId] = useState('');
  const [practiceTypes, setPracticeTypes] = useState(LISTENING_TYPES.map(item => item.id));
  const [practiceCount, setPracticeCount] = useState(10);
  const [practiceSession, setPracticeSession] = useState<any>(null);
  const [starting, setStarting] = useState(false);
  useEffect(() => { setYear(''); }, [globalLevel]);
  function save(patch) { setProgress(p => { const next = { ...p, ...patch }; try { localStorage.setItem(key, JSON.stringify(next)); } catch { setError('无法保存进度，请检查浏览器存储空间。'); } return next; }); }
  useEffect(() => {
    let live = true; setLoading(true); setError(''); setDetail(null); setQuestions([]);
    const load = examId ? Promise.all([api(`/api/exams/${examId}`), api(`/api/exams/${examId}/questions`)]) : api(`/api/exams?level=${level}`);
    load.then(data => { if (!live) return; if (examId) { setDetail(data[0]); setQuestions(data[1].filter(q => q.question_type >= 41 && q.question_type <= 46)); } else setExams(data.filter(e => e.listening_num > 0)); }).catch(e => { if (live) setError(`加载失败：${e.message}`); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [examId, level, retry]);
  useEffect(() => { if (exams.length && !exams.some(exam => String(exam.id) === practiceExamId)) setPracticeExamId(String(exams[0].id)); }, [exams, practiceExamId]);
  const years = [...new Set(exams.map(e => e.title.match(/\d{4}/)?.[0] || '其他'))].sort().reverse();
  const selectedYear = years.includes(year) ? year : years[0];
  const q = questions.find(q => q.id === Number(questionId));
  const groups = (detail?.layers || []).map(l => ({ ...l, questions: questions.filter(q => q.layer_id === l.id) })).filter(l => l.questions.length);
  const openQuestion = (q) => { save({ last: { examId: detail.id, questionId: q.id, title: `${detail.level} · ${detail.title}` }, [q.id]: { ...progress[q.id], examId: detail.id, started: true } }); navigate(`/listening/${detail.id}/${q.id}`); };
  function togglePracticeType(type) { setPracticeTypes(current => current.includes(type) ? current.filter(item => item !== type) : [...current, type]); }
  async function startListeningPractice(event) {
    event.preventDefault();
    if (!practiceTypes.length || (practiceMode === 'exam' && !practiceExamId)) return;
    setStarting(true); setError('');
    try {
      const sources = practiceMode === 'exam' ? exams.filter(exam => exam.id === Number(practiceExamId)) : exams;
      const loaded = await Promise.all(sources.map(async exam => {
        const [examDetail, examQuestions] = await Promise.all([api(`/api/exams/${exam.id}`), api(`/api/exams/${exam.id}/questions`)]);
        return examQuestions.filter(question => practiceTypes.includes(question.question_type)).map(question => ({ ...question, sourceExamId: exam.id, sourceExamTitle: exam.title, sourceLevel: exam.level, sourceDetail: examDetail }));
      }));
      const pool = loaded.flat();
      if (!pool.length) throw new Error('所选条件下没有可用的听力题目');
      const selected = practiceMode === 'random' ? [...pool].sort(() => Math.random() - .5).slice(0, Math.min(practiceCount, pool.length)) : pool;
      setPracticeSession({ questions: selected, index: 0, finished: false });
    } catch (e) { setError(`组题失败：${e.message}`); }
    finally { setStarting(false); }
  }
  const practiceQuestion = practiceSession?.questions?.[practiceSession.index];
  return <div className={examId || practiceSession ? "listening" : "grammar-practice-setup listening-setup"}>
    <header className="quiz-header">{practiceSession ? <button className="icon-button" aria-label="返回设置" onClick={() => setPracticeSession(null)} type="button"><ArrowLeft size={22} /></button> : <Link className="icon-button" aria-label="返回" to={questionId ? `/listening/${examId}` : examId ? "/listening" : "/"}><ArrowLeft size={22} /></Link>}<div className={!examId && !practiceSession ? "grammar-practice-title" : ""}><div className="eyebrow">听力练习</div><h1>听力专项</h1><p>{practiceQuestion ? `${practiceQuestion.sourceLevel} · ${practiceQuestion.sourceExamTitle} · ${practiceSession.index + 1}/${practiceSession.questions.length}` : detail ? `${detail.level} · ${detail.title}` : '按来源、题型和题量组合听力练习'}</p></div></header>
    {examId ? <p className="listening-note">训练进度保存在当前浏览器，按登录账号分别记录。</p> : null}
    {error && <div role="alert" className="listening-card">{error}<button className="secondary-button" onClick={() => setRetry(r => r + 1)}>重试</button></div>}
    {practiceSession?.finished ? <section className="listening-practice-result"><CheckCircle2 size={58} /><h2>听力专项完成</h2><strong>{practiceSession.questions.length} 题</strong><p>本次选择的听力题目已全部练习完成。</p><div><button className="primary-button" onClick={() => setPracticeSession(null)} type="button"><RotateCcw size={19} />重新设置</button><button className="secondary-button" onClick={() => navigate('/')} type="button">返回首页</button></div></section> : practiceQuestion ? <Trainer key={`practice:${practiceQuestion.id}`} question={practiceQuestion} examId={practiceQuestion.sourceExamId} token={token} saved={progress[practiceQuestion.id] || {}} onSave={patch => save({ last: { examId: practiceQuestion.sourceExamId, questionId: practiceQuestion.id, title: `${practiceQuestion.sourceLevel} · ${practiceQuestion.sourceExamTitle}` }, [practiceQuestion.id]: { ...progress[practiceQuestion.id], examId: practiceQuestion.sourceExamId, started: true, ...patch } })} onNext={() => setPracticeSession(current => current.index >= current.questions.length - 1 ? { ...current, finished: true } : { ...current, index: current.index + 1 })} /> : loading ? <p role="status">正在加载听力题目…</p> : !examId ? <form className="listening-setup-form" onSubmit={startListeningPractice}>
      <section className="practice-config-section">
        <div className="practice-config-heading"><span>1</span><div><h2>选择题目来源</h2><p>当前等级 · {level}，等级统一在首页切换</p></div></div>
        <div className="practice-source-grid">
          <label className={practiceMode === 'random' ? 'selected' : ''}><input type="radio" name="listening-source" checked={practiceMode === 'random'} onChange={() => setPracticeMode('random')} /><Play size={23} /><span><strong>全部试卷随机</strong><small>从 {level} 历年试卷中随机抽取</small></span></label>
          <label className={practiceMode === 'exam' ? 'selected' : ''}><input type="radio" name="listening-source" checked={practiceMode === 'exam'} onChange={() => setPracticeMode('exam')} /><ClipboardList size={23} /><span><strong>指定试卷</strong><small>练习一张试卷中的所选听力题型</small></span></label>
        </div>
        {practiceMode === 'exam' ? <UiSelect className="practice-exam-select" ariaLabel="选择听力试卷" value={practiceExamId} onChange={setPracticeExamId} options={exams.map(exam => ({ value: String(exam.id), label: exam.title }))} /> : null}
      </section>
      <section className="practice-config-section">
        <div className="practice-config-heading"><span>2</span><div><h2>选择听力题型</h2><p>可同时选择多种题型</p></div></div>
        <div className="practice-type-grid">{LISTENING_TYPES.map(item => <label className={practiceTypes.includes(item.id) ? 'selected' : ''} key={item.id}><input type="checkbox" checked={practiceTypes.includes(item.id)} onChange={() => togglePracticeType(item.id)} /><CheckCircle2 size={20} /><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div>
      </section>
      {practiceMode === 'random' ? <section className="practice-config-section"><div className="practice-config-heading"><span>3</span><div><h2>设置题目数量</h2><p>实际题量不会超过可用题目数量</p></div></div><div className="practice-count-options">{[5, 10, 20, 30].map(value => <button className={practiceCount === value ? 'selected' : ''} onClick={() => setPracticeCount(value)} type="button" key={value}>{value}题</button>)}<label><input type="number" min="1" max="100" value={practiceCount} onChange={event => setPracticeCount(Number(event.target.value))} /><span>题</span></label></div></section> : null}
      <div className="practice-start-bar"><div><strong>{practiceTypes.length} 种题型 · {practiceMode === 'random' ? `${practiceCount} 题` : '全部匹配题目'}</strong><span>{practiceMode === 'random' ? `${level} 全部试卷随机` : exams.find(exam => String(exam.id) === practiceExamId)?.title}</span></div><button className="primary-button" disabled={!practiceTypes.length || !exams.length || starting} type="submit">{starting ? '正在组题…' : '开始听力专项'}{!starting ? <Play size={19} /> : null}</button></div>
    </form> : questionId ? q ? <Trainer key={`${userId}:${q.id}`} question={q} examId={detail.id} token={token} saved={progress[q.id] || {}} onSave={patch => save({ [q.id]: { ...progress[q.id], examId: detail.id, ...patch } })} onNext={() => { const next = questions[questions.indexOf(q) + 1]; next ? openQuestion(next) : navigate(`/listening/${examId}`); }} /> : <p>没有找到这道听力题，请返回列表选择。</p> : <>
      <div className="listening-tools"><strong>已完成 {questions.filter(q => progress[q.id]?.done).length} / {questions.length} 题</strong></div>
      {groups.map(g => <section className="listening-card" key={g.id}><h2>{plain(g.title).match(/問題\s*\d+/)?.[0] || '聴解'} · {({41: '課題理解 · 任务理解', 42: 'ポイント理解 · 要点理解', 43: '概要理解 · 概要理解', 44: detail.level === 'N2' ? '即時応答 · 即时应答' : '発話表現 · 表达选择', 45: '即時応答 · 即时应答', 46: '統合理解 · 综合理解'})[g.question_type]}</h2><p>{plain(g.title)}</p><div className="listening-grid">{g.questions.map((q, i) => ({ q, i })).map(({ q, i }) => <button className="secondary-button listening-question" key={q.id} onClick={() => openQuestion(q)}><strong>第 {i + 1} 题</strong><span>{segments(q.subtitle).length} 个精听片段</span><span>{progress[q.id]?.done ? '已完成' : progress[q.id]?.started ? '练习中' : '未练'}</span></button>)}</div></section>)}
    </>}
  </div>;
}

function Trainer({ question: q, examId, token, saved, onSave, onNext }) {
  const audio = useRef<HTMLAudioElement>(null);

  const rows = useMemo(() => segments(q.subtitle), [q.subtitle]);
  const translations = useMemo(() => Array.from(new DOMParser().parseFromString(q.translation || '', 'text/html').querySelectorAll('p')).map(p => p.textContent), [q.translation]);
  const [mode, setMode] = useState('整题练习');
  const [showFullTranscript, setShowFullTranscript] = useState(true);
  const [index, setIndex] = useState(() => Math.max(0, Math.min(rows.length - 1, saved.segment || 0))); 
  const [revealed, setRevealed] = useState<number[]>([]);
  const [translated, setTranslated] = useState(false);
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  async function togglePlayback() {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) { a.pause(); return; }
    setError('');
    if (mode === '逐段精听' && rows[index]) {
      range.current = rows[index];
      if (a.currentTime < rows[index].start || a.currentTime >= rows[index].end) a.currentTime = rows[index].start;
    }
    try { await a.play(); } catch { setError('音频未能播放，请重试或检查网络。'); }
  }
  function seek(value: number) {
    const a = audio.current;
    if (!a || !Number.isFinite(value)) return;
    range.current = null;
    a.currentTime = value;
    setPosition(value);
  }

  const [choice, setChoice] = useState(saved.choice || null);
  const [result, setResult] = useState<any>(saved.result || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const range = useRef<any>(null);
  useEffect(() => { setRevealed([]); setTranslated(false); }, [index]);
  useEffect(() => { return () => { range.current = null; }; }, []);
  const transcriptList = useRef<HTMLDivElement>(null);
  const activeTranscript = rows.findIndex(row => position >= row.start && position < row.end);
  useEffect(() => {
    if (mode !== '整题练习' || !showFullTranscript || !playing || activeTranscript < 0) return;
    const list = transcriptList.current;
    const row = list?.children[activeTranscript] as HTMLElement;
    if (!list || !row) return;
    const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (offset < 0 || offset + row.offsetHeight > list.clientHeight) {
      list.scrollTo({ top: list.scrollTop + offset - list.clientHeight / 3, behavior: 'smooth' });
    }
  }, [activeTranscript, playing, mode, showFullTranscript]);
  function selectSegment(i: number) {
    const a = audio.current;
    if (!a || !rows[i]) return;
    a.pause();
    range.current = rows[i];
    a.currentTime = rows[i].start;
    setPosition(rows[i].start);
    setIndex(i);
    onSave({ segment: i });
  }
  async function play(i: number) {
    const a = audio.current; if (!a || !rows[i]) return;
    setError(''); setIndex(i); onSave({ segment: i }); range.current = rows[i]; a.currentTime = rows[i].start;
    try { await a.play(); } catch { setError('音频未能播放，请重试或检查网络。'); }
  }
  function tick() {
    const a = audio.current; if (!a || a.paused) return;
    const r = range.current;
    if (r && a.currentTime >= r.end) {
      a.pause(); a.currentTime = r.end;
    } else if (!r && mode !== '逐段精听') {
      const i = rows.findIndex(s => a.currentTime >= s.start && a.currentTime < s.end);
      if (i >= 0) setIndex(i);
    }
  }
  useEffect(() => { const id = window.setInterval(tick, 40); return () => clearInterval(id); }, [index, rows, mode]);
  useEffect(() => {
    if (mode !== '逐段精听') return;
    function keydown(e: KeyboardEvent) {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, select, textarea, button, a, [contenteditable="true"]')) return;
      if (!rows.length) return;
      if (e.code === 'Space') { e.preventDefault(); void togglePlayback(); }
      else if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); selectSegment(index - 1); }
      else if (e.key === 'ArrowRight' && index < rows.length - 1) { e.preventDefault(); selectSegment(index + 1); }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); void play(index); }
      else if (e.key === 'Enter') { e.preventDefault(); setRevealed(v => v.includes(index) ? [] : [index]); }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [mode, index, rows, playing]);
  function changeMode(m) { audio.current?.pause(); range.current = null; if (audio.current) audio.current.currentTime = 0; setPosition(0); setMode(m); setRevealed([]); setTranslated(false); }
  async function check() { setBusy(true); setError(''); try { const r = await api('/api/listening/check', { method: 'POST', body: JSON.stringify({ exam_id: examId, answers: [{ question_id: q.id, chosen_option_id: choice }] }) }, token); setResult(r); onSave({ choice, result: r }); } catch { setError('答案检查失败，请重试。'); } finally { setBusy(false); } }
  return <section className="trainer listening-workspace">
    <aside className="listening-card listening-sidebar">
    <div className="listening-panel-heading"><div className="eyebrow">聴解</div><h2>训练控制</h2></div>
    <nav className="subject-tabs listening-mode-tabs" aria-label="训练模式">{['整题练习', '逐段精听'].map(m => <button className={mode === m ? 'active' : ''} key={m} onClick={() => changeMode(m)}>{m}</button>)}</nav>
    <div className={`listening-player ${mode === '逐段精听' ? 'focus-player-settings' : ''}`}>
      <audio ref={audio} src={assetSrc(q.media_url)} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setPosition(audio.current?.currentTime || 0)}
        onDurationChange={() => { const d = audio.current?.duration; setDuration(Number.isFinite(d) ? d : 0); }}
        onLoadedMetadata={() => { if (audio.current) audio.current.playbackRate = rate; }}
        onError={() => { setPlaying(false); setError('音频加载失败，请检查网络或联系管理员检查文件。'); }} />
      <button className="primary-button listening-play" aria-label={playing ? '暂停音频' : '播放音频'} onClick={togglePlayback} disabled={!q.media_url}>
        {playing ? <Pause size={22} /> : <Play size={22} />}<span>{playing ? '暂停' : '播放'}</span>
      </button>
      <div className="listening-progress">
        <div className="listening-progress-label"><strong>{mode === '逐段精听' ? `第 ${index + 1} 段` : '听力音频'}</strong><span>{playing ? '正在播放' : '点击播放，专注聆听'}</span></div>
        <input type="range" aria-label="音频播放进度" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration || 1)} disabled={!duration} onChange={e => seek(+e.target.value)} style={{ '--played': `${duration ? position / duration * 100 : 0}%` } as React.CSSProperties} />
      </div>
      <div className="listening-player-settings">
        <UiSelect className="listening-rate-select" label="语速" compact value={String(rate)} onChange={value => { const nextRate = Number(value); setRate(nextRate); if (audio.current) audio.current.playbackRate = nextRate; }} options={[.6,.8,1,1.2,1.5].map(value => ({ value: String(value), label: `${value}×` }))} />
        <button className="secondary-button listening-mute" aria-label={muted ? '取消静音' : '静音'} aria-pressed={muted} onClick={() => { if (audio.current) audio.current.muted = !muted; setMuted(!muted); }}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
      </div>
    </div>
    {error && <p role="alert">{error}</p>}

    <footer className="listening-tools"><button className="primary-button" onClick={() => { onSave({ done: true }); onNext(); }}>完成本题，继续下一题</button><span>{saved.done ? '本题已完成' : '听懂后再标记完成'}</span></footer>
    </aside>
    <div className="listening-card listening-content">
      <div className="listening-content-heading"><h2>{mode === '逐段精听' ? '逐段精听' : '听力题目'}</h2><span>{mode === '逐段精听' ? `${rows.length} 个片段 · 按需展开原文` : '听完音频后选择答案'}</span></div>
    {mode === '逐段精听' ? <>

      {!rows.length && <p>本题没有可用的分段时间轴，可使用整题播放。</p>}
      {rows[index] && <div className="focus-layout">
        <div className="focus-stage" tabIndex={0} aria-label="精听操作区，可使用键盘快捷键">
          <span className="eyebrow">第 {index + 1} / {rows.length} 段</span>
          <button className="primary-button focus-play" onClick={togglePlayback} aria-label={playing ? '暂停当前句' : '播放当前句'}>{playing ? <Pause size={30} /> : <Play size={30} />}{playing ? '暂停' : '播放当前句'}</button>
          <div className="focus-transcript">
            {revealed.includes(index) ? <p lang="ja">{rows[index].text}</p> : <p className="focus-placeholder">先听一遍，听不清时再展开原文。</p>}
            <button className="secondary-button" aria-expanded={revealed.includes(index)} onClick={() => setRevealed(v => v.includes(index) ? [] : [index])}>{revealed.includes(index) ? <EyeOff size={18} /> : <Eye size={18} />}{revealed.includes(index) ? '隐藏原文' : '显示原文'}</button>
            {revealed.includes(index) && <button className="secondary-button" aria-expanded={translated} onClick={() => setTranslated(v => !v)}>{translated ? '隐藏译文' : '显示译文'}</button>}
            {translated && revealed.includes(index) && <p className="translation">{translations.length === rows.length ? translations[index] : '本题译文未逐句对应。'} </p>}
            {translated && revealed.includes(index) && translations.length !== rows.length && <details><summary>查看整题译文</summary><p>{plain(q.translation)}</p></details>}
          </div>
          <div className="focus-navigation"><button className="secondary-button" disabled={index === 0} onClick={() => selectSegment(index - 1)}>← 上一句</button><button className="secondary-button" onClick={() => play(index)}><RotateCcw size={18} />重听</button><button className="secondary-button" disabled={index === rows.length - 1} onClick={() => selectSegment(index + 1)}>下一句 →</button></div>
          <p className="focus-shortcuts">聚焦此区域后：空格 播放/暂停 · ← → 切句 · R 重听 · Enter 原文</p>
        </div>
      </div>}
    </> : <>
      <p>原文随播放高亮，可以边听边看，再选择答案。</p>
      <section className="listening-full-transcript" aria-label="听力原文">
        <div className="listening-transcript-heading"><h3>听力原文</h3><button className="secondary-button" aria-expanded={showFullTranscript} aria-controls={`full-transcript-${q.id}`} onClick={() => setShowFullTranscript(visible => !visible)}>{showFullTranscript ? <EyeOff size={18} /> : <Eye size={18} />}{showFullTranscript ? '隐藏原文' : '显示原文'}</button></div>
        <div id={`full-transcript-${q.id}`} hidden={!showFullTranscript}>
        {rows.length ? <div ref={transcriptList} className="listening-transcript-scroll">{rows.map((row, i) => <p key={i} lang="ja" aria-current={playing && activeTranscript === i ? 'true' : undefined} className={playing && activeTranscript === i ? 'is-playing' : ''}>{row.text}</p>)}</div> : <p lang="ja">{plain(q.subtitle) || '本题暂无原文。'}</p>}
        </div>
      </section>{q.image_url && <img className="listening-image" src={assetSrc(q.image_url)} alt="听力题目配图" />}
      <div className="listening-grid">{q.options.map((o, i) => <button key={o.id} disabled={!!result} className={`secondary-button listening-question ${choice === o.id ? 'selected' : ''}`} onClick={() => { setChoice(o.id); onSave({ choice: o.id }); }}>{i + 1}. {plain(o.text)}</button>)}</div><button className="primary-button" disabled={!choice || busy || !!result} onClick={check}>{busy ? '检查中…' : '检查答案'}</button>
      {result && <section className={`listening-feedback ${result.is_correct ? 'is-correct' : 'is-incorrect'}`} aria-label="答题结果">
        <div className="listening-feedback-heading" role="status">
          {result.is_correct ? <CheckCircle2 size={24} /> : <CircleAlert size={24} />}
          <div><h3>{result.is_correct ? '回答正确' : '这次没有选对'}</h3><p>{result.is_correct ? '继续精听，确认每一段都听懂了。' : '看看答案和解析，再回到音频中听一遍。'}</p></div>
        </div>
        <div className="listening-answer-summary">
          {!result.is_correct && <div><span>你的答案</span><p lang="ja">{plain(result.chosen_text) || plain(q.options.find(o => o.id === choice)?.text)}</p></div>}
          <div className="listening-correct-answer"><span>正确答案</span><p lang="ja">{plain(result.answer_text)}</p></div>
        </div>
        {plain(result.analysis) && <div className="listening-explanation"><h4>答案解析</h4>{analysisParagraphs(result.analysis).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>}
        <div className="listening-feedback-actions"><button className="secondary-button" onClick={() => { setResult(null); setChoice(null); onSave({ result: null, choice: null }); }}><RotateCcw size={17} />重新作答</button><button className="secondary-button" onClick={() => changeMode('逐段精听')}><Play size={17} />进入逐段精听</button></div>
      </section>}
    </>}
    </div>
  </section>;
}
