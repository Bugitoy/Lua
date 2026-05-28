import { useTranslation } from "react-i18next";

import { HelpCenterScreen } from "@/components/help/HelpCenterScreen";

type HelpSection = { title: string; faqs: { q: string; a: string }[] };

export default function HelpCenterRoute() {
  const { t } = useTranslation();
  const sections = t("helpCenter.sections", {
    returnObjects: true,
  }) as HelpSection[];
  const sectionKeys = t("helpCenter.sectionKeys", {
    returnObjects: true,
  }) as string[];

  return (
    <HelpCenterScreen
      title={t("helpCenter.title")}
      welcome={t("helpCenter.welcome")}
      sections={Array.isArray(sections) ? sections : []}
      sectionKeys={Array.isArray(sectionKeys) ? sectionKeys : []}
      supportTitle={t("helpCenter.support.title")}
      supportBody={t("helpCenter.support.body")}
      contactLabel={t("helpCenter.support.contactLabel")}
      email={t("helpCenter.support.email")}
    />
  );
}
