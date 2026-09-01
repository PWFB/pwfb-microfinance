package com.pwfb.microfinance;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsIntent;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openPwfb();
    }

    private void openPwfb() {
        Bitmap refreshIcon = BitmapFactory.decodeResource(
                getResources(), android.R.drawable.ic_popup_sync
        );

        CustomTabsIntent.Builder builder = new CustomTabsIntent.Builder();
        if (refreshIcon != null) {
            builder.setActionButton(
                    refreshIcon,
                    "Refresh PWFB login page",
                    RefreshReceiver.createPendingIntent(this),
                    true
            );
        }

        CustomTabsIntent customTabsIntent = builder.build();
        customTabsIntent.launchUrl(this, Uri.parse(START_URL));
    }
}
