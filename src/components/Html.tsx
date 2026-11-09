import React, { useState } from "react";

export function cleanHtml(html) {
  return html ? String(html).replace(/<\/?MOJiTest_URL>/g, "") : "";
}

function cleanInlineHtml(html) {
  return cleanHtml(html)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]*\n[ \t]*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function hasVisibleHtml(html) {
  const cleaned = cleanHtml(html);
  if (!cleaned) return false;
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(cleaned, "text/html");
    return Boolean((doc.body.textContent || "").replace(/\u00a0/g, " ").trim());
  }
  return Boolean(cleaned.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim());
}

export function HtmlContent({ html, inline = false }: { html: any; inline?: boolean }) {
  if (!html) return null;
  return (
    <div
      className="html-content"
      dangerouslySetInnerHTML={{ __html: inline ? cleanInlineHtml(html) : cleanHtml(html) }}
    />
  );
}

export function HtmlInline({ html }) {
  if (!html) return null;
  return <span dangerouslySetInnerHTML={{ __html: cleanHtml(html) }} />;
}

function htmlParagraphs(html) {
  const cleaned = cleanHtml(html);
  if (!cleaned) return [];
  if (typeof DOMParser === "undefined") return [cleaned];
  const doc = new DOMParser().parseFromString(`<section>${cleaned}</section>`, "text/html");
  const paragraphs = Array.from(doc.body.querySelectorAll("p"))
    .map((node) => cleanHtml(node.innerHTML).trim())
    .filter(Boolean);
  return paragraphs.length ? paragraphs : [cleaned];
}

export function BilingualTranscript({ sourceHtml, translationHtml, variant = "listening" }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const sourceLines = htmlParagraphs(sourceHtml);
  const translationLines = htmlParagraphs(translationHtml);
  const maxLines = Math.max(sourceLines.length, showTranslation ? translationLines.length : 0);
  if (!maxLines) return null;

  return (
    <section
      className={`listening-transcript ${variant === "reading" ? "reading-transcript" : ""} ${showTranslation ? "with-translation" : ""}`}
    >
      {translationLines.length ? (
        <div className="bilingual-toolbar">
          <button className="bilingual-toggle" onClick={() => setShowTranslation((v) => !v)} type="button">
            {showTranslation ? "隐藏中文译文" : "显示中文译文"}
          </button>
        </div>
      ) : null}
      {Array.from({ length: maxLines }, (_, index) => (
        <div className="bilingual-line" key={`${index}-${sourceLines[index] || translationLines[index] || ""}`}>
          <HtmlContent html={sourceLines[index]} />
          {showTranslation && translationLines[index] ? (
            <div className="translation-line"><HtmlContent html={translationLines[index]} /></div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
