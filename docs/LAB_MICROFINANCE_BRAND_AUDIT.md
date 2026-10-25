# LAB MICROFINANCE — Rebrand Audit

**Scope:** Read-only source review of the known staging branch and related repository search results.  
**Status:** Partial inventory; not a full exhaustive scan of every file, Android asset, email, domain, or deployment setting.

## Confirmed LAB-facing areas in the staging branch

- Public home page heading and brand labels use LAB MICROFINANCE.
- The brand component's accessible label and rendered text use LAB MICROFINANCE.
- The dashboard header uses LAB MICROFINANCE.
- The root README heading includes “LAB MICROFINANCE Platform”.

## Legacy identifiers found or requiring inspection

| Area | Example found | Treatment |
|---|---|---|
| Repository/service names | Repository `PWFB/pwfb-microfinance`; Render services `pwfb-microfinance-staging`, `pwfb-backend-staging` | Disclose; rename only with a deliberate transfer/deployment plan |
| Static asset filenames | `/pwfb-logo.svg`, `/pwfb-app-icon.svg`, `/pwfb-login-logo.svg` | Inspect artwork and visible embedded text; filenames alone are not necessarily user-visible |
| Component/CSS identifiers | `PWFBCompanyBrand.tsx`, `pwfb-company-brand` | Internal names; optional cleanup, not a functional requirement by itself |
| Authentication bridge | `PWFBNative`, `__pwfbNativeGoogleResult`, `__pwfbNativePasskeyResult`, package `com.pwfb.microfinance` | Internal Android/WebView API identifiers; do not rename without coordinated app/backend changes |
| Auth nonce prefix | `pwfb_google_oidc_nonce_` | Internal browser storage key; change only with a compatibility-aware implementation |
| OAuth origin allowlist | Old `pwfb-microfinance-*` domains appear in the reviewed source | **Verify staging login origin coverage.** Do not remove old origins until actual deployed domains and sign-in flows are tested |
| Documentation and env examples | Some docs and sample webhook URLs use legacy PWFB naming | Update customer-facing/instructions where appropriate; keep environment values secret |
| Application package / native paths | `android-twa/app/src/main/java/com/pwfb/microfinance/` | Package renaming affects Android application identity and requires a controlled migration/release |

## Important functional check

The reviewed backend OAuth allowlist includes legacy Render origins. Confirm that the actual staging frontend origin is accepted and that Google login works in the current staging deployment. This is a verification item, not a confirmed production defect.

## Recommended order

1. Capture screenshots of the deployed home page, login, customer/staff/admin dashboards, emails, and app metadata.
2. Verify the actual deployed logo SVGs and app icon assets do not show the legacy name.
3. Test Google login and passkey login on staging, including the actual staging origin and Android wrapper if one is being sold.
4. Separate customer-visible text from internal identifiers; retain stable identifiers until migrations are tested.
5. Update docs, public repository description, service labels, and domain references only after mapping their effect on deployment and OAuth.
6. If changing Android package IDs, app links, or origins, produce a separate migration plan and test build. Do not perform broad text replacement across the repository.

## Current conclusion

The core web home and some brand components on the staging branch have been rebranded to LAB MICROFINANCE, but legacy infrastructure and internal identifiers remain. A complete deployed-surface audit is still required before claiming a 100% rebrand.
