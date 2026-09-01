package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        launchWebApp();
    }

    private void launchWebApp() {
        Uri uri = Uri.parse(START_URL);
        try {
            new TrustedWebActivityIntentBuilder(uri)
                    .build()
                    .launchTrustedWebActivity(this);
        } catch (Exception ignored) {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
