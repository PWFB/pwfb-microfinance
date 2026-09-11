import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_FINGERPRINT = "13:27:43:63:A3:76:94:B6:B1:38:B9:6F:C7:84:24:B3:9F:37:CE:55:B9:F8:06:99:3F:9F:FC:BE:C3:72:ED:35";

export async function GET() {
  const fingerprint = (process.env.PWFB_ANDROID_SHA256_CERT_FINGERPRINT || DEFAULT_FINGERPRINT).trim().toUpperCase();

  return NextResponse.json([
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: "com.pwfb.microfinance",
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ], {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
