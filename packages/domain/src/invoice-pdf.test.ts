import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import { bandaoInvoiceFixture } from "./invoice-pdf-fixture.js";
import {
  generateInvoicePdf,
} from "./invoice-pdf.js";

async function extractPdfText(pdf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: pdf });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

function normalizeLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const bandaoFixture = bandaoInvoiceFixture;
describe("generateInvoicePdf layout", () => {
  it("matches the Python invoice two-column address block on shared rows", async () => {
    const lines = normalizeLines(
      await extractPdfText(await generateInvoicePdf(bandaoFixture)),
    );

    expect(lines).toContain("Absender: Empfänger:");
    expect(lines).toContain("Hannes Duve BANDAO Guidance GmbH");
    expect(lines).toContain("Am Deichfleet 116 Schloßbergstraße 1");
    expect(lines).toContain("28357 Bremen 82319 Starnberg");
    expect(lines).toContain("Steuernummer: 06044/47008");
  });

  it("omits the §19 UStG text when Kleinunternehmerregelung is not used", async () => {
    const lines = normalizeLines(
      await extractPdfText(
        await generateInvoicePdf({
          ...bandaoFixture,
          usesSmallBusinessRule: false,
        }),
      ),
    );

    expect(
      lines.some((line) => line.startsWith("Gemäß § 19 UStG")),
    ).toBe(false);
  });

  it("keeps payment terms and §19 UStG text on single lines like the Python PDF", async () => {
    const lines = normalizeLines(
      await extractPdfText(await generateInvoicePdf(bandaoFixture)),
    );

    expect(lines).toContain(
      "Zahlungsbedingungen: Zahlbar innerhalb von 14 Tagen ohne Abzug.",
    );
    expect(lines).toContain(
      "Gemäß § 19 UStG enthält der ausgewiesene Betrag keine Umsatzsteuer.",
    );
  });

  it("uses the Python section order and table header row", async () => {
    const lines = normalizeLines(
      await extractPdfText(await generateInvoicePdf(bandaoFixture)),
    );

    const titleIdx = lines.indexOf("Rechnung / Invoice");
    const tableIdx = lines.indexOf(
      "Datum Beschreibung Dauer (Min) Betrag (EUR)",
    );
    const ustgIdx = lines.findIndex((line) => line.startsWith("Gemäß § 19 UStG"));

    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(tableIdx).toBeGreaterThan(titleIdx);
    expect(ustgIdx).toBeGreaterThan(tableIdx);
    expect(lines[tableIdx + 1]).toBe("01.06.2026 Development Call 75 75.00");
    expect(lines).toContain("Gesamtbetrag Brutto: 204.00 EUR");
    expect(lines).toContain("Gesamtdauer: 3.4 Std.");
  });
});
