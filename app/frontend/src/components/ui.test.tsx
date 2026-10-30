import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../api";
import { DecisionDialog, ErrorBox, StatusBadge, statusLabel } from "./ui";
import { navFor } from "./Layout";

describe("StatusBadge", () => {
  const statuses = ["pending", "approved", "rejected", "cancelled", "declined", "pending_peer", "pending_manager",
    "refunded", "owed", "forfeited", "removed", "restored", "not_restored", "on_shift", "on_leave", "off", "gap"];

  it.each(statuses)("shows a text label for %s (never colour alone)", (status) => {
    render(<StatusBadge status={status} />);
    const label = statusLabel(status);
    expect(label).not.toMatch(/_/);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("allows a custom label", () => {
    render(<StatusBadge status="gap" label="Short" />);
    expect(screen.getByText("Short")).toHaveClass("badge-bad");
  });
});

describe("ErrorBox", () => {
  it("lists every coverage violation when there are several", () => {
    const err = new ApiError(409, "COVERAGE_VIOLATION", "Morning on Mon 15 Jun would drop below its minimum", [
      { date: "2026-06-15", shift_template_id: 1, shift_name: "Morning", min_headcount: 2, headcount_without_you: 1 },
      { date: "2026-06-16", shift_template_id: 2, shift_name: "Evening", min_headcount: 2, headcount_without_you: 0 },
    ]);
    render(<ErrorBox error={err} />);
    expect(screen.getByRole("alert")).toHaveTextContent("would drop below");
    expect(screen.getByText(/Evening on Tue 16 Jun: 0 of 2 without you/)).toBeInTheDocument();
  });

  it("renders nothing without an error", () => {
    const { container } = render(<ErrorBox error={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DecisionDialog", () => {
  it("requires a comment to reject", async () => {
    const onSubmit = vi.fn();
    render(<DecisionDialog title="Reject leave request" approve={false} onSubmit={onSubmit} onCancel={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onSubmit).not.toHaveBeenCalled(); // native required validation blocks the submit
    await userEvent.type(screen.getByLabelText("Comment"), "Quarter end");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onSubmit).toHaveBeenCalledWith("Quarter end");
  });

  it("lets an approval go without a comment", async () => {
    const onSubmit = vi.fn();
    render(<DecisionDialog title="Approve" approve onSubmit={onSubmit} onCancel={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onSubmit).toHaveBeenCalledWith("");
  });
});

describe("navigation by role", () => {
  const labels = (role: "employee" | "manager" | "hr_admin") => navFor(role).map((i) => i.label);

  it("gives employees four places", () => {
    expect(labels("employee")).toEqual(["Home", "Calendar", "Requests", "Inbox"]);
  });

  it("adds the roster for managers and keeps them to five", () => {
    expect(labels("manager")).toEqual(["Home", "Calendar", "Requests", "Roster", "Inbox"]);
  });

  it("gives HR settings and the roster but no personal requests", () => {
    const h = labels("hr_admin");
    expect(h).toEqual(["Home", "Calendar", "Roster", "Inbox", "Settings"]);
    expect(h).not.toContain("Requests");
  });

  it("never needs more tabs than fit on a phone", () => {
    for (const role of ["employee", "manager", "hr_admin"] as const) expect(navFor(role).length).toBeLessThanOrEqual(5);
  });
});
