// Background tasks must be defined before any UI loads: Android can relaunch
// Lua headless (after a reboot or process restart) just to deliver locations.
import "./lib/backgroundTracking";
import "expo-router/entry";
