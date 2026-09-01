package com.pwfb.microfinance;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";
    private static final String OPEN_CHROME_SCHEME = "pwfb";

    private CustomTabsServiceConnection connection;
    private CustomTabsClient client;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (handleOpenChromeIntent(getIntent())) {
            return;
        }
        launchPwfb();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOpenChromeIntent(intent);
    }

    private boolean handleOpenChromeIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !OPEN_CHROME_SCHEME.equalsIgnoreCase(data.getScheme()) || !"open-chrome".equalsIgnoreCase(data.getHost())) {
            return false;
        }

        String target = data.getQueryParameter("url");
        if (target == null || target.trim().isEmpty()) {
            target = START_URL + "login";
        }

        Intent chromeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(target));
        chromeIntent.setPackage("com.android.chrome");
        try {
            startActivity(chromeIntent);
        } catch (Exception ignored) {
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(target));
            startActivity(browserIntent);
        }
        return true;
    }

    private void launchPwfb() {
        String provider = CustomTabsClient.getPackageName(this, null);
        if (provider == null) {
            launchFallbackCustomTab();
            return;
        }

        connection = new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(@NonNull ComponentName name, @NonNull CustomTabsClient connectedClient) {
                client = connectedClient;
                client.warmup(0L);
                CustomTabsSession session = client.newSession(null);
                if (session == null) {
                    launchFallbackCustomTab();
                    return;
                }

                TrustedWebActivityIntentBuilder builder = new TrustedWebActivityIntentBuilder(Uri.parse(START_URL))
                        .setToolbarColor(Color.rgb(7, 93, 42))
                        .setNavigationBarColor(Color.rgb(7, 93, 42));

                builder.build(session).launchTrustedWebActivity(MainActivity.this);
            }

            @Override
            public void onServiceDisconnected(@NonNull ComponentName name) {
                client = null;
            }
        };

        if (!CustomTabsClient.bindCustomTabsService(this, provider, connection)) {
            launchFallbackCustomTab();
        }
    }

    private void launchFallbackCustomTab() {
        CustomTabsIntent intent = new CustomTabsIntent.Builder().build();
        intent.launchUrl(this, Uri.parse(START_URL));
    }

    @Override
    protected void onDestroy() {
        if (connection != null) {
            try {
                unbindService(connection);
            } catch (IllegalArgumentException ignored) {
                // Service was already disconnected.
            }
            connection = null;
        }
        client = null;
        super.onDestroy();
    }
}
