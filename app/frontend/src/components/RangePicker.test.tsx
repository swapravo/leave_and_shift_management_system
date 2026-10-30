import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RangePicker } from "./RangePicker";

describe("RangePicker", () => {
  it("picks a range with two taps and orders the ends", async () => {
    const onChange = vi.fn();
    render(<RangePicker start="" end="" today="2026-10-30" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    await userEvent.click(screen.getByRole("button", { name: "Wed 04 Nov" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-04", "2026-11-04");
    await userEvent.click(screen.getByRole("button", { name: "Mon 02 Nov" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-02", "2026-11-04");
  });

  it("does not let you pick a day in the past", () => {
    render(<RangePicker start="" end="" today="2026-10-30" onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Thu 29 Oct" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fri 30 Oct" })).toBeEnabled();
  });
});
