import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/collection/jackets",
  useSearchParams: () => new URLSearchParams(),
}));

import { SortDropdown } from "../sort-dropdown";

// Sort component uses our custom Select combobox (button + listbox), not a
// native <select>, so userEvent.selectOptions doesn't apply. Drive it with
// click + click-on-option just like a real user.
describe("SortDropdown", () => {
  it("renders default Newest in the trigger", () => {
    render(<SortDropdown />);
    expect(screen.getByRole("combobox", { name: /sort/i })).toHaveTextContent(/newest/i);
  });
  it("calls router.push when changed", async () => {
    pushMock.mockClear();
    render(<SortDropdown />);
    await userEvent.click(screen.getByRole("combobox", { name: /sort/i }));
    await userEvent.click(
      screen.getByRole("option", { name: "Price: low to high" }),
    );
    expect(pushMock).toHaveBeenCalled();
    expect(pushMock.mock.calls[0][0]).toContain("sort=price-asc");
  });
});
