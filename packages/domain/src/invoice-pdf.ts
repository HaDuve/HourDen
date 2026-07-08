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
  usesSmallBusinessRule?: boolean;
};

const MM = 72 / 25.4;

function mm(value: number): number {
  return value * MM;
}

const TABLE_CELL_PADDING = mm(1.5);

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
  align: "left" | "center" | "right" = "center",
): void {
  doc.rect(x, y, width, height).stroke();
  setFont(doc, 9, bold);
  const textWidth = width - TABLE_CELL_PADDING * 2;
  const textHeight = doc.heightOfString(text, { width: textWidth });
  const textY = y + Math.max(TABLE_CELL_PADDING, (height - textHeight) / 2);
  doc.text(text, x + TABLE_CELL_PADDING, textY, {
    width: textWidth,
    align,
    lineBreak: true,
  });
}

const SMALL_BUSINESS_RULE_TEXT =
  "Gemäß § 19 UStG enthält der ausgewiesene Betrag keine Umsatzsteuer.";

function measureTableRowHeight(
  doc: PdfDoc,
  columns: number[],
  cells: string[],
  minHeight: number,
  bold = false,
): number {
  setFont(doc, 9, bold);
  const heights = cells.map((text, index) =>
    doc.heightOfString(text, {
      width: columns[index]! - TABLE_CELL_PADDING * 2,
    }) +
    TABLE_CELL_PADDING * 2,
  );
  return Math.max(minHeight, ...heights);
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
  const tableColumns = [mm(22), mm(90), mm(22), mm(22)];

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
    y = drawFullLine(
      doc,
      margin,
      y,
      halfWidth,
      mm(5),
      `Mail: ${input.operator.email}`,
      { fontSize: 9 },
    );
    y = drawFullLine(
      doc,
      margin,
      y,
      halfWidth,
      mm(5),
      `Tel.: ${input.operator.phone}`,
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
    const headerHeight = measureTableRowHeight(
      doc,
      tableColumns,
      headerLabels,
      mm(6),
      true,
    );
    for (let i = 0; i < headerLabels.length; i++) {
      drawTableCell(
        doc,
        tableX,
        y,
        tableColumns[i]!,
        headerHeight,
        headerLabels[i]!,
        true,
      );
      tableX += tableColumns[i]!;
    }
    y += headerHeight;

    for (const line of input.lines) {
      tableX = margin;
      const cells = [
        formatInvoiceDate(line.date),
        line.description,
        String(line.durationMinutes),
        line.amount.toFixed(2),
      ];
      const rowHeight = measureTableRowHeight(doc, tableColumns, cells, mm(8));
      for (let i = 0; i < cells.length; i++) {
        drawTableCell(
          doc,
          tableX,
          y,
          tableColumns[i]!,
          rowHeight,
          cells[i]!,
          false,
          i === 1 ? "left" : "center",
        );
        tableX += tableColumns[i]!;
      }
      y += rowHeight;
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

    if (input.usesSmallBusinessRule !== false) {
      drawFullLine(
        doc,
        margin,
        y,
        contentWidth,
        mm(5),
        SMALL_BUSINESS_RULE_TEXT,
        { fontSize: 9 },
      );
    }

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
