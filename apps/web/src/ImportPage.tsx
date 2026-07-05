import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  errorBannerClass,
  fieldLabelClass,
  infoPanelClass,
  inputClass,
  metaTextClass,
  pageTitleClass,
  pageSubtitleClass,
  primaryButtonClass,
} from "./layout/ui-classes.js";

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
    } catch {
      setError(t("import.failed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl bg-background px-8 py-8">
      <h1 className={`mb-2 ${pageTitleClass}`}>{t("import.title")}</h1>
      <p className={`mb-6 ${pageSubtitleClass}`}>{t("import.subtitle")}</p>

      <div className="mb-6 space-y-4">
        <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
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
            className={inputClass}
          />
        </label>

        {selectedFiles.length > 0 ? (
          <ul className={metaTextClass}>
            {selectedFiles.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={importing || selectedFiles.length === 0}
          className={primaryButtonClass}
        >
          {importing ? t("import.importing") : t("import.importAction")}
        </button>
      </div>

      {error ? (
        <p className={`mb-4 ${errorBannerClass}`} role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className={infoPanelClass}>
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
