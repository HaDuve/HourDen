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
    expect(lines).toContain("Mail: hannes.duve@outlook.com");
    expect(lines).toContain("Tel.: +49 15734521445");
  });

  it("places Mail and phone directly under the Invoice Sender block", async () => {
    const lines = normalizeLines(
      await extractPdfText(await generateInvoicePdf(bandaoFixture)),
    );

    const mailIdx = lines.indexOf("Mail: hannes.duve@outlook.com");
    const paymentIdx = lines.indexOf("Zahlungsinformationen:");
    const leistungsIdx = lines.indexOf("Leistungsnachweis");

    expect(mailIdx).toBeGreaterThanOrEqual(0);
    expect(paymentIdx).toBeGreaterThan(mailIdx);
    expect(leistungsIdx).toBeGreaterThan(mailIdx);
    expect(lines.filter((line) => line.startsWith("Mail:"))).toHaveLength(1);
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
    const tableHeaderIdx = lines.findIndex(
      (line) => line.includes("Datum") && line.includes("Beschreibung"),
    );
    const ustgIdx = lines.findIndex((line) => line.startsWith("Gemäß § 19 UStG"));

    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(tableHeaderIdx).toBeGreaterThan(titleIdx);
    expect(ustgIdx).toBeGreaterThan(tableHeaderIdx);
    expect(
      lines.some(
        (line) =>
          line.includes("01.06.2026") && line.includes("Development Call"),
      ),
    ).toBe(true);
    expect(lines).toContain("Gesamtbetrag Brutto: 204.00 EUR");
    expect(lines).toContain("Gesamtdauer: 3.4 Std.");
  });

  it("renders a long line description without clipping", async () => {
    const longDescription =
      "Architecture review and pairing session on authentication migration";
    const lines = normalizeLines(
      await extractPdfText(
        await generateInvoicePdf({
          ...bandaoFixture,
          lines: [
            {
              date: "2026-06-01",
              description: longDescription,
              durationMinutes: 75,
              amount: 75,
            },
          ],
        }),
      ),
    );

    expect(lines.join(" ")).toContain(longDescription);
  });
});
