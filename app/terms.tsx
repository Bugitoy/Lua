import { useTranslation } from "react-i18next";

import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";

type LegalSection = { title: string; body: string };

export default function TermsScreen() {
  const { t } = useTranslation();
  const sections = t("legal.terms.sections", {
    returnObjects: true,
  }) as LegalSection[];
  const intro = t("legal.terms.intro", { returnObjects: true }) as string[];

  return (
    <LegalDocumentScreen
      title={t("legal.terms.title")}
      lastUpdated={t("legal.terms.effectiveDate")}
      intro={Array.isArray(intro) ? intro : undefined}
      sections={Array.isArray(sections) ? sections : []}
    />
  );
}
