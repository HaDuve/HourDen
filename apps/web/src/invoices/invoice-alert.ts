import type { InvoiceBlockerCode } from "@hourden/domain";

export type InvoiceAlert =
  | { kind: "blocker"; code: InvoiceBlockerCode; clientId?: string }
  | { kind: "plain"; message: string };
