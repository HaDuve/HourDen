export type InvoiceNumberingStrategy = "sequential" | "from_last";

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
