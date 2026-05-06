import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneInput } from "../phone-input";

function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = React.useState("");
  return (
    <PhoneInput
      label="Phone"
      defaultCountry="GB"
      value={v}
      onChange={(next) => {
        setV(next);
        onChange(next);
      }}
    />
  );
}

describe("PhoneInput", () => {
  it("emits value with prefix included after typing the local part", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Phone");
    await userEvent.type(input, "7700900123");
    expect(onChange).toHaveBeenLastCalledWith("+44 7700900123");
  });
});
