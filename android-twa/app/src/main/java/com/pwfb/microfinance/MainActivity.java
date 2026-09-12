package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.activity.OnBackPressedCallback;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.TrustedWebUtils;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";
    private static final String OPEN_CHROME_SCHEME = "pwfb";
    private static final String OPEN_CHROME_HOST = "open-chrome";
    private static final long STARTUP_SPLASH_MS = 1800L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        final long splashUntil = System.currentTimeMillis() + STARTUP_SPLASH_MS;
        splashScreen.setKeepOnScreenCondition(() -> System.currentTimeMillis() < splashUntil);

        super.onCreate(savedInstanceState);
        launchBrowser(resolveLaunchUri(getIntent()));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        launchBrowser(resolveLaunchUri(intent));
    }

    private Uri resolveLaunchUri(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data != null
                && OPEN_CHROME_SCHEME.equalsIgnoreCase(data.getScheme())
                && OPEN_CHROME_HOST.equalsIgnoreCase(data.getHost())) {
            String target = data.getQueryParameter("url");
            if (target != null && !target.trim().isEmpty()) {
                try {
                    Uri uri = Uri.parse(target);
                    if ("https".equalsIgnoreCase(uri.getScheme())) return uri;
                } catch (Exception ignored) { }
            }
        }
        return Uri.parse(START_URL);
    }

    private void launchBrowser(Uri uri) {
        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder().build();
        customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            TrustedWebUtils.launchAsTrustedWebActivity(this, customTabsIntent, uri);
        } catch (Exception ignored) {
            customTabsIntent.launchUrl(this, uri);
        }
    }
}
