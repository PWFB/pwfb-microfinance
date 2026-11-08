package com.pwfb.microfinance;

import android.content.Intent;
import android.os.Bundle;
import androidx.fragment.app.FragmentActivity;

/**
 * Compatibility entry point retained for older intents.
 * Authentication is now handled by the single PWFB web login screen inside
 * MainActivity so password, Google and fingerprint/passkey flows share one
 * session and one dashboard redirect path.
 */
public class NativeAuthActivity extends FragmentActivity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        finish();
    }
}
