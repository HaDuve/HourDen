import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDeleteDialog } from "./useDeleteDialog.js";

type Item = { id: string; name: string };

describe("useDeleteDialog", () => {
  it("locks the delete target id when the dialog opens", () => {
    const { result } = renderHook(() => useDeleteDialog<Item>());

    act(() => {
      result.current.openDeleteDialog({ id: "a", name: "Alpha" });
    });

    expect(result.current.pendingDelete?.name).toBe("Alpha");
    expect(result.current.getDeleteTargetId()).toBe("a");
    expect(result.current.isDeleteDialogOpen).toBe(true);
  });

  it("ignores a second open attempt while the dialog is active", () => {
    const { result } = renderHook(() => useDeleteDialog<Item>());

    act(() => {
      result.current.openDeleteDialog({ id: "a", name: "Alpha" });
    });
    act(() => {
      result.current.openDeleteDialog({ id: "b", name: "Beta" });
    });

    expect(result.current.getDeleteTargetId()).toBe("a");
    expect(result.current.pendingDelete?.name).toBe("Alpha");
  });

  it("clears the locked id when the dialog closes", () => {
    const { result } = renderHook(() => useDeleteDialog<Item>());

    act(() => {
      result.current.openDeleteDialog({ id: "a", name: "Alpha" });
    });
    act(() => {
      result.current.closeDeleteDialog();
    });

    expect(result.current.getDeleteTargetId()).toBeNull();
    expect(result.current.pendingDelete).toBeNull();
    expect(result.current.isDeleteDialogOpen).toBe(false);
  });
});
