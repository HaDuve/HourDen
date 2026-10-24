import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUndoableDelete } from "./useUndoableDelete.js";

const entry = { id: "e1", description: "Work" };

describe("useUndoableDelete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not commit until the undo window elapses", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableDelete({ onCommit, undoMs: 6000 }),
    );

    act(() => {
      result.current.requestDelete(entry);
    });

    expect(result.current.pendingDelete).toEqual(entry);
    expect(onCommit).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5999);
    });
    expect(onCommit).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(onCommit).toHaveBeenCalledWith(entry);
    expect(result.current.pendingDelete).toBeNull();
  });

  it("undo restores the pending item without committing", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableDelete({ onCommit, undoMs: 6000 }),
    );

    act(() => {
      result.current.requestDelete(entry);
    });

    let restored: typeof entry | null = null;
    act(() => {
      restored = result.current.undo();
    });

    expect(restored).toEqual(entry);
    expect(result.current.pendingDelete).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(onCommit).not.toHaveBeenCalled();
  });
});
