# PWFB Microfinance — Google Play release

The PWFB frontend is prepared as a Progressive Web App and Trusted Web Activity (TWA) for Google Play.

## App identity

- Name: PWFB Microfinance
- Package ID: `com.pwfb.microfinance`
- Release: `1.0.51` / versionCode `51`
- Website: `https://pwfb-microfinance-1.onrender.com`
- API: `https://pwfb-backend.onrender.com`
- Target Android API: Android 16 / API 36

## Build

Build the production Android release using the repository's signed Android release workflow. The release workflow is authoritative for the production version and signing configuration.

The release must be tested on a real Android device before Play Console submission, including login, logout, refresh, customer, savings, loan, staff and transaction workflows.

## Play Console

Create the app in Google Play Console as an **Organization** account because PWFB is a financial service. Complete developer verification, store listing, privacy policy, Data safety, app access/demo credentials and all required declarations before submission.

Use **Internal testing** first. Do not publish the production release until the PWFB production workflows have passed the final regression checklist.

## Digital Asset Links

After the release/upload signing certificate is confirmed, publish the corresponding `assetlinks.json` at:

`https://pwfb-microfinance-1.onrender.com/.well-known/assetlinks.json`

The certificate fingerprint must come from the actual Android signing/upload configuration; it must not be guessed.
