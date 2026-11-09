// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BilingualTranscript, cleanHtml, HtmlContent } from "./Html";

afterEach(cleanup);

describe("rich text display", () => {
  it("preserves Quill formats while removing executable markup", () => {
    const { container } = render(<HtmlContent html={'<h2>解説</h2><p class="ql-align-center"><strong>重要</strong></p><ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>項目</li></ol><a href="javascript:alert(1)">link</a><img src="x" onerror="alert(1)"><script>alert(1)</script>'} />);
    expect(container.querySelector(".rich-text h2")?.textContent).toBe("解説");
    expect(container.querySelector(".ql-align-center strong")).not.toBeNull();
    expect(container.querySelector('li[data-list="bullet"]')).not.toBeNull();
    expect(container.querySelector("script, [onerror], a[href]")).toBeNull();
  });

  it("retains legacy plain text line breaks and removes source wrappers", () => {
    expect(cleanHtml("一行目\n二行目")).toBe("一行目<br>二行目");
    expect(cleanHtml("<MOJiTest_URL><p>本文</p></MOJiTest_URL>")).toBe("<p>本文</p>");
  });

  it("keeps headings, lists, and paragraph formatting in bilingual content", () => {
    const { container, getByRole } = render(<BilingualTranscript sourceHtml={'<h2>題名</h2><p class="ql-align-right">本文</p><ul><li>項目</li></ul>'} translationHtml={'<h2>标题</h2><p><em>译文</em></p>'} />);
    expect(container.querySelector("h2")?.textContent).toBe("題名");
    expect(container.querySelector("p.ql-align-right")?.textContent).toBe("本文");
    expect(container.querySelector("ul li")?.textContent).toBe("項目");
    fireEvent.click(getByRole("button", { name: "显示中文译文" }));
    expect(container.querySelector(".translation-line em")?.textContent).toBe("译文");
  });
});
