import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, History, Save, Search } from "lucide-react";
import UiSelect from "../components/UiSelect";
import { PageHeader } from "../components/CommonUi";
import { LEVELS, api, examQuestionCategoryLabel } from "../lib/study";

const ANSWER_STATUSES = [
  { value: "unverified", label: "未校验" },
  { value: "auto_verified", label: "自动校验" },
  { value: "verified", label: "人工确认" },
  { value: "disputed", label: "存疑" },
  { value: "corrected", label: "已修正" },
];

const ANALYSIS_STATUSES = [
  { value: "missing", label: "缺少解析" },
  { value: "draft", label: "整理草稿" },
  { value: "reviewed", label: "审核完成" },
  { value: "disputed", label: "解析存疑" },
];

const CATEGORIES = [
  { value: "", label: "全部分类" },
  { value: "vocabulary", label: "文字词汇" },
  { value: "grammar", label: "文法" },
  { value: "reading", label: "读解" },
  { value: "listening", label: "听力" },
];

function plainText(value: string) {
  const decoder = document.createElement("textarea");
  decoder.innerHTML = String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p[^>]*>/gi, "\n").replace(/<[^>]+>/g, "");
  return decoder.value.replace(/\u00a0/g, " ").trim();
}

function statusLabel(options, value) {
  return options.find((item) => item.value === value)?.label || value;
}

