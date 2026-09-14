# Android — Marion Wx Map

Short howto for the Capacitor debug APK. Windows users: keep using `wx-map/start.bat` (unchanged).

## Install (sideload)

1. Phone Chrome download: https://github.com/ardean1/marion-wx-map/releases/download/android-debug-2026-09-13/MarionWxMap-debug.apk  
   SHA-256: `44febd5881376cb11d9b34c1f0cff655547d5be1033080fbc27ac719f4457dd3`
2. Open the file → allow install from that source if prompted → Install.
3. Brand-specific steps: search `sideload APK` + your brand/model.
4. Optional: scan the APK on VirusTotal yourself (transparency only — not a vulnerability-free claim).

Debug/test only — not Play Store. Map feeds are public; nothing is uploaded to Ardean.

## Rebuild locally (Linux/macOS with Android SDK)

```bash
cd marion-wx-map-public   # repo root
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../dist/MarionWxMap-debug.apk
```

Or: `npm run android:apk` (needs `ANDROID_HOME` / `local.properties`).

App id: `com.ardean.marionwxmap` · webDir: `wx-map` · CapacitorHttp enabled for ADS-B.

## ADS-B

- **Windows:** `start.bat` → local `/proxy/adsb` (CORS workaround).
- **Android:** native Capacitor detects itself and calls `https://api.adsb.lol/v2/point/...` via CapacitorHttp (no local Python).

## CI

`.github/workflows/android-apk.yml` builds a debug APK on push / `workflow_dispatch` and uploads it as an artifact.
