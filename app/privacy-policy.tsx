import { useTranslation } from "react-i18next";

import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";

type LegalSection = { title: string; body: string };

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();
  const sections = t("legal.privacy.sections", {
    returnObjects: true,
  }) as LegalSection[];
  const intro = t("legal.privacy.intro", { returnObjects: true }) as string[];

  return (
    <LegalDocumentScreen
      title={t("legal.privacy.title")}
      lastUpdated={t("legal.privacy.effectiveDate")}
      intro={Array.isArray(intro) ? intro : undefined}
      sections={Array.isArray(sections) ? sections : []}
    />
  );
}
