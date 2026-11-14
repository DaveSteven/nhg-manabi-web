// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UiSelect from "./UiSelect";

const options = [
  { value: "N5", label: "N5" },
  { value: "N4", label: "N4" },
  { value: "N3", label: "N3" },
];

afterEach(cleanup);

describe("UiSelect", () => {
  it("opens its custom menu and selects an option", () => {
    const onChange = vi.fn();
    render(<UiSelect label="等级" value="N5" options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "等级" }));
    expect(screen.getByRole("listbox", { name: "等级" })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "N4" }));

    expect(onChange).toHaveBeenCalledWith("N4");
    expect(screen.queryByRole("listbox", { name: "等级" })).toBeNull();
  });

  it("supports arrow keys and Enter", () => {
    const onChange = vi.fn();
    render(<UiSelect label="等级" value="N5" options={options} onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "等级" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("N4");
  });

  it("renders the quiet variant with an overridden trigger label (T-033)", () => {
    render(
      <UiSelect
        ariaLabel="目标考试"
        quiet
        value="N5"
        options={options}
        selectedLabel="JLPT 冬季统考 · 12月6日 周日"
        onChange={() => {}}
      />,
    );
    const field = document.querySelector(".ui-select-field");
    expect(field?.classList.contains("quiet")).toBe(true);
    // 触发器显示 selectedLabel 短文案，菜单项仍用 option.label
    expect(screen.getByRole("button", { name: "目标考试" }).textContent).toBe("JLPT 冬季统考 · 12月6日 周日");
    fireEvent.click(screen.getByRole("button", { name: "目标考试" }));
    expect(screen.getByRole("option", { name: "N5" })).toBeTruthy();
  });
});
