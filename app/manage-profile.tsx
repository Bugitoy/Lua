import { useTranslation } from "react-i18next";

import { SettingsStubScreen } from "@/components/settings/SettingsStubScreen";

export default function ManageProfileScreen() {
  const { t } = useTranslation();
  return (
    <SettingsStubScreen
      title={t("settings.manageProfile.title")}
      description={t("settings.manageProfile.description")}
    />
  );
}
