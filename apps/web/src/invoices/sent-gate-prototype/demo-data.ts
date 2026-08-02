import type { ClientMailSettings, DemoInvoice } from "./types.js";

export const DEMO_INVOICES: DemoInvoice[] = [
  {
    id: "inv-issued-2",
    recipient: "Hannah Example",
    clientId: "client-hannah",
    invoiceNumber: "HAN2026002",
    periodEnd: "2026-07-31",
    periodLabel: "01.07–31.07.2026",
    totalLabel: "€ 1.200,00",
    status: "issued",
  },
  {
    id: "inv-issued-1",
    recipient: "BANDAO Guidance GmbH",
    clientId: "client-bandao",
    invoiceNumber: "BAN2026006",
    periodEnd: "2026-06-30",
    periodLabel: "01.06–30.06.2026",
    totalLabel: "€ 4.820,00",
    status: "issued",
  },
  {
    id: "inv-sent-1",
    recipient: "BANDAO Guidance GmbH",
    clientId: "client-bandao",
    invoiceNumber: "BAN2026005",
    periodEnd: "2026-05-31",
    periodLabel: "01.05–31.05.2026",
    totalLabel: "€ 3.100,00",
    status: "sent",
  },
  {
    id: "inv-sent-2",
    recipient: "Hannah Example",
    clientId: "client-hannah",
    invoiceNumber: "HAN2026001",
    periodEnd: "2026-04-30",
    periodLabel: "01.04–30.04.2026",
    totalLabel: "€ 900,00",
    status: "sent",
  },
  {
    id: "inv-void-1",
    recipient: "Hannah Example",
    clientId: "client-hannah",
    invoiceNumber: "HAN2025004",
    periodEnd: "2025-12-31",
    periodLabel: "01.12–31.12.2025",
    totalLabel: "€ 1.050,00",
    status: "voided",
  },
  {
    id: "inv-sent-3",
    recipient: "BANDAO Guidance GmbH",
    clientId: "client-bandao",
    invoiceNumber: "BAN2025012",
    periodEnd: "2025-11-30",
    periodLabel: "01.11–30.11.2025",
    totalLabel: "€ 2.400,00",
    status: "sent",
  },
  {
    id: "inv-sent-4",
    recipient: "BANDAO Guidance GmbH",
    clientId: "client-bandao",
    invoiceNumber: "BAN2025011",
    periodEnd: "2025-10-31",
    periodLabel: "01.10–31.10.2025",
    totalLabel: "€ 2.100,00",
    status: "sent",
  },
];

export const DEMO_CLIENT_MAIL: Record<string, ClientMailSettings> = {
  "client-bandao": {
    recipientEmail: "billing@bandao.example",
    emailGreetingName: "Anna",
    invoiceEmailTemplateSubject: "Invoice {{number}} — {{period}}",
    invoiceEmailTemplateBody:
      "Hallo {{greeting}},\n\nplease find invoice {{number}} for {{period}} attached.\n\nBest,\n{{operator}}",
  },
  "client-hannah": {
    recipientEmail: "hannah@example.com",
    emailGreetingName: "Hannah",
    invoiceEmailTemplateSubject: "Rechnung {{number}}",
    invoiceEmailTemplateBody:
      "Hallo {{greeting}},\nanbei die Rechnung {{number}}.\n\nLiebe Grüße\n{{operator}}",
  },
};
