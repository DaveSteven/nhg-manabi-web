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
});
