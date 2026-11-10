import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Eye, EyeOff, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { api, assetSrc } from "../lib/study";
import { analysisParagraphs, plain, segments, translationLines } from "../lib/listening";
import UiSelect from "./UiSelect";

const MODE_FULL = "整题练习";
const MODE_FOCUS = "逐段精听";
const RATES = [0.6, 0.8, 1, 1.2, 1.5];
const PLAY_ERROR = "音频未能播放，请重试或检查网络。";
const audioTime = (value: number) => `${Math.floor((Number.isFinite(value) ? value : 0) / 60)}:${Math.floor((Number.isFinite(value) ? value : 0) % 60).toString().padStart(2, "0")}`;

function EyeToggle({ visible, ...rest }: any) {
  return (
    <button className="secondary-button" aria-expanded={visible} {...rest}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      {visible ? "隐藏原文" : "显示原文"}
    </button>
  );
}

function PlayerControls({ audioRef, src, mode, index, playing, position, duration, rate, muted, disabled, handlers }: any) {
  const { onToggle, onSeek, onRate, onMute, onPlaying, onTime, onDuration, onMeta, onAudioError } = handlers;
  return (
    <div className={`listening-player ${mode === MODE_FOCUS ? "focus-player-settings" : ""}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => onPlaying(true)}
        onPause={() => onPlaying(false)}
        onEnded={() => onPlaying(false)}
        onTimeUpdate={onTime}
        onDurationChange={onDuration}
        onLoadedMetadata={onMeta}
        onError={onAudioError}
      />
      <button className="primary-button listening-play" aria-label={playing ? "暂停音频" : "播放音频"} onClick={onToggle} disabled={disabled}>
        {playing ? <Pause size={22} /> : <Play size={22} />}<span>{playing ? "暂停" : "播放"}</span>
      </button>
      <div className="listening-progress">
        <div className="listening-progress-label">
          {mode === MODE_FOCUS ? <strong>{`第 ${index + 1} 段`}</strong> : null}
          <span>{audioTime(position)} / {audioTime(duration)}</span>
        </div>
        <input
          type="range"
          aria-label="音频播放进度"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(position, duration || 1)}
          disabled={!duration}
          onChange={(e) => onSeek(+e.target.value)}
          style={{ "--played": `${duration ? (position / duration) * 100 : 0}%` } as React.CSSProperties}
        />
      </div>
      <div className="listening-player-settings">
        <UiSelect className="listening-rate-select" label="语速" compact value={String(rate)} onChange={(v) => onRate(Number(v))} options={RATES.map((value) => ({ value: String(value), label: `${value}×` }))} />
        <button className="secondary-button listening-mute" aria-label={muted ? "取消静音" : "静音"} aria-pressed={muted} onClick={onMute}>
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>
    </div>
  );
}

function FocusStage({ rows, index, playing, revealed, translated, translations, fullTranslation, onToggle, onPlayAgain, onSelect, onReveal, onTranslate }: any) {
  const shown = revealed.includes(index);
  const aligned = translations.length === rows.length;
  return (
    <div className="focus-layout">
      <div className="focus-stage" tabIndex={0} aria-label="精听操作区，可使用键盘快捷键">
        <span className="eyebrow">第 {index + 1} / {rows.length} 段</span>
        <button className="primary-button focus-play" onClick={onToggle} aria-label={playing ? "暂停当前句" : "播放当前句"}>
          {playing ? <Pause size={30} /> : <Play size={30} />}{playing ? "暂停" : "播放当前句"}
        </button>
        <div className="focus-transcript">
          {shown ? <p lang="ja">{rows[index].text}</p> : null}
          <EyeToggle visible={shown} onClick={onReveal} />
          {shown && <button className="secondary-button" aria-expanded={translated} onClick={onTranslate}>{translated ? "隐藏译文" : "显示译文"}</button>}
          {translated && shown && <p className="translation">{aligned ? translations[index] : "本题译文未逐句对应。"} </p>}
          {translated && shown && !aligned && <details><summary>查看整题译文</summary><p>{fullTranslation}</p></details>}
        </div>
        <div className="focus-navigation">
          <button className="secondary-button" disabled={index === 0} onClick={() => onSelect(index - 1)}>← 上一句</button>
          <button className="secondary-button" onClick={onPlayAgain}><RotateCcw size={18} />重听</button>
          <button className="secondary-button" disabled={index === rows.length - 1} onClick={() => onSelect(index + 1)}>下一句 →</button>
        </div>
        <p className="focus-shortcuts">聚焦此区域后：空格 播放/暂停 · ← → 切句 · R 重听 · Enter 原文</p>
      </div>
    </div>
  );
}

function FullTranscript({ question, rows, listRef, visible, onToggle, playing, active }: any) {
  const id = `full-transcript-${question.id}`;
  return (
    <section className="listening-full-transcript" aria-label="听力原文">
      <div className="listening-transcript-heading">
        <h3>听力原文</h3>
        <EyeToggle visible={visible} aria-controls={id} onClick={onToggle} />
      </div>
      <div id={id} hidden={!visible}>
        {rows.length
          ? <div ref={listRef} className="listening-transcript-scroll">{rows.map((row, i) => <p key={i} lang="ja" aria-current={playing && active === i ? "true" : undefined} className={playing && active === i ? "is-playing" : ""}>{row.text}</p>)}</div>
          : <p lang="ja">{plain(question.subtitle) || "本题暂无原文。"}</p>}
      </div>
    </section>
  );
}

function AnswerFeedback({ result, question, choice, onFocusMode }: any) {
  const ok = result.is_correct;
  return (
    <section className={`listening-feedback ${ok ? "is-correct" : "is-incorrect"}`} aria-label="答题结果">
      <div className="listening-feedback-heading" role="status">
        {ok ? <CheckCircle2 size={24} /> : <CircleAlert size={24} />}
        <div>
          <h3>{ok ? "回答正确" : "这次没有选对"}</h3>
        </div>
      </div>
      <div className="listening-answer-summary">
        {!ok && <div><span>你的答案</span><p lang="ja">{plain(result.chosen_text) || plain(question.options.find((o) => o.id === choice)?.text)}</p></div>}
        <div className="listening-correct-answer"><span>正确答案</span><p lang="ja">{plain(result.answer_text)}</p></div>
      </div>
      {plain(result.analysis) && <div className="listening-explanation"><h4>答案解析</h4>{analysisParagraphs(result.analysis).map((p, i) => <p key={i}>{p}</p>)}</div>}
      <div className="listening-feedback-actions">
        <button className="secondary-button" onClick={onFocusMode}><Play size={17} />进入逐段精听</button>
      </div>
    </section>
  );
}

export default function ListeningTrainer({ question: q, examId, token, saved, feedbackMode = "instant", onSave, onNext }) {
  const audio = useRef<HTMLAudioElement>(null);
  const range = useRef<any>(null);
  const transcriptList = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => segments(q.subtitle), [q.subtitle]);
  const translations = useMemo(() => translationLines(q.translation), [q.translation]);
  const [mode, setMode] = useState(MODE_FULL);
  const [showFullTranscript, setShowFullTranscript] = useState(Boolean(saved.result));
  const [index, setIndex] = useState(() => Math.max(0, Math.min(rows.length - 1, saved.segment || 0)));
  const [revealed, setRevealed] = useState<number[]>([]);
  const [translated, setTranslated] = useState(false);
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [choice, setChoice] = useState(saved.choice || null);
  const [result, setResult] = useState<any>(saved.result || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeTranscript = rows.findIndex((row) => position >= row.start && position < row.end);
  const toggleReveal = () => setRevealed((v) => (v.includes(index) ? [] : [index]));

  async function playAudio() {
    try { await audio.current.play(); } catch { setError(PLAY_ERROR); }
  }

  async function togglePlayback() {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) { a.pause(); return; }
    setError("");
    if (mode === MODE_FOCUS && rows[index]) {
      range.current = rows[index];
      if (a.currentTime < rows[index].start || a.currentTime >= rows[index].end) a.currentTime = rows[index].start;
    }
    await playAudio();
  }

  function seek(value: number) {
    const a = audio.current;
    if (!a || !Number.isFinite(value)) return;
    range.current = null;
    a.currentTime = value;
    setPosition(value);
  }

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
    const a = audio.current;
    if (!a || !rows[i]) return;
    setError("");
    setIndex(i);
    onSave({ segment: i });
    range.current = rows[i];
    a.currentTime = rows[i].start;
    await playAudio();
  }

  function tick() {
    const a = audio.current;
    if (!a || a.paused) return;
    const r = range.current;
    if (r && a.currentTime >= r.end) {
      a.pause();
      a.currentTime = r.end;
    } else if (!r && mode !== MODE_FOCUS) {
      const i = rows.findIndex((s) => a.currentTime >= s.start && a.currentTime < s.end);
      if (i >= 0) setIndex(i);
    }
  }

  function changeMode(next) {
    audio.current?.pause();
    range.current = null;
    if (audio.current) audio.current.currentTime = 0;
    setPosition(0);
    setMode(next);
    setRevealed([]);
    setTranslated(false);
  }

  async function check() {
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/listening/check", { method: "POST", body: JSON.stringify({ exam_id: examId, answers: [{ question_id: q.id, chosen_option_id: choice }] }) }, token);
      setResult(r);
      onSave({ choice, result: r });
    } catch {
      setError("答案检查失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  const continuePractice = () => { onSave({ choice, done: true }); onNext(choice); };

  const setRatePlayback = (next: number) => { setRate(next); if (audio.current) audio.current.playbackRate = next; };
  const toggleMute = () => { if (audio.current) audio.current.muted = !muted; setMuted(!muted); };
  const retry = () => { setResult(null); setChoice(null); onSave({ result: null, choice: null }); };
  const pickOption = (id) => { setChoice(id); onSave({ choice: id }); };

  useEffect(() => { setRevealed([]); setTranslated(false); }, [index]);
  useEffect(() => () => { range.current = null; }, []);
  useEffect(() => {
    const id = window.setInterval(tick, 40);
    return () => clearInterval(id);
  }, [index, rows, mode]);

  useEffect(() => {
    if (mode !== MODE_FULL || !showFullTranscript || !playing || activeTranscript < 0) return;
    const list = transcriptList.current;
    const row = list?.children[activeTranscript] as HTMLElement;
    if (!list || !row) return;
    const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (offset < 0 || offset + row.offsetHeight > list.clientHeight) {
      list.scrollTo({ top: list.scrollTop + offset - list.clientHeight / 3, behavior: "smooth" });
    }
  }, [activeTranscript, playing, mode, showFullTranscript]);

  useEffect(() => {
    if (mode !== MODE_FOCUS) return;
    function keydown(e: KeyboardEvent) {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, select, textarea, button, a, [contenteditable="true"]')) return;
      if (!rows.length) return;
      if (e.code === "Space") { e.preventDefault(); void togglePlayback(); }
      else if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); selectSegment(index - 1); }
      else if (e.key === "ArrowRight" && index < rows.length - 1) { e.preventDefault(); selectSegment(index + 1); }
      else if (e.key.toLowerCase() === "r") { e.preventDefault(); void play(index); }
      else if (e.key === "Enter") { e.preventDefault(); toggleReveal(); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [mode, index, rows, playing]);

  const handlers = {
    onToggle: togglePlayback,
    onSeek: seek,
    onRate: setRatePlayback,
    onMute: toggleMute,
    onPlaying: setPlaying,
    onTime: () => setPosition(audio.current?.currentTime || 0),
    onDuration: () => { const d = audio.current?.duration; setDuration(Number.isFinite(d) ? d : 0); },
    onMeta: () => { if (audio.current) audio.current.playbackRate = rate; },
    onAudioError: () => { setPlaying(false); setError("音频加载失败，请检查网络或联系管理员检查文件。"); },
  };

  return (
    <section className="trainer listening-workspace">
      <aside className="listening-card listening-sidebar">
        <div className="listening-panel-heading"><div className="eyebrow">聴解</div><h2>听力播放器</h2></div>
        <PlayerControls
          audioRef={audio}
          src={assetSrc(q.media_url)}
          mode={mode}
          index={index}
          playing={playing}
          position={position}
          duration={duration}
          rate={rate}
          muted={muted}
          disabled={!q.media_url}
          handlers={handlers}
        />
        {error && <p role="alert">{error}</p>}
      </aside>

      <div className="listening-card listening-content">
        <div className="listening-content-heading">
          <h2>{mode === MODE_FOCUS ? "逐段精听" : "听力题目"}</h2>
          <span>{mode === MODE_FOCUS ? `${rows.length} 个片段 · 按需展开原文` : "听完音频后选择答案"}</span>
          {mode === MODE_FOCUS ? <button className="secondary-button listening-return-full" onClick={() => changeMode(MODE_FULL)} type="button">返回整题</button> : null}
        </div>
        {mode === MODE_FOCUS ? (
          <>
            {!rows.length && <p>本题没有可用的分段时间轴，可使用整题播放。</p>}
            {rows[index] && (
              <FocusStage
                rows={rows}
                index={index}
                playing={playing}
                revealed={revealed}
                translated={translated}
                translations={translations}
                fullTranslation={plain(q.translation)}
                onToggle={togglePlayback}
                onPlayAgain={() => play(index)}
                onSelect={selectSegment}
                onReveal={toggleReveal}
                onTranslate={() => setTranslated((v) => !v)}
              />
            )}
          </>
        ) : (
          <>
            {!result ? <p>检查答案后可查看原文和译文。</p> : null}
            {result ? <FullTranscript question={q} rows={rows} listRef={transcriptList} visible={showFullTranscript} onToggle={() => setShowFullTranscript((v) => !v)} playing={playing} active={activeTranscript} /> : null}
            {q.image_url && <img className="listening-image" src={assetSrc(q.image_url)} alt="听力题目配图" />}
            <div className="listening-grid">
              {q.options.map((o, i) => (
                <button key={o.id} disabled={!!result} className={`secondary-button listening-question ${choice === o.id ? "selected" : ""}`} onClick={() => pickOption(o.id)}>
                  {i + 1}. {plain(o.text)}
                </button>
              ))}
            </div>
            {feedbackMode === "instant" && !result ? <div className="listening-feedback-actions"><button className="primary-button" disabled={!choice || busy} onClick={check}>{busy ? "检查中…" : "检查答案"}</button></div> : null}
            {feedbackMode === "immersive" && !result ? <div className="listening-feedback-actions"><button className="primary-button" disabled={!choice} onClick={continuePractice}>下一题</button></div> : null}
            {result && <><AnswerFeedback result={result} question={q} choice={choice} onFocusMode={() => changeMode(MODE_FOCUS)} /><button className="primary-button" onClick={continuePractice}>继续下一题</button></>}
          </>
        )}
      </div>
    </section>
  );
}
