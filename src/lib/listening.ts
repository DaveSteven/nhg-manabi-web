export const LISTENING_TYPES = [
  { id: 41, label: "课题理解", description: "听懂任务并选择接下来应做的事情" },
  { id: 42, label: "要点理解", description: "抓住问题要求的关键信息" },
  { id: 43, label: "概要理解", description: "理解对话或讲话的整体主旨" },
  { id: 44, label: "表达选择", description: "根据场景选择合适的表达" },
  { id: 45, label: "即时应答", description: "选择最自然的即时回应" },
  { id: 46, label: "综合理解", description: "综合多段信息进行判断" },
];

const GROUP_LABELS = {
  41: "課題理解 · 任务理解",
  42: "ポイント理解 · 要点理解",
  43: "概要理解 · 概要理解",
  44: "発話表現 · 表达选择",
  45: "即時応答 · 即时应答",
  46: "統合理解 · 综合理解",
};

export function listeningGroupLabel(questionType: number) {
  return GROUP_LABELS[questionType];
}

const parseHtml = (html = "") => new DOMParser().parseFromString(html || "", "text/html");

/** Plain text of an HTML fragment. */
export function plain(html = "") {
  return parseHtml(html).body.textContent?.trim() || "";
}

export function analysisParagraphs(html: string) {
  const body = parseHtml(html).body;
  body.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  body.querySelectorAll("p, div, li").forEach((el) => el.append("\n"));
  return (body.textContent || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

export function translationLines(html: string) {
  return Array.from(parseHtml(html).querySelectorAll("p")).map((p) => p.textContent);
}

/** "00:01:02,500" -> 62.5 seconds. */
function parseTime(value: string) {
  const m = value?.match(/^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0") / 1000 : NaN;
}

export function segments(html: string) {
  return Array.from(parseHtml(html).querySelectorAll("[data-starttime][data-endtime]"))
    .map((el) => ({
      start: parseTime(el.getAttribute("data-starttime")),
      end: parseTime(el.getAttribute("data-endtime")),
      text: el.textContent?.trim() || "",
    }))
    .filter((s) => Number.isFinite(s.start) && s.end > s.start);
}

export function readProgress(key: string) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
