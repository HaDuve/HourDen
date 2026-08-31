import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  bodyTextClass,
  cardClass,
  metaTextClass,
  pageTitleClass,
} from "../layout/ui-classes.js";

type LegalDocumentLayoutProps = {
  title: string;
  notice: string;
  children: ReactNode;
};

export function LegalDocumentLayout({
  title,
  notice,
  children,
}: LegalDocumentLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className={`mx-auto max-w-2xl p-8 ${cardClass}`}>
        <p className={`mb-6 rounded-md border border-divider bg-surface px-4 py-3 ${metaTextClass}`}>
          {notice}
        </p>
        <h1 className={`mb-8 ${pageTitleClass}`}>{title}</h1>
        <div className={`space-y-6 ${bodyTextClass}`}>{children}</div>
        <p className={`mt-10 ${metaTextClass}`}>
          <Link to="/login" className="underline hover:text-content">
            {t("legal.backToLogin")}
          </Link>
        </p>
      </article>
    </div>
  );
}

type LegalSectionProps = {
  heading: string;
  body: string;
};

export function LegalSection({ heading, body }: LegalSectionProps) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-content">{heading}</h2>
      <p className="text-muted">{body}</p>
    </section>
  );
}
