// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.fn();

vi.mock("./study", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

import { fetchQuestionPersonal, useQuestionPersonal } from "./questionStats";

describe("fetchQuestionPersonal", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({ items: {} });
  });

  it("requests only missing ids and caches the result per token+source", async () => {
    apiMock.mockResolvedValueOnce({
      items: { 100: { my_attempts: 2, my_correct: 1, my_accuracy: 50.0 } },
    });

    const token = "tok-1";
    const first = await fetchQuestionPersonal("exam_question", [100, 999], token);
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(apiMock).toHaveBeenCalledWith(
      "/api/stats/question-personal?source=exam_question&ids=100,999",
      {},
      token,
    );
    expect(first.get(100)).toEqual({ my_attempts: 2, my_correct: 1, my_accuracy: 50.0 });

    // 已缓存的 id 不再发请求；未作答的 id（999 不在响应里）会被重试
    await fetchQuestionPersonal("exam_question", [100], token);
    expect(apiMock).toHaveBeenCalledTimes(1);

    // 不同 token / source 各自缓存
    await fetchQuestionPersonal("exam_question", [100], "tok-2");
    await fetchQuestionPersonal("question", [100], token);
    expect(apiMock).toHaveBeenCalledTimes(3);
  });

  it("splits requests when more than 200 ids are missing", async () => {
    apiMock.mockResolvedValue({ items: {} });
    const ids = Array.from({ length: 450 }, (_, index) => index + 1);
    await fetchQuestionPersonal("exam_question", ids, "tok");
    expect(apiMock).toHaveBeenCalledTimes(3);
    const thirdCall = apiMock.mock.calls[2][0] as string;
    expect(thirdCall.split("ids=")[1].split(",").length).toBeLessThanOrEqual(200);
  });
});

describe("useQuestionPersonal", () => {
  it("does not request without a token or with an empty id list", async () => {
    const { renderHook } = await import("@testing-library/react");
    apiMock.mockResolvedValue({ items: {} });

    const noToken = renderHook(() => useQuestionPersonal("exam_question", [1], null));
    expect(apiMock).not.toHaveBeenCalled();
    noToken.unmount();

    const emptyIds = renderHook(() => useQuestionPersonal("exam_question", [], "tok"));
    expect(apiMock).not.toHaveBeenCalled();
    emptyIds.unmount();
  });

  it("fetches once for the same id set and exposes the stats map", async () => {
    const { renderHook, waitFor } = await import("@testing-library/react");
    apiMock.mockResolvedValue({
      items: { 7: { my_attempts: 3, my_correct: 2, my_accuracy: 66.7 } },
    });

    const { result, rerender, unmount } = renderHook(
      ({ ids }: { ids: number[] }) => useQuestionPersonal("exam_question", ids, "tok"),
      { initialProps: { ids: [7, 8] } },
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.get(7)).toEqual({ my_attempts: 3, my_correct: 2, my_accuracy: 66.7 });

    // 父组件重渲染时数组引用变化不应触发第二次请求
    rerender({ ids: [8, 7] });
    expect(apiMock).toHaveBeenCalledTimes(1);
    unmount();
  });
});
