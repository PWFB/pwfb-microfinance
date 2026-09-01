package com.pwfb.microfinance;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.browser.customtabs.CustomTabsIntent;

public class RefreshReceiver extends BroadcastReceiver {
    public static final String ACTION_REFRESH = "com.pwfb.microfinance.ACTION_REFRESH";
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";

    public static PendingIntent createPendingIntent(Context context) {
        Intent intent = new Intent(context, RefreshReceiver.class);
        intent.setAction(ACTION_REFRESH);
        return PendingIntent.getBroadcast(
                context,
                1001,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_REFRESH.equals(intent.getAction())) {
            return;
        }

        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder().build();
        customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        customTabsIntent.launchUrl(context, Uri.parse(START_URL));
    }
}
