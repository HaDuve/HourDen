import { useRef, useState } from "react";

type Deletable = { id: string };

export function useDeleteDialog<T extends Deletable>() {
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const deleteTargetIdRef = useRef<string | null>(null);

  const openDeleteDialog = (item: T) => {
    if (deleteTargetIdRef.current) return;
    deleteTargetIdRef.current = item.id;
    setPendingDelete(item);
  };

  const closeDeleteDialog = () => {
    deleteTargetIdRef.current = null;
    setPendingDelete(null);
  };

  const getDeleteTargetId = () => deleteTargetIdRef.current;

  return {
    pendingDelete,
    isDeleteDialogOpen: pendingDelete !== null,
    openDeleteDialog,
    closeDeleteDialog,
    getDeleteTargetId,
  };
}
