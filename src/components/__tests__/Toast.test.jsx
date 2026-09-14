import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, toast } from "../Toast";

describe("Toast", () => {
  it("renders a message fired through the global toast object", () => {
    render(
      <ToastProvider>
        <div>app content</div>
      </ToastProvider>
    );

    act(() => {
      toast.error("Sync failed");
    });

    expect(screen.getByText("Sync failed")).toBeInTheDocument();
    expect(screen.getByText("app content")).toBeInTheDocument();
  });

  it("renders success, info and warning messages", () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>
    );

    act(() => {
      toast.success("Saved!");
      toast.info("Tip: review daily");
      toast.warning("Low storage");
    });

    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(screen.getByText("Tip: review daily")).toBeInTheDocument();
    expect(screen.getByText("Low storage")).toBeInTheDocument();
  });

  it("each toast shows its type icon", () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>
    );

    act(() => {
      toast.error("Boom");
    });

    expect(screen.getByText("✕")).toBeInTheDocument();
  });
});
