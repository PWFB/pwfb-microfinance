package com.pwfb.microfinance;

import android.app.Activity;
import android.content.ComponentName;
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

    private CustomTabsServiceConnection connection;
    private CustomTabsClient client;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        launchPwfb();
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
