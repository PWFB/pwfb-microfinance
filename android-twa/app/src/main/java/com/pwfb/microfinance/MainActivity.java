package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.TrustedWebUtils;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";
    private static final String OPEN_CHROME_SCHEME = "pwfb";
    private static final String OPEN_CHROME_HOST = "open-chrome";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
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
        customTabsIntent.intent.setData(uri);
        try {
            TrustedWebUtils.launchAsTrustedWebActivity(this, customTabsIntent.intent);
        } catch (Exception ignored) {
            customTabsIntent.launchUrl(this, uri);
        }
    }
}
