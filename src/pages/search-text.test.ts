// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cleanSearchText } from "./index";

describe("cleanSearchText", () => {
  it("decodes entities and formats sentence-order blanks", () => {
    expect(cleanSearchText("家を買うことについて__&nbsp;__&nbsp;★&nbsp;&nbsp;__簡単に引っ越せない"))
      .toBe("家を買うことについて＿＿ ＿＿ ★ ＿＿簡単に引っ越せない");
  });

  it("removes transcript markup while keeping line breaks", () => {
    expect(cleanSearchText('<p class="moji-content" data-starttime="00:00">一行目</p><p>二行目</p><MOJITest_URL>'))
      .toBe("一行目\n二行目");
  });
});
