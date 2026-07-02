import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import { bandaoInvoiceFixture } from "./invoice-pdf-fixture.js";
import { generateInvoicePdf } from "./invoice-pdf.js";
import { normalizeInvoicePdfText } from "./invoice-pdf-snapshot.js";

const goldenPath = resolve(
  import.meta.dirname,
  "../test/fixtures/invoice-pdf.snapshot.txt",
);

async function extractPdfText(pdf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: pdf });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

describe("invoice PDF text snapshot", () => {
  it("matches the golden layout snapshot for the Bandao fixture", async () => {
    const text = normalizeInvoicePdfText(
      await extractPdfText(await generateInvoicePdf(bandaoInvoiceFixture)),
      { invoiceNumber: bandaoInvoiceFixture.invoiceNumber },
    );

    if (process.env.UPDATE_SNAPSHOT === "1") {
      writeFileSync(goldenPath, text);
    }

    expect(text).toBe(readFileSync(goldenPath, "utf8"));
  });
});
