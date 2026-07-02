export function nextInvoiceNumber(
  existingNumbers: string[],
  year: number,
): string {
  const prefix = String(year);
  const sameYear = existingNumbers.filter((number) =>
    number.startsWith(prefix),
  );

  if (sameYear.length === 0) {
    return `${year}001`;
  }

  return `${year}${String(sameYear.length + 1).padStart(3, "0")}`;
}
