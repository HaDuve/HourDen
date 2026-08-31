import { useTranslation } from "react-i18next";
import { LegalDocumentLayout, LegalSection } from "./LegalDocumentLayout.js";

const sectionKeys = [
  "operator",
  "dataCollected",
  "turnstile",
  "processors",
  "rights",
  "contact",
] as const;

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <LegalDocumentLayout
      title={t("legal.privacy.title")}
      notice={t("legal.privacy.placeholderNotice")}
    >
      {sectionKeys.map((key) => (
        <LegalSection
          key={key}
          heading={t(`legal.privacy.sections.${key}`)}
          body={t(`legal.privacy.sections.${key}Body`)}
        />
      ))}
    </LegalDocumentLayout>
  );
}
