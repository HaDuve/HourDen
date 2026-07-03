import { ZipArchive } from "archiver";
import type { IssuedInvoiceDetail } from "./db/invoices.js";
import { invoiceExportPath } from "./invoice-path.js";

export async function buildIssuedInvoicesZip(
  invoices: IssuedInvoiceDetail[],
  renderPdf: (invoice: IssuedInvoiceDetail) => Promise<Buffer>,
): Promise<Buffer> {
  const sorted = [...invoices].sort((left, right) =>
    invoiceExportPath(left).localeCompare(invoiceExportPath(right)),
  );

  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    archive.on("error", reject);

    void (async () => {
      try {
        for (const invoice of sorted) {
          const pdf = await renderPdf(invoice);
          archive.append(pdf, { name: invoiceExportPath(invoice) });
        }
        await archive.finalize();
      } catch (error) {
        reject(error);
      }
    })();
  });
}
