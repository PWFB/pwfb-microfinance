# LAB MICROFINANCE — Google Play release

The LAB MICROFINANCE frontend is prepared as a Progressive Web App and Trusted Web Activity (TWA) for Google Play.

## App identity

- Name: LAB MICROFINANCE
- Package ID: `com.pwfb.microfinance`
- Version: see `android-twa/app/build.gradle`
- Website: `https://pwfb-microfinance-staging.onrender.com`
- Target Android API: Bubblewrap 1.25+ (Android 16 / API 36)

## Build

Install the current Bubblewrap CLI and Android prerequisites, then generate/update the Android project from `twa-manifest.json` and build the App Bundle:

```bash
npm install -g @bubblewrap/cli@1.25.0
cd play-store
bubblewrap init --manifest=https://pwfb-microfinance-staging.onrender.com/manifest.webmanifest
bubblewrap build
```

Bubblewrap produces an App Bundle (`app-release-bundle.aab`) suitable for Play Console and a signed APK for device testing. Keep the Android signing keystore private and backed up; never commit it to GitHub.

## Play Console

Create the app in Google Play Console as an **Organization** account because PWFB is a financial service. Complete the developer verification, store listing, privacy policy, Data safety, app access/demo credentials and required declarations before submission.

Use **Internal testing** first. Do not publish the production release until the PWFB login, customer, savings, loan, staff and transaction workflows have been tested on a real Android device.

## Digital Asset Links

After the release/upload signing certificate is known, publish the corresponding `assetlinks.json` at:

`https://pwfb-microfinance-staging.onrender.com/.well-known/assetlinks.json`

The certificate fingerprint must come from the actual Android signing/upload configuration; it must not be guessed or committed before the key is created.
