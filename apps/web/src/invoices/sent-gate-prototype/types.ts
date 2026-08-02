/** Throwaway demo model for sent-gate invoice UI. */

export type InvoiceStatus = "issued" | "sent" | "voided";

export type DemoInvoice = {
  id: string;
  recipient: string;
  clientId: string;
  invoiceNumber: string;
  /** ISO date of billing-period end — drives month/year list separators. */
  periodEnd: string;
  periodLabel: string;
  totalLabel: string;
  status: InvoiceStatus;
};

export type ClientMailSettings = {
  recipientEmail: string;
  emailGreetingName: string;
  invoiceEmailTemplateSubject: string;
  invoiceEmailTemplateBody: string;
};

export type Surface =
  | { kind: "none" }
  | { kind: "reader"; invoiceId: string }
  | { kind: "edit"; invoiceId: string }
  | { kind: "prepare"; invoiceId: string }
  | { kind: "did-you-send"; invoiceId: string }
  | { kind: "void"; invoiceId: string }
  | { kind: "client-mail"; clientId: string };

export type SentGatePrototypeModel = {
  invoices: DemoInvoice[];
  clientMail: Record<string, ClientMailSettings>;
  surface: Surface;
  lastEvent: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenReader: (id: string) => void;
  onOpenEdit: (id: string) => void;
  onOpenPrepare: (id: string) => void;
  onConfirmPrepare: (id: string) => void;
  onDidSendYes: (id: string) => void;
  onDidSendNo: (id: string) => void;
  onOpenVoid: (id: string) => void;
  onConfirmVoid: (id: string) => void;
  onOpenClientMail: (clientId: string) => void;
  onSaveClientMail: (clientId: string, next: ClientMailSettings) => void;
  onDownload: (id: string) => void;
  onCloseSurface: () => void;
  onDismissEvent: () => void;
  onPatchInvoice: (id: string, patch: Partial<Pick<DemoInvoice, "invoiceNumber">>) => void;
};
