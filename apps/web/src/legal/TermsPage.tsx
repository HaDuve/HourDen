import { useTranslation } from "react-i18next";
import { LegalDocumentLayout, LegalSection } from "./LegalDocumentLayout.js";

const sectionKeys = ["operator", "service", "use", "liability", "changes"] as const;

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <LegalDocumentLayout
      title={t("legal.terms.title")}
      notice={t("legal.terms.placeholderNotice")}
    >
      {sectionKeys.map((key) => (
        <LegalSection
          key={key}
          heading={t(`legal.terms.sections.${key}`)}
          body={t(`legal.terms.sections.${key}Body`)}
        />
      ))}
    </LegalDocumentLayout>
  );
}
