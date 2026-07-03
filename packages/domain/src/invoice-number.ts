export type InvoiceNumberingStrategy = "sequential" | "from_last";

const INVOICE_PREFIX_RE = /^[A-Z0-9]{1,6}$/;

export function deriveDefaultInvoicePrefix(clientName: string): string {
  const letters = clientName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
  return letters;
}

export function normalizeInvoicePrefix(prefix: string): string {
  return prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function isValidInvoicePrefix(prefix: string): boolean {
  return INVOICE_PREFIX_RE.test(prefix);
}

function formatInvoiceSuffix(sequence: number): string {
  return String(sequence).padStart(3, "0");
}

export function buildPrefixedInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number,
): string {
  return `${prefix}${year}${formatInvoiceSuffix(sequence)}`;
}

export function parsePrefixedInvoiceNumber(
  invoiceNumber: string,
  prefix: string,
  year: number,
): number | null {
  const expectedPrefix = `${prefix}${year}`;
  if (!invoiceNumber.startsWith(expectedPrefix)) {
    return null;
  }

  const suffix = invoiceNumber.slice(expectedPrefix.length);
  if (!/^\d{3,}$/.test(suffix)) {
    return null;
  }

  return Number(suffix);
}

export function isValidPrefixedInvoiceNumber(
  invoiceNumber: string,
  prefix: string,
  year: number,
): boolean {
  return parsePrefixedInvoiceNumber(invoiceNumber, prefix, year) !== null;
}

export function nextPrefixedInvoiceNumber(
  existingNumbers: string[],
  prefix: string,
  year: number,
  strategy: InvoiceNumberingStrategy = "sequential",
): string {
  if (strategy === "from_last") {
    const suffixes = existingNumbers
      .map((number) => parsePrefixedInvoiceNumber(number, prefix, year))
      .filter((suffix): suffix is number => suffix !== null);

    const nextSuffix =
      suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1;
    return buildPrefixedInvoiceNumber(prefix, year, nextSuffix);
  }

  return buildPrefixedInvoiceNumber(
    prefix,
    year,
    existingNumbers.length + 1,
  );
}

export function previewNextPrefixedInvoiceNumbers(
  existingNumbers: string[],
  prefix: string,
  year: number,
  issuedNumber: string,
): { sequential: string; fromLast: string } {
  const withIssued = [...existingNumbers, issuedNumber];

  return {
    sequential: nextPrefixedInvoiceNumber(withIssued, prefix, year, "sequential"),
    fromLast: nextPrefixedInvoiceNumber(withIssued, prefix, year, "from_last"),
  };
}

export function isValidAnyInvoiceNumber(
  invoiceNumber: string,
  year: number,
): boolean {
  if (isValidInvoiceNumber(invoiceNumber, year)) {
    return true;
  }

  const yearText = String(year);
  const yearIndex = invoiceNumber.indexOf(yearText);
  if (yearIndex < 1) {
    return false;
  }

  const prefix = invoiceNumber.slice(0, yearIndex);
  const suffix = invoiceNumber.slice(yearIndex + yearText.length);
  return (
    INVOICE_PREFIX_RE.test(prefix) &&
    /^\d{3,}$/.test(suffix)
  );
}

export function nextInvoiceNumber(
  existingNumbers: string[],
  year: number,
  strategy: InvoiceNumberingStrategy = "sequential",
): string {
  const prefix = String(year);
  const sameYear = existingNumbers.filter((number) =>
    number.startsWith(prefix),
  );

  if (sameYear.length === 0) {
    return `${year}001`;
  }

  if (strategy === "from_last") {
    const maxSuffix = Math.max(
      ...sameYear.map((number) => Number(number.slice(prefix.length))),
    );
    return `${year}${String(maxSuffix + 1).padStart(3, "0")}`;
  }

  return `${year}${String(sameYear.length + 1).padStart(3, "0")}`;
}

export function previewNextInvoiceNumbers(
  existingNumbers: string[],
  year: number,
  issuedNumber: string,
): { sequential: string; fromLast: string } {
  const withIssued = [...existingNumbers, issuedNumber];

  return {
    sequential: nextInvoiceNumber(withIssued, year, "sequential"),
    fromLast: nextInvoiceNumber(withIssued, year, "from_last"),
  };
}

export function invoiceNumberExists(
  existingNumbers: string[],
  invoiceNumber: string,
): boolean {
  return existingNumbers.includes(invoiceNumber);
}

export function isValidInvoiceNumber(
  invoiceNumber: string,
  year: number,
): boolean {
  const prefix = String(year);
  if (!invoiceNumber.startsWith(prefix)) {
    return false;
  }

  const suffix = invoiceNumber.slice(prefix.length);
  return /^\d{3,}$/.test(suffix);
}
