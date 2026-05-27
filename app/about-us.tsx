import { useTranslation } from "react-i18next";

import { SettingsStubScreen } from "@/components/settings/SettingsStubScreen";

export default function AboutUsScreen() {
  const { t } = useTranslation();
  return (
    <SettingsStubScreen
      title={t("settings.aboutUs.title")}
      description={t("settings.aboutUs.description")}
    />
  );
}
