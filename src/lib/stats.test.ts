import { describe, expect, it } from "vitest";
import { compareRecentActivity, heatLevel } from "./stats";

describe("statistics calculations", () => {
  it("compares recent question volume and weighted accuracy", () => {
    const activity = [
      { answered: 10, correct: 5 },
      { answered: 10, correct: 7 },
      { answered: 20, correct: 16 },
      { answered: 20, correct: 18 },
    ];
    expect(compareRecentActivity(activity, 2)).toMatchObject({
      volumeChange: 100,
      accuracyChange: 25,
    });
  });

  it("maps activity into a stable five-step heat scale", () => {
    expect([0, 1, 5, 10, 20].map((value) => heatLevel(value, 20))).toEqual([0, 1, 1, 2, 4]);
  });
});
