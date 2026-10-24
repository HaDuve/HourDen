import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_UNDO_MS = 6000;

type UndoableDeleteOptions<T extends { id: string }> = {
  undoMs?: number;
  onCommit: (item: T) => Promise<void>;
  onCommitError?: (item: T) => void;
};

/**
 * Optimistic delete with an Undo window. While the toast is open the item stays
 * off the list but the server DELETE has not run yet; Undo restores the same id.
 */
export function useUndoableDelete<T extends { id: string }>({
  undoMs = DEFAULT_UNDO_MS,
  onCommit,
  onCommitError,
}: UndoableDeleteOptions<T>) {
  const [pending, setPending] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const onCommitRef = useRef(onCommit);
  const onCommitErrorRef = useRef(onCommitError);

  onCommitRef.current = onCommit;
  onCommitErrorRef.current = onCommitError;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushCommit = useCallback(async (item: T) => {
    try {
      await onCommitRef.current(item);
    } catch {
      onCommitErrorRef.current?.(item);
    }
  }, []);

  const commitPending = useCallback(async () => {
    const item = pendingRef.current;
    if (!item) return;
    pendingRef.current = null;
    setPending(null);
    clearTimer();
    await flushCommit(item);
  }, [clearTimer, flushCommit]);

  const requestDelete = useCallback(
    (item: T) => {
      const previous = pendingRef.current;
      clearTimer();
      pendingRef.current = item;
      setPending(item);
      if (previous) {
        void flushCommit(previous);
      }
      timerRef.current = setTimeout(() => {
        void commitPending();
      }, undoMs);
    },
    [clearTimer, commitPending, flushCommit, undoMs],
  );

  const undo = useCallback((): T | null => {
    const item = pendingRef.current;
    if (!item) return null;
    pendingRef.current = null;
    setPending(null);
    clearTimer();
    return item;
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    pendingDelete: pending,
    requestDelete,
    undo,
    commitPending,
  };
}
