package com.pwfb.microfinance;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebUtils;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        launchWebApp();
    }

    private void launchWebApp() {
        Uri uri = Uri.parse(START_URL);
        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                .setShowTitle(false)
                .build();
        customTabsIntent.intent.setData(uri);

        try {
            // Launch as a Trusted Web Activity so the app uses the real HTTPS
            // origin. This is required for WebAuthn/passkeys and works with
            // Google Identity Services in the user's Chrome provider.
            TrustedWebUtils.launchAsTrustedWebActivity(this, customTabsIntent.intent);
        } catch (Exception ignored) {
            // Fallback to a Chrome Custom Tab while preserving the HTTPS origin.
            customTabsIntent.launchUrl(this, uri);
        }
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
