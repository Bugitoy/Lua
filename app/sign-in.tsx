import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MySpriteAvatar } from "@/components/profile/SpriteAvatar";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useKeyboardAwareScroll } from "@/hooks/useKeyboardAwareScroll";
import {
  isValidUsername,
  signIn,
  signUp,
  usernameFromHandle,
  type AccountError,
} from "@/lib/account";
import { showAppNotice } from "@/lib/appAlert";
import { DEFAULT_PROFILE, getProfile } from "@/lib/profileStore";

type Mode = "create" | "signIn";
/** What the form can complain about: the server's errors plus a few it checks itself. */
type FormError = AccountError | "emptyName" | "missingPassword";

const MIN_PASSWORD = 8;

/** The phone's name and handle, unless they're still the placeholders. */
function startingNames() {
  const profile = getProfile();
  return {
    displayName: profile.displayName === DEFAULT_PROFILE.displayName ? "" : profile.displayName,
    username: profile.handle === DEFAULT_PROFILE.handle ? "" : usernameFromHandle(profile.handle),
  };
}

function Field({
  label,
  hint,
  prefix,
  trailing,
  onReveal,
  ...input
}: TextInputProps & {
  label: string;
  hint?: string;
  prefix?: string;
  trailing?: ReactNode;
  /** Called on focus with the whole field, label to hint, so it can be kept above the keyboard. */
  onReveal?: (field: View | null) => void;
}) {
  const fieldRef = useRef<View>(null);
  return (
    <View ref={fieldRef} className="mb-4">
      <Text className="mb-1.5 text-xs text-neutral-500" style={{ fontFamily: Pixelify.medium }}>
        {label}
      </Text>
      <View className="flex-row items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4">
        {prefix ? (
          <Text className="text-base text-neutral-400" style={{ fontFamily: Pixelify.regular }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          placeholderTextColor="#a3a3a3"
          className="flex-1 py-3 text-base text-neutral-900"
          style={{ fontFamily: Pixelify.regular }}
          {...input}
          onFocus={(e) => {
            onReveal?.(fieldRef.current);
            input.onFocus?.(e);
          }}
        />
        {trailing}
      </View>
      {hint ? (
        <Text className="mt-1.5 text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("create");
  const [names] = useState(startingNames);
  const [displayName, setDisplayName] = useState(names.displayName);
  const [username, setUsername] = useState(names.username);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const { scrollProps, keyboardHeight, reveal } = useKeyboardAwareScroll();

  const fail = useCallback(
    (error: FormError) =>
      showAppNotice(
        {
          icon: "alert-circle-outline",
          tone: "danger",
          title: t(mode === "create" ? "account.errors.createTitle" : "account.errors.signInTitle"),
          message: t(`account.errors.${error}`, { count: MIN_PASSWORD }),
        },
        t("common.ok"),
      ),
    [mode, t],
  );

  const onSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    const cleanUsername = usernameFromHandle(username);

    if (mode === "create") {
      if (!displayName.trim()) return fail("emptyName");
      if (!isValidUsername(cleanUsername)) return fail("invalidUsername");
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return fail("invalidEmail");
    if (mode === "create" && password.length < MIN_PASSWORD) return fail("weakPassword");
    if (!password) return fail("missingPassword");

    setBusy(true);
    try {
      if (mode === "signIn") {
        const result = await signIn(trimmedEmail, password);
        if (!result.ok) return fail(result.error);
        router.back();
        return;
      }

      const result = await signUp({
        email: trimmedEmail,
        password,
        username: cleanUsername,
        displayName: displayName.trim(),
      });
      if (!result.ok) return fail(result.error);
      if ("needsConfirmation" in result) {
        setMode("signIn");
        showAppNotice(
          {
            icon: "mail-outline",
            tone: "primary",
            title: t("account.confirmEmailTitle"),
            message: t("account.confirmEmailMessage", { email: trimmedEmail }),
          },
          t("common.ok"),
        );
        return;
      }
      router.back();
    } finally {
      setBusy(false);
    }
  }, [displayName, email, fail, mode, password, t, username]);

  const creating = mode === "create";

  return (
    <View className="flex-1 bg-neutral-100">
      <StatusBar style="dark" />
      <ScrollView
        {...scrollProps}
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          // Room to scroll the lower fields up above the keyboard.
          paddingBottom: insets.bottom + 28 + keyboardHeight,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          className="mb-4 flex-row items-center gap-1 self-start active:opacity-70"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#525252" />
          <Text className="text-base text-neutral-600" style={{ fontFamily: Pixelify.medium }}>
            {t("common.back")}
          </Text>
        </Pressable>

        <View className="mb-5 items-center">
          <MySpriteAvatar size={80} ringWidth={3} ringColor={LUA_GREEN} />
          <Text className="mt-3 text-2xl text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
            {t(creating ? "account.createTitle" : "account.signInTitle")}
          </Text>
          <Text
            className="mt-1 text-center text-sm text-neutral-500"
            style={{ fontFamily: Pixelify.regular }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t("account.why")}
          </Text>
        </View>

        <View
          className="rounded-2xl bg-white p-5"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View className="mb-5 flex-row rounded-xl bg-neutral-100 p-1">
            {(["create", "signIn"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                disabled={busy}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                className="flex-1 items-center rounded-lg py-2"
                style={mode === m ? { backgroundColor: "#fff" } : undefined}
              >
                <Text
                  className={mode === m ? "text-sm text-neutral-900" : "text-sm text-neutral-500"}
                  style={{ fontFamily: Pixelify.semibold }}
                >
                  {t(m === "create" ? "account.createTab" : "account.signInTab")}
                </Text>
              </Pressable>
            ))}
          </View>

          {creating ? (
            <>
              <Field
                onReveal={reveal}
                label={t("manageProfile.displayNameLabel")}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t("manageProfile.displayNamePlaceholder")}
                autoCapitalize="words"
                maxLength={40}
              />
              <Field
                onReveal={reveal}
                label={t("account.usernameLabel")}
                hint={t("account.usernameHint")}
                prefix="@"
                value={username}
                onChangeText={(text) => setUsername(usernameFromHandle(text))}
                placeholder={t("account.usernamePlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
            </>
          ) : null}

          <Field
            onReveal={reveal}
            label={t("account.emailLabel")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("account.emailPlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Field
            onReveal={reveal}
            label={t("account.passwordLabel")}
            hint={creating ? t("account.passwordHint", { count: MIN_PASSWORD }) : undefined}
            value={password}
            onChangeText={setPassword}
            placeholder={t("account.passwordPlaceholder")}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={creating ? "new-password" : "current-password"}
            textContentType={creating ? "newPassword" : "password"}
            trailing={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t(showPassword ? "account.hidePassword" : "account.showPassword")}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#737373" />
              </Pressable>
            }
          />

          <Pressable
            onPress={onSubmit}
            disabled={busy}
            className="mt-1 items-center rounded-xl py-3.5 active:opacity-80"
            style={{ backgroundColor: LUA_GREEN, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base text-white" style={{ fontFamily: Pixelify.bold }}>
                {t(creating ? "account.createButton" : "account.signInButton")}
              </Text>
            )}
          </Pressable>

          {creating ? (
            <Text
              className="mt-4 text-center text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.regular }}
            >
              {t("account.agreeBefore")}
              <Text className="text-neutral-700 underline" onPress={() => router.push("/terms")}>
                {t("profile.rows.termsConditions")}
              </Text>
              {t("account.agreeBetween")}
              <Text className="text-neutral-700 underline" onPress={() => router.push("/privacy-policy")}>
                {t("profile.rows.privacyPolicy")}
              </Text>
              {t("account.agreeAfter")}
            </Text>
          ) : null}
        </View>

        <Text
          className="mt-4 text-center text-xs text-neutral-500"
          style={{ fontFamily: Pixelify.regular }}
        >
          {t("account.keepsData")}
        </Text>
      </ScrollView>
    </View>
  );
}
