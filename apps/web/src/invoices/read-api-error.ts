import type { InvoiceBlockerCode } from "@hourden/domain";

type ApiErrorBody = {
  error?: string;
  code?: InvoiceBlockerCode;
};

export type ParsedApiError = ApiErrorBody & {
  message: string;
};

export async function readApiErrorBody(res: Response): Promise<ParsedApiError> {
  try {
    const data = (await res.json()) as ApiErrorBody;
    if (data.error) {
      return { ...data, message: data.error };
    }
  } catch {
    // Fall through to generic message.
  }
  return { message: `Request failed (${res.status})` };
}

export async function readApiErrorMessage(res: Response): Promise<string> {
  return (await readApiErrorBody(res)).message;
}
