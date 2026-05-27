import { useTranslation } from "react-i18next";

import { SettingsStubScreen } from "@/components/settings/SettingsStubScreen";

export default function HelpCenterScreen() {
  const { t } = useTranslation();
  return (
    <SettingsStubScreen
      title={t("settings.helpCenter.title")}
      description={t("settings.helpCenter.description")}
    />
  );
}
