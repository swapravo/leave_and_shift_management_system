import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Landing from "./Landing";

describe("Landing", () => {
  it("has exactly one link, and it goes to the sign-in page", () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/login");
    expect(links[0]).toHaveTextContent("Sign in to my shifts");
  });

  it("answers the common worries in the FAQ", () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByText("Do I need to sign up?")).toBeInTheDocument();
    expect(screen.getByText("Can I take a request back?")).toBeInTheDocument();
  });

  it("has one top-level heading", () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
