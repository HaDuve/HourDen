import PDFDocument from "pdfkit";

export type InvoiceRecipient = {
  legalName: string;
  addressLine1: string;
  addressLine2: string;
};

export type InvoiceLine = {
  date: string;
  description: string;
  durationMinutes: number;
  amount: number;
};

export type InvoiceOperator = {
  name: string;
  street: string;
  city: string;
  taxNumber: string;
  email: string;
  phone: string;
  bankName: string;
  iban: string;
  bic: string;
};

export type GenerateInvoicePdfInput = {
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  recipient: InvoiceRecipient;
  lines: InvoiceLine[];
  operator: InvoiceOperator;
};

const MM = 72 / 25.4;

function mm(value: number): number {
  return value * MM;
}

function formatInvoiceDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

export function formatInvoiceAmountSpaced(amount: number): string {
  const [whole, fraction] = amount.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}.${fraction} EUR`;
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function setFont(
  doc: PdfDoc,
  size: number,
  bold = false,
): void {
  doc.fontSize(size).font(bold ? "Helvetica-Bold" : "Helvetica");
}

function drawFullLine(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  options: { bold?: boolean; fontSize: number; align?: "left" | "center" | "right" },
): number {
  setFont(doc, options.fontSize, options.bold);
  doc.text(text, x, y, {
    width,
    align: options.align ?? "left",
    lineBreak: false,
  });
  return y + height;
}

function drawHalfRow(
  doc: PdfDoc,
  x: number,
  y: number,
  halfWidth: number,
  height: number,
  left: string,
  right: string,
  fontSize: number,
): number {
  setFont(doc, fontSize);
  doc.text(left, x, y, {
    width: halfWidth,
    align: "left",
    lineBreak: false,
  });
  doc.text(right, x + halfWidth, y, {
    width: halfWidth,
    align: "right",
    lineBreak: false,
  });
  return y + height;
}

function drawTableCell(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  bold = false,
): void {
  doc.rect(x, y, width, height).stroke();
  setFont(doc, 9, bold);
  const textY = y + (height - doc.currentLineHeight()) / 2;
  doc.text(text, x, textY, {
    width,
    align: "center",
    lineBreak: false,
  });
}

export function generateInvoicePdf(input: GenerateInvoicePdfInput): Promise<Buffer> {
  const totalAmount = input.lines.reduce((sum, line) => sum + line.amount, 0);
  const totalDurationMinutes = input.lines.reduce(
    (sum, line) => sum + line.durationMinutes,
    0,
  );
  const totalHours = totalDurationMinutes / 60;

  const margin = mm(10);
  const contentWidth = mm(190);
  const halfWidth = mm(95);
  const tableColumns = [mm(30), mm(60), mm(30), mm(30)];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: margin,
        bottom: mm(15),
        left: margin,
        right: margin,
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = margin;

    y = drawFullLine(doc, margin, y, contentWidth, mm(10), "Rechnung / Invoice", {
      bold: true,
      fontSize: 16,
      align: "center",
    });
    y += mm(5);

    y = drawHalfRow(
      doc,
      margin,
      y,
      halfWidth,
      mm(8),
      "Absender:",
      "Empfänger:",
      10,
    );

    y = drawHalfRow(
      doc,
      margin,
      y,
      halfWidth,
      mm(5),
      input.operator.name,
      input.recipient.legalName,
      9,
    );
    y = drawHalfRow(
      doc,
      margin,
      y,
      halfWidth,
      mm(5),
      input.operator.street,
      input.recipient.addressLine1,
      9,
    );
    y = drawHalfRow(
      doc,
      margin,
      y,
      halfWidth,
      mm(5),
      input.operator.city,
      input.recipient.addressLine2,
      9,
    );

    y = drawFullLine(
      doc,
      margin,
      y,
      halfWidth,
      mm(5),
      `Steuernummer: ${input.operator.taxNumber}`,
      { fontSize: 9 },
    );
    y += mm(3);

    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Rechnungsnummer: ${input.invoiceNumber}`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Rechnungsdatum: ${formatInvoiceDate(input.invoiceDate)}`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Leistungszeitraum: ${formatInvoiceDate(input.periodStart)} - ${formatInvoiceDate(input.periodEnd)}`,
      { fontSize: 10 },
    );
    y += mm(3);

    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(8),
      `Gesamtbetrag Brutto: ${formatInvoiceAmountSpaced(totalAmount)}`,
      { bold: true, fontSize: 12 },
    );
    y += mm(5);

    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(6),
      "Zahlungsinformationen:",
      { bold: true, fontSize: 11 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Bankname: ${input.operator.bankName}`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `IBAN: ${input.operator.iban}`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `BIC: ${input.operator.bic}`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Fälligkeitsdatum: ${formatInvoiceDate(input.dueDate)}`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      "Zahlungsbedingungen: Zahlbar innerhalb von 14 Tagen ohne Abzug.",
      { fontSize: 10 },
    );
    y += mm(3);

    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Mail: ${input.operator.email}`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Tel.: ${input.operator.phone}`,
      { fontSize: 10 },
    );
    y += mm(5);

    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(6),
      "Leistungsnachweis",
      { bold: true, fontSize: 11 },
    );
    y += mm(2);

    let tableX = margin;
    const headerLabels = ["Datum", "Beschreibung", "Dauer (Min)", "Betrag (EUR)"];
    for (let i = 0; i < headerLabels.length; i++) {
      drawTableCell(
        doc,
        tableX,
        y,
        tableColumns[i]!,
        mm(6),
        headerLabels[i]!,
        true,
      );
      tableX += tableColumns[i]!;
    }
    y += mm(6);

    for (const line of input.lines) {
      tableX = margin;
      const cells = [
        formatInvoiceDate(line.date),
        line.description,
        String(line.durationMinutes),
        line.amount.toFixed(2),
      ];
      for (let i = 0; i < cells.length; i++) {
        drawTableCell(doc, tableX, y, tableColumns[i]!, mm(8), cells[i]!);
        tableX += tableColumns[i]!;
      }
      y += mm(8);
    }

    y += mm(3);

    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Gesamtdauer: ${totalHours.toFixed(1)} Std.`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Gesamtbetrag Netto: ${formatInvoiceAmountSpaced(totalAmount)}`,
      { fontSize: 10 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      `Gesamtbetrag Brutto: ${formatInvoiceAmountSpaced(totalAmount)}`,
      { fontSize: 10 },
    );
    y += mm(2);

    drawFullLine(
      doc,
      margin,
      y,
      contentWidth,
      mm(5),
      "Gemäß § 19 UStG enthält der ausgewiesene Betrag keine Umsatzsteuer.",
      { fontSize: 9 },
    );

    doc.end();
  });
}

export const DEFAULT_INVOICE_OPERATOR: InvoiceOperator = {
  name: "Hannes Duve",
  street: "Am Deichfleet 116",
  city: "28357 Bremen",
  taxNumber: "06044/47008",
  email: "hannes.duve@outlook.com",
  phone: "+49 15734521445",
  bankName: "Deutsche Kreditbank",
  iban: "DE74 120300001060924758",
  bic: "BYLADEM1001",
};
