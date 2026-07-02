export type NormalizeInvoicePdfTextOptions = {
  invoiceNumber?: string;
  legalName?: string;
};

export function normalizeInvoicePdfText(
  text: string,
  options: NormalizeInvoicePdfTextOptions = {},
): string {
  let normalized = text;

  if (options.invoiceNumber) {
    normalized = normalized.replaceAll(options.invoiceNumber, "<INVOICE_NUMBER>");
  }
  if (options.legalName) {
    normalized = normalized.replaceAll(options.legalName, "<LEGAL_NAME>");
  }

  return (
    normalized
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0 && !/^-- \d+ of \d+ --$/.test(line))
      .join("\n") + "\n"
  );
}
