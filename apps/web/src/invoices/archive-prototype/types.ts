export type ArchiveFolderState =
  | { status: "unsupported" }
  | { status: "unset" }
  | { status: "set"; name: string; permission: "granted" | "prompt" };

export type IssueOutcome =
  | null
  | { kind: "archived"; filename: string }
  | { kind: "needs-folder"; filename: string }
  | { kind: "needs-permission"; filename: string }
  | { kind: "collision"; filename: string };

export type ArchivePrototypeModel = {
  folder: ArchiveFolderState;
  outcome: IssueOutcome;
  exportClientLabel: string;
  exportYearLabel: string;
  onChooseFolder: () => void;
  onChangeFolder: () => void;
  onClearFolder: () => void;
  onGrantPermission: () => void;
  onRetryFile: () => void;
  onDismissOutcome: () => void;
  onDownloadAll: () => void;
  onSimulate: (
    kind: "needs-folder" | "needs-permission" | "collision" | "archived",
  ) => void;
};

export const DEMO_FILENAME =
  "2026007_31_07_26_Invoice_Hannes_Duve_BANDAO.pdf";
