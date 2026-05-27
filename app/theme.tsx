import { useTranslation } from "react-i18next";

import { SettingsStubScreen } from "@/components/settings/SettingsStubScreen";

export default function ThemeScreen() {
  const { t } = useTranslation();
  return (
    <SettingsStubScreen
      title={t("settings.theme.title")}
      description={t("settings.theme.description")}
    />
  );
}