export default function AdminQuestions({ token, onBack }) {
  const [filters, setFilters] = useState({ q: "", level: "", category: "", answer_status: "", analysis_status: "" });
  const [submittedFilters, setSubmittedFilters] = useState(filters);
  const [list, setList] = useState({ items: [], total: 0, page: 1, page_size: 30 });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams({ page: String(page), page_size: "30" });
    Object.entries(submittedFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
    setLoading(true);
    api(`/api/admin/exam-questions?${params}`, {}, token)
      .then((data) => { if (!ignore) setList(data); })
      .catch((error) => { if (!ignore) setMessage(error.message || "题目列表加载失败"); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [submittedFilters, page, token]);

  useEffect(() => {
    if (!selectedId) return;
    let ignore = false;
    setMessage("");
    api(`/api/admin/exam-questions/${selectedId}`, {}, token).then((data) => {
      if (ignore) return;
      setDetail(data);
      setDraft({
        correct_option_id: data.correct_option_id,
        answer_status: data.answer_status,
        analysis_status: data.analysis_status,
        translation: data.translation || "",
        analysis: data.analysis || "",
        analysis_document: data.analysis_document || {},
        review_note: data.review_note || "",
      });
    }).catch((error) => { if (!ignore) setMessage(error.message || "题目详情加载失败"); });
    return () => { ignore = true; };
  }, [selectedId, token]);

  const totalPages = Math.max(1, Math.ceil(list.total / list.page_size));
  const document = draft?.analysis_document || {};
  const updateDocument = (key, value) => setDraft((current) => ({ ...current, analysis_document: { ...current.analysis_document, [key]: value } }));

  async function save() {
    if (!selectedId || !draft?.correct_option_id) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await api(`/api/admin/exam-questions/${selectedId}`, { method: "PATCH", body: JSON.stringify(draft) }, token);
      setDetail(updated);
      setDraft({ ...draft, answer_version: updated.answer_version });
      setMessage("已保存，并记录到版本历史。");
      setList((current) => ({ ...current, items: current.items.map((item: any) => item.id === updated.id ? { ...item, answer_status: updated.answer_status, analysis_status: updated.analysis_status, correct_option_id: updated.correct_option_id, answer_version: updated.answer_version } : item) }));
    } catch (error: any) {
      setMessage(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-questions-page">
      <PageHeader className="admin-page-header" onBack={onBack}>
        <div><div className="eyebrow">JLPT GO! ADMIN</div><h1>真题校正</h1><p>校正答案，整理解析并保留修改历史</p></div>
      </PageHeader>

      <form className="admin-question-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmittedFilters(filters); }}>
        <label className="admin-keyword"><Search size={18} /><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="搜索题干或选项" /></label>
        <UiSelect value={filters.level} options={[{ value: "", label: "全部等级" }, ...LEVELS.map((value) => ({ value, label: value }))]} onChange={(value) => setFilters({ ...filters, level: value })} ariaLabel="等级" />
        <UiSelect value={filters.category} options={CATEGORIES} onChange={(value) => setFilters({ ...filters, category: value })} ariaLabel="分类" />
        <UiSelect value={filters.answer_status} options={[{ value: "", label: "全部答案状态" }, ...ANSWER_STATUSES]} onChange={(value) => setFilters({ ...filters, answer_status: value })} ariaLabel="答案状态" />
        <UiSelect value={filters.analysis_status} options={[{ value: "", label: "全部解析状态" }, ...ANALYSIS_STATUSES]} onChange={(value) => setFilters({ ...filters, analysis_status: value })} ariaLabel="解析状态" />
        <button className="primary-button" type="submit">筛选</button>
      </form>

      {message ? <div className="admin-message" role="status">{message}</div> : null}
      <div className="admin-question-workspace">
        <aside className="admin-question-list" aria-busy={loading}>
          <div className="admin-list-summary"><strong>{list.total} 道题</strong><span>{page} / {totalPages}</span></div>
          {list.items.map((item: any) => (
            <button className={selectedId === item.id ? "selected" : ""} key={item.id} type="button" onClick={() => setSelectedId(item.id)}>
              <div><span>{item.level}</span><span>{item.category_label}</span><span>{statusLabel(ANSWER_STATUSES, item.answer_status)}</span></div>
              <strong>{item.exam_title} · 第 {item.order_index} 题</strong>
              <p>{plainText(item.title || item.passage).slice(0, 110) || "（无文字题干）"}</p>
              <ChevronRight size={18} />
            </button>
          ))}
          <nav className="admin-list-pages"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">上一页</button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">下一页</button></nav>
        </aside>

        <main className="admin-question-editor">
          {!draft || !detail ? <div className="admin-editor-empty"><CheckCircle2 size={40} /><strong>选择一道题开始校正</strong><span>修改会保存版本历史，学生端不会看到审核备注。</span></div> : (
            <>
              <div className="admin-editor-heading"><div><span>{detail.level} · {examQuestionCategoryLabel(detail)}</span><h2>{detail.exam_title} · 第 {detail.order_index} 题</h2></div><button className="primary-button" type="button" disabled={saving || !draft.correct_option_id} onClick={save}><Save size={18} />{saving ? "保存中…" : "保存修订"}</button></div>
              <section className="admin-source-question"><h3>原题</h3>{detail.passage ? <p>{plainText(detail.passage)}</p> : null}<p>{plainText(detail.title)}</p><div className="admin-option-editor">{detail.options.map((option) => <label className={draft.correct_option_id === option.id ? "correct" : ""} key={option.id}><input type="radio" name="correct-option" checked={draft.correct_option_id === option.id} onChange={() => setDraft({ ...draft, correct_option_id: option.id })} /><span>{option.source_order}</span><strong>{plainText(option.text)}</strong></label>)}</div></section>
              <section className="admin-editor-fields"><div className="admin-editor-row"><UiSelect label="答案状态" value={draft.answer_status} options={ANSWER_STATUSES} onChange={(value) => setDraft({ ...draft, answer_status: value })} /><UiSelect label="解析状态" value={draft.analysis_status} options={ANALYSIS_STATUSES} onChange={(value) => setDraft({ ...draft, analysis_status: value })} /></div><label>题目翻译<textarea value={draft.translation} onChange={(event) => setDraft({ ...draft, translation: event.target.value })} rows={4} /></label><label>解析正文<textarea value={draft.analysis} onChange={(event) => setDraft({ ...draft, analysis: event.target.value })} rows={8} /></label><div className="admin-structured-grid"><label>解析摘要<textarea value={document.summary || ""} onChange={(event) => updateDocument("summary", event.target.value)} rows={4} /></label><label>原文依据<textarea value={document.evidence || ""} onChange={(event) => updateDocument("evidence", event.target.value)} rows={4} /></label><label>知识点<textarea value={document.knowledge_points || ""} onChange={(event) => updateDocument("knowledge_points", event.target.value)} rows={3} /></label><label>解题提示<textarea value={document.tips || ""} onChange={(event) => updateDocument("tips", event.target.value)} rows={3} /></label></div><label>审核备注<textarea value={draft.review_note} onChange={(event) => setDraft({ ...draft, review_note: event.target.value })} rows={3} placeholder="记录答案来源、修改原因或存疑点；学生不可见" /></label></section>
              <section className="admin-analysis-preview"><h3>学生端预览</h3>{draft.translation ? <div><strong>题目翻译</strong><p>{draft.translation}</p></div> : null}{document.summary ? <div><strong>解析摘要</strong><p>{document.summary}</p></div> : null}{draft.analysis ? <div><strong>答案解析</strong><p>{draft.analysis}</p></div> : null}{document.evidence ? <div><strong>原文依据</strong><p>{document.evidence}</p></div> : null}{document.knowledge_points ? <div><strong>知识点</strong><p>{document.knowledge_points}</p></div> : null}{document.tips ? <div><strong>解题提示</strong><p>{document.tips}</p></div> : null}</section>
              <section className="admin-revision-history"><h3><History size={18} />版本历史</h3>{detail.revisions.length ? detail.revisions.map((revision) => <div key={revision.id}><strong>版本修改 · {new Date(revision.created_at).toLocaleString("zh-CN")}</strong><span>{revision.note || "无审核备注"}</span></div>) : <p>尚无修订记录。</p>}</section>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
