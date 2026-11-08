# Lua

Lua is a walking app with a pixel-art companion. You set goals at real places on the map, walk there, and Lua earns XP and stays healthy from your steps and the goals you reach.

- **Map**: live GPS position, goal markers, goals that unlock when you arrive so you can tick them off, and work/study sessions at a goal.
- **Schedule**: add goals for today by searching nearby places. Goals last one day.
- **Lua's health and XP**: steps, the daily step goal and goals you walked to all earn XP. A full day heals Lua, and missed days hurt her.
- **Achievements**: unlock items as XP grows, dress Lua up in the wardrobe, and buy costume skins in the shop.
- **Stats**: weekly averages, a week/month/year calendar, a day-by-day breakdown and a leaderboard.
- **10 languages**: English, German, Spanish, French, Hindi, Italian, Japanese, Korean, Portuguese and Chinese.

Built with Expo (SDK 54), Expo Router, React Native, NativeWind, Skia and react-native-maps.

## Current state

The app runs fully on the phone. Everything is saved locally with AsyncStorage. Accounts are optional: signing in with an email and password (Supabase Auth) gives you a username and friend code, and copies your XP, streak, Lua's outfit and each day's stats to Supabase. Nothing comes back down except your username and display name. Friends aren't built yet, the leaderboard still uses sample players, and buying a costume doesn't charge anything yet.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill it in:

   | Variable | What it's for |
   |---|---|
   | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps on Android (Maps SDK for Android enabled). Restrict it to the package `com.anonymous.Lua`. |
   | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase project. Used for accounts and the `walking-route` function (see below). Without them the app works signed out only. |
   | `EXPO_PUBLIC_DEV_XP_CONTROLS` | `1` shows the dev XP buttons on the Achievements tab outside dev mode. **Set it to `0` (or remove it) for release builds.** |

3. Walking routes (optional). The map and the goal cards show real walking distance, time and path from the Google Routes API, through the Supabase Edge Function in [supabase/functions/walking-route](supabase/functions/walking-route/index.ts). Without it they fall back to a straight-line estimate shown with "~". To set it up:
   - In Google Cloud, enable the **Routes API** and create a separate key restricted to it (no application restriction, since only Supabase uses it).
   - In Supabase, add that key as the Edge Function secret `GOOGLE_ROUTES_API_KEY`.
   - Deploy: `npx supabase login`, then `npx supabase functions deploy walking-route --project-ref <your project ref>`.

4. Accounts. The tables, row level security and sign-up trigger are in [supabase/migrations](supabase/migrations/). To set them up:
   - `npx supabase link --project-ref <your project ref>`, then `npx supabase db push --remote`.
   - Deploy the function that deletes an account: `npx supabase functions deploy delete-account --no-verify-jwt`. It checks the user's token itself.
   - Without an email service, Supabase only sends emails to your own team, so new accounts can't be confirmed. Until you add one (Authentication → Emails → SMTP settings), turn off **Confirm email** under Authentication → Sign In / Providers → Email.

## Running

Lua needs a development build. Maps, Skia, background location and the step counter use native code, so Expo Go isn't enough.

```bash
npx expo run:android   # build and run on an Android device or emulator
npx expo run:ios       # build and run on iOS (macOS only)
npm start              # start the dev server for an existing development build
```

Background location, step counting and goal check-ins need a real phone to test properly.

Changes to `app.json` (permissions, icons, splash) only apply after a fresh native build.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` / `npm run ios` | Build and run the native app |
| `npm run web` | Start the web version (the map and native sensors are limited there) |
| `npm run lint` | Run ESLint |

## Project layout

| Folder | Contents |
|---|---|
| `app/` | Screens, using Expo Router file-based routing. `(tabs)/` holds the five tabs: Map, Schedule, Profile, Achievements and Stats. |
| `components/` | UI split by feature (`map`, `schedule`, `achievements`, `stats`, `leaderboard`, `health`, …) |
| `lib/` | App logic and saved state: XP ledger, daily progress and day history, schedule, step counter, background tracking, walking rules, i18n |
| `hooks/` | Location, compass, distance and day-rollover hooks |
| `constants/` | Fonts, map assets, sprite data and the app version |
| `locales/` | Translation files, one JSON file per language. `en.json` is the reference. |

The app version comes from `version` in `app.json` and is shown on the Profile and About pages.
