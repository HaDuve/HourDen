#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

const args = process.argv.slice(2);
const pdfPath = args[0];

if (!pdfPath) {
  console.error(
    "Usage: normalize-invoice-pdf-text.mjs <file.pdf> [--invoice-number N] [--legal-name NAME]",
  );
  process.exit(1);
}

let invoiceNumber;
let legalName;

for (let i = 1; i < args.length; i++) {
  if (args[i] === "--invoice-number") {
    invoiceNumber = args[++i];
  } else if (args[i] === "--legal-name") {
    legalName = args[++i];
  }
}

const parser = new PDFParse({ data: readFileSync(pdfPath) });
const result = await parser.getText();
await parser.destroy();

let text = result.text;
if (invoiceNumber) {
  text = text.replaceAll(invoiceNumber, "<INVOICE_NUMBER>");
}
if (legalName) {
  text = text.replaceAll(legalName, "<LEGAL_NAME>");
}

const normalized =
  text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && !/^-- \d+ of \d+ --$/.test(line))
    .join("\n") + "\n";

process.stdout.write(normalized);
