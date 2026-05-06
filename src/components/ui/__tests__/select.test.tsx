import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../select";

describe("Select", () => {
  it("opens the listbox and fires onChange when an option is picked", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Country"
        value="GB"
        onChange={onChange}
        options={[
          { value: "GB", label: "United Kingdom" },
          { value: "US", label: "United States" },
        ]}
      />,
    );
    // Now a button-driven combobox, not a native <select>: open it then click.
    await userEvent.click(screen.getByLabelText("Country"));
    await userEvent.click(screen.getByRole("option", { name: "United States" }));
    expect(onChange).toHaveBeenCalledWith("US");
  });
});
