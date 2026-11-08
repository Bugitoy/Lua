// Expo loads .env automatically; use EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for Maps SDK on Android.
const fs = require("fs");
const path = require("path");

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, "app.json"), "utf8"));

// The invite site (see web/), e.g. "lua-friends.vercel.app". With it set,
// Android opens https://<host>/friend/… links straight in Lua; the site's
// .well-known/assetlinks.json is what lets Android verify that.
const inviteHost = (process.env.EXPO_PUBLIC_INVITE_HOST ?? "").trim();
const inviteIntentFilters = inviteHost
  ? [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: inviteHost, pathPrefix: "/friend" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ]
  : [];

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      intentFilters: [...(appJson.expo.android.intentFilters ?? []), ...inviteIntentFilters],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
        },
      },
    },
    plugins: [...appJson.expo.plugins],
  },
};
