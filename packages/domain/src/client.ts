export type Client = {
  id: string;
  name: string;
  defaultRate: number;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  invoicePrefix: string | null;
  invoiceNumberSeqBeforeYear: boolean;
  recipientEmail: string | null;
  emailGreetingName: string | null;
  invoiceEmailSubject: string | null;
  invoiceEmailBody: string | null;
};

export type CreateClientInput = {
  name: string;
  defaultRate: number;
  legalName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
};

export type UpdateClientInput = {
  name?: string;
  defaultRate?: number;
  legalName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  recipientEmail?: string | null;
  emailGreetingName?: string | null;
  invoiceEmailSubject?: string | null;
  invoiceEmailBody?: string | null;
};
