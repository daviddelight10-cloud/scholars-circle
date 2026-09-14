import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Bomb({ trigger }) {
  if (trigger) throw new Error("kaboom");
  return <div>child rendered</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Bomb trigger={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("child rendered")).toBeInTheDocument();
  });

  it("shows the fallback UI when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb trigger={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
    expect(screen.queryByText("child rendered")).not.toBeInTheDocument();
  });

  it("clears the error and re-renders children on Try Again", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb trigger={shouldThrow} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    shouldThrow = false;
    rerender(
      <ErrorBoundary>
        <Bomb trigger={shouldThrow} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText("Try Again"));

    expect(screen.getByText("child rendered")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});
