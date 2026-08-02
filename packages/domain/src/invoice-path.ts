export function invoiceRecipientCode(clientName: string): string {
  return clientName.trim().toUpperCase().replace(/\s+/g, "");
}

/** Keep casing; replace quotes/path separators so Content-Disposition and zip paths stay valid. */
function sanitizeFilenameSegment(value: string): string {
  return value.replace(/["/\\]/g, "_");
}

export function invoiceFilename(input: {
  invoiceNumber: string;
  periodEnd: string;
  senderName: string;
  clientName: string;
}): string {
  const [year, month, day] = input.periodEnd.split("-");
  const datePart = `${day}_${month}_${year!.slice(2)}`;
  const senderPart = sanitizeFilenameSegment(input.senderName.replace(/\s+/g, "_"));
  const clientPart = sanitizeFilenameSegment(input.clientName);
  return `${input.invoiceNumber}_${datePart}_Invoice_${senderPart}_${clientPart}.pdf`;
}

/** Relative path under an archive / Outgoing root: `{RECIPIENT}/{year}/{filename}.pdf`. */
export function invoiceExportPath(input: {
  clientName: string;
  invoiceNumber: string;
  periodEnd: string;
  senderName: string;
}): string {
  const recipientCode = invoiceRecipientCode(input.clientName);
  const year = input.periodEnd.slice(0, 4);
  const filename = invoiceFilename(input);
  return `${recipientCode}/${year}/${filename}`;
}
