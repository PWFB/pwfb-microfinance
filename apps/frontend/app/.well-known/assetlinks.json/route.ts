import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const fingerprint = process.env.PWFB_ANDROID_SHA256_CERT_FINGERPRINT?.trim();

  if (!fingerprint) {
    return NextResponse.json(
      { error: "PWFB_ANDROID_SHA256_CERT_FINGERPRINT is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json([
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: "com.pwfb.microfinance",
        sha256_cert_fingerprints: [fingerprint.toUpperCase()],
      },
    },
  ], {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
