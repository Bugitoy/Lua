// Expo loads .env automatically; use EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for Maps SDK on Android.
const fs = require("fs");
const path = require("path");

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, "app.json"), "utf8"));

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
        },
      },
    },
    plugins: [...appJson.expo.plugins],
  },
};
