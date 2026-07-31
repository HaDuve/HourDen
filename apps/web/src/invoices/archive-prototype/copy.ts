/** Hardcoded EN — throwaway prototype copy candidates, not wired to i18n. */

export const protoCopy = {
  archiveFolder: "Archive folder",
  chooseFolder: "Choose archive folder",
  changeFolder: "Change",
  clearFolder: "Clear",
  folderUnset: "Not set — issued PDFs won’t be filed until you choose a folder.",
  folderSet: "Filing into “{{name}}” as Recipient/year/…",
  downloadAll: "Download all outgoing invoices",
  unsupported:
    "Local archive filing needs Chrome or Edge. You can still download invoices below.",
  persistTip:
    "Tip: when Chrome asks, choose “Allow on every visit” (or install HourDen as an app) so filing keeps working after you close the tab.",
  issueOkArchived: "Invoice issued. PDF saved to the archive folder.",
  issueOkNeedsFolder:
    "Invoice issued, but no archive folder is set. Choose a folder to file this PDF.",
  issueOkNeedsPermission:
    "Invoice issued, but HourDen needs permission to write to the archive folder.",
  issueOkCollision:
    "Invoice issued. Archive skipped — “{{filename}}” already exists in that folder.",
  grantAndRetry: "Grant access & file PDF",
  chooseAndRetry: "Choose folder & file PDF",
  dismiss: "Dismiss",
  simulateNoFolder: "Simulate Issue — no folder",
  simulatePermission: "Simulate Issue — need permission",
  simulateCollision: "Simulate Issue — collision",
  simulateSuccess: "Simulate Issue — archived OK",
  stateLabel: "Prototype state",
  moreActions: "Archive folder actions",
} as const;

export function fill(
  template: string,
  vars: Record<string, string>,
): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{{${k}}}`, v),
    template,
  );
}
