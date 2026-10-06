import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the shop name", () => {
    render(<App />);

    const heading = screen.getByRole("heading", { name: /mern shop/i });

    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("MERN Shop");
  });

  it("renders the CTA button", () => {
    render(<App />);

    const button = screen.getByRole("button", { name: /get started/i });

    expect(button).toBeInTheDocument();
  });
});