import type { InvoiceBlockerCode } from "@hourden/domain";
import { isInvoiceBlockerCode } from "@hourden/domain";

type ApiErrorBody = {
  error?: string;
  code?: string;
};

export type ParsedApiError = {
  error?: string;
  code?: InvoiceBlockerCode;
  message: string;
};

export async function readApiErrorBody(res: Response): Promise<ParsedApiError> {
  try {
    const data = (await res.json()) as ApiErrorBody;
    if (data.error) {
      const code =
        data.code && isInvoiceBlockerCode(data.code) ? data.code : undefined;
      return { error: data.error, code, message: data.error };
    }
  } catch {
    // Fall through to generic message.
  }
  return { message: `Request failed (${res.status})` };
}

export async function readApiErrorMessage(res: Response): Promise<string> {
  return (await readApiErrorBody(res)).message;
}
