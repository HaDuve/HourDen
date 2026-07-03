export function invoiceRecipientCode(clientName: string): string {
  return clientName.trim().toUpperCase().replace(/\s+/g, "");
}

export function invoiceFilename(
  invoiceNumber: string,
  periodEnd: string,
  recipientCode: string,
): string {
  const [year, month, day] = periodEnd.split("-");
  const datePart = `${day}_${month}_${year!.slice(2)}`;
  return `${invoiceNumber}_${datePart}_Invoice_Hannes_Duve_${recipientCode}.pdf`;
}

export function invoiceExportPath(input: {
  clientName: string;
  invoiceNumber: string;
  periodEnd: string;
}): string {
  const recipientCode = invoiceRecipientCode(input.clientName);
  const year = input.periodEnd.slice(0, 4);
  const filename = invoiceFilename(
    input.invoiceNumber,
    input.periodEnd,
    recipientCode,
  );
  return `${recipientCode}/${year}/${filename}`;
}
