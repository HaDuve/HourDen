import { useState } from "react";
import { useTranslation } from "react-i18next";

type ImportSummary = {
  imported: number;
  duplicates: number;
  skippedEmptyClient: number;
};

async function importClockifyFile(file: File): Promise<ImportSummary> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/import/clockify", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Import failed (${res.status})`);
  }

  return res.json() as Promise<ImportSummary>;
}

export default function ImportPage() {
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (selectedFiles.length === 0) {
      return;
    }

    setImporting(true);
    setError(null);
    setSummary(null);

    try {
      const totals: ImportSummary = {
        imported: 0,
        duplicates: 0,
        skippedEmptyClient: 0,
      };

      for (const file of selectedFiles) {
        const result = await importClockifyFile(file);
        totals.imported += result.imported;
        totals.duplicates += result.duplicates;
        totals.skippedEmptyClient += result.skippedEmptyClient;
      }

      setSummary(totals);
    } catch (err) {
      setError(t("import.failed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">{t("import.title")}</h1>
      <p className="mb-6 text-sm text-neutral-600">{t("import.subtitle")}</p>

      <div className="mb-6 space-y-4">
        <label className="flex flex-col gap-2 text-sm text-neutral-700">
          {t("import.fileLabel")}
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            aria-label={t("import.fileLabel")}
            onChange={(event) => {
              setSelectedFiles(Array.from(event.target.files ?? []));
              setSummary(null);
              setError(null);
            }}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>

        {selectedFiles.length > 0 ? (
          <ul className="text-sm text-neutral-600">
            {selectedFiles.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={importing || selectedFiles.length === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {importing ? t("import.importing") : t("import.importAction")}
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          <p>{t("import.importedCount", { count: summary.imported })}</p>
          {summary.duplicates > 0 ? (
            <p>{t("import.skippedDuplicates", { count: summary.duplicates })}</p>
          ) : null}
          {summary.skippedEmptyClient > 0 ? (
            <p>{t("import.skippedEmptyClient", { count: summary.skippedEmptyClient })}</p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
