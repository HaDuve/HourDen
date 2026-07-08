export type InvoiceNumberingStrategy = "sequential" | "from_last";
export type InvoiceNumberFormat = "year_first" | "sequence_first";

const INVOICE_PREFIX_RE = /^[A-Z0-9]{1,6}$/;
const SEQUENCE_RE = /^\d{3,}$/;

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

function parseSequencePart(value: string): number | null {
  if (!SEQUENCE_RE.test(value)) {
    return null;
  }

  return Number(value);
}

function parseYearFirstPlain(invoiceNumber: string, year: number): number | null {
  const yearText = String(year);
  const compactMatch = invoiceNumber.match(new RegExp(`^${yearText}(\\d{3,})$`));
  if (compactMatch) {
    return parseSequencePart(compactMatch[1]!);
  }

  const hyphenMatch = invoiceNumber.match(new RegExp(`^${yearText}-(\\d{3,})$`));
  if (hyphenMatch) {
    return parseSequencePart(hyphenMatch[1]!);
  }

  return null;
}

function parseSeqFirstPlain(invoiceNumber: string, year: number): number | null {
  const yearText = String(year);
  const suffix = `-${yearText}`;

  if (!invoiceNumber.endsWith(suffix)) {
    return null;
  }

  return parseSequencePart(invoiceNumber.slice(0, -suffix.length));
}

function parsePlainInvoiceNumber(
  invoiceNumber: string,
  year: number,
): number | null {
  return (
    parseYearFirstPlain(invoiceNumber, year) ??
    parseSeqFirstPlain(invoiceNumber, year)
  );
}

export function buildPrefixedInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number,
): string {
  return `${prefix}${year}${formatInvoiceSuffix(sequence)}`;
}

export function buildPrefixedSeqFirstInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number,
): string {
  return `${prefix}-${formatInvoiceSuffix(sequence)}-${year}`;
}

export function buildPlainSeqFirstInvoiceNumber(
  year: number,
  sequence: number,
): string {
  return `${formatInvoiceSuffix(sequence)}-${year}`;
}

function buildPrefixedNumberForFormat(
  prefix: string,
  year: number,
  sequence: number,
  format: InvoiceNumberFormat,
): string {
  if (format === "sequence_first") {
    return buildPrefixedSeqFirstInvoiceNumber(prefix, year, sequence);
  }

  return buildPrefixedInvoiceNumber(prefix, year, sequence);
}

function buildPlainNumberForFormat(
  year: number,
  sequence: number,
  format: InvoiceNumberFormat,
): string {
  if (format === "sequence_first") {
    return buildPlainSeqFirstInvoiceNumber(year, sequence);
  }

  return `${year}${formatInvoiceSuffix(sequence)}`;
}

export function parsePrefixedInvoiceNumber(
  invoiceNumber: string,
  prefix: string,
  year: number,
): number | null {
  const yearText = String(year);
  const compactPrefix = `${prefix}${yearText}`;

  if (invoiceNumber.startsWith(compactPrefix)) {
    return parseSequencePart(invoiceNumber.slice(compactPrefix.length));
  }

  const yearFirstHyphen = `${prefix}-${yearText}-`;
  if (invoiceNumber.startsWith(yearFirstHyphen)) {
    return parseSequencePart(invoiceNumber.slice(yearFirstHyphen.length));
  }

  const seqFirstSuffix = `-${yearText}`;
  if (
    invoiceNumber.startsWith(`${prefix}-`) &&
    invoiceNumber.endsWith(seqFirstSuffix)
  ) {
    const sequencePart = invoiceNumber.slice(
      prefix.length + 1,
      -seqFirstSuffix.length,
    );
    return parseSequencePart(sequencePart);
  }

  return null;
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
  format: InvoiceNumberFormat = "year_first",
): string {
  const suffixes = existingNumbers
    .map((number) => parsePrefixedInvoiceNumber(number, prefix, year))
    .filter((suffix): suffix is number => suffix !== null);

  if (strategy === "from_last") {
    const nextSuffix = suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1;
    return buildPrefixedNumberForFormat(prefix, year, nextSuffix, format);
  }

  return buildPrefixedNumberForFormat(
    prefix,
    year,
    existingNumbers.length + 1,
    format,
  );
}

export function previewNextPrefixedInvoiceNumbers(
  existingNumbers: string[],
  prefix: string,
  year: number,
  issuedNumber: string,
  format: InvoiceNumberFormat = "year_first",
): { sequential: string; fromLast: string } {
  const withIssued = [...existingNumbers, issuedNumber];

  return {
    sequential: nextPrefixedInvoiceNumber(withIssued, prefix, year, "sequential", format),
    fromLast: nextPrefixedInvoiceNumber(withIssued, prefix, year, "from_last", format),
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
  const yearFirstHyphen = new RegExp(
    `^([A-Z0-9]{1,6})-${yearText}-(\\d{3,})$`,
  );
  const yearFirstMatch = invoiceNumber.match(yearFirstHyphen);
  if (yearFirstMatch) {
    return INVOICE_PREFIX_RE.test(yearFirstMatch[1]!);
  }

  const seqFirstHyphen = new RegExp(
    `^([A-Z0-9]{1,6})-(\\d{3,})-${yearText}$`,
  );
  const seqFirstMatch = invoiceNumber.match(seqFirstHyphen);
  if (seqFirstMatch) {
    return INVOICE_PREFIX_RE.test(seqFirstMatch[1]!);
  }

  const yearIndex = invoiceNumber.indexOf(yearText);
  if (yearIndex < 1 || invoiceNumber.includes("-")) {
    return false;
  }

  const prefix = invoiceNumber.slice(0, yearIndex);
  const suffix = invoiceNumber.slice(yearIndex + yearText.length);
  return INVOICE_PREFIX_RE.test(prefix) && SEQUENCE_RE.test(suffix);
}

export function nextInvoiceNumber(
  existingNumbers: string[],
  year: number,
  strategy: InvoiceNumberingStrategy = "sequential",
  format: InvoiceNumberFormat = "year_first",
): string {
  const suffixes = existingNumbers
    .map((number) => parsePlainInvoiceNumber(number, year))
    .filter((suffix): suffix is number => suffix !== null);

  if (suffixes.length === 0) {
    return buildPlainNumberForFormat(year, 1, format);
  }

  if (strategy === "from_last") {
    const maxSuffix = Math.max(...suffixes);
    return buildPlainNumberForFormat(year, maxSuffix + 1, format);
  }

  return buildPlainNumberForFormat(year, suffixes.length + 1, format);
}

export function previewNextInvoiceNumbers(
  existingNumbers: string[],
  year: number,
  issuedNumber: string,
  format: InvoiceNumberFormat = "year_first",
): { sequential: string; fromLast: string } {
  const withIssued = [...existingNumbers, issuedNumber];

  return {
    sequential: nextInvoiceNumber(withIssued, year, "sequential", format),
    fromLast: nextInvoiceNumber(withIssued, year, "from_last", format),
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
  return parsePlainInvoiceNumber(invoiceNumber, year) !== null;
}
