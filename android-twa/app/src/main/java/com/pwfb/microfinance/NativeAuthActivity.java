package com.pwfb.microfinance;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;

public class NativeAuthActivity extends android.app.Activity {
    private static final String API = "https://pwfb-backend.onrender.com";
    private static final String PREFS = "pwfb_app_auth";
    private static final String TOKEN = "access_token";
    private static final int GOOGLE_REQUEST = 9001;

    private EditText email;
    private EditText password;
    private Button login;
    private Button google;
    private Button fingerprint;
    private TextView message;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        if (getSharedPreferences(PREFS, MODE_PRIVATE).contains(TOKEN)) {
            fingerprint.setVisibility(View.VISIBLE);
            message.setText("PWFB App Authentication");
            new android.os.Handler().postDelayed(this::authenticateWithFingerprint, 350);
        }
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(32, 70, 32, 32);
        root.setBackgroundColor(Color.WHITE);

        TextView brand = new TextView(this);
        brand.setText("PWFB\nMICROFINANCE");
        brand.setTextColor(Color.rgb(20, 95, 55));
        brand.setTextSize(26);
        brand.setGravity(Gravity.CENTER);
        brand.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(brand, new LinearLayout.LayoutParams(-1, -2));

        TextView title = new TextView(this);
        title.setText("App Sign In");
        title.setTextColor(Color.rgb(25, 45, 35));
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 30, 0, 10);
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        TextView subtitle = new TextView(this);
        subtitle.setText("This is the PWFB Android app authentication.\nIt does not redirect to the PWFB web login.");
        subtitle.setTextColor(Color.DKGRAY);
        subtitle.setTextSize(14);
        subtitle.setGravity(Gravity.CENTER);
        root.addView(subtitle, new LinearLayout.LayoutParams(-1, -2));

        email = new EditText(this);
        email.setHint("Email");
        email.setSingleLine(true);
        email.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        root.addView(email, fieldParams());

        password = new EditText(this);
        password.setHint("Password");
        password.setSingleLine(true);
        password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        root.addView(password, fieldParams());

        login = button("Login", Color.rgb(30, 142, 62));
        login.setOnClickListener(v -> passwordLogin());
        root.addView(login, buttonParams());

        google = button("G  Continue with Google", Color.rgb(244, 119, 18));
        google.setOnClickListener(v -> googleLogin());
        root.addView(google, buttonParams());

        fingerprint = button("Use fingerprint on this device", Color.rgb(30, 142, 62));
        fingerprint.setVisibility(View.GONE);
        fingerprint.setOnClickListener(v -> authenticateWithFingerprint());
        root.addView(fingerprint, buttonParams());

        message = new TextView(this);
        message.setTextColor(Color.DKGRAY);
        message.setTextSize(14);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, 18, 0, 0);
        root.addView(message, new LinearLayout.LayoutParams(-1, -2));

        setContentView(root);
    }

    private LinearLayout.LayoutParams fieldParams() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, 60);
        p.setMargins(0, 18, 0, 0);
        return p;
    }

    private LinearLayout.LayoutParams buttonParams() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, 58);
        p.setMargins(0, 14, 0, 0);
        return p;
    }

    private Button button(String text, int color) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(Color.WHITE);
        b.setTextSize(15);
        b.setAllCaps(false);
        b.setBackgroundColor(color);
        return b;
    }

    private void passwordLogin() {
        final String e = email.getText().toString().trim();
        final String p = password.getText().toString();
        if (e.isEmpty() || p.isEmpty()) { message.setText("Enter your email and password."); return; }
        setBusy(true, "Signing in securely in the PWFB app…");
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject(); body.put("email", e); body.put("password", p);
                JSONObject result = post("/auth/login", body);
                finishNativeLogin(result.getString("access_token"));
            } catch (Exception ex) { runOnUiThread(() -> { setBusy(false, ex.getMessage() == null ? "Login failed" : ex.getMessage()); }); }
        }).start();
    }

    private void googleLogin() {
        setBusy(true, "Opening Google sign-in inside the PWFB app…");
        new Thread(() -> {
            try {
                JSONObject config = get("/auth/google/config");
                String clientId = config.optString("client_id", "").trim();
                if (clientId.isEmpty()) throw new Exception("Google sign-in is not configured on the server.");
                runOnUiThread(() -> {
                    try {
                        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                                .requestIdToken(clientId).requestEmail().build();
                        GoogleSignInClient client = GoogleSignIn.getClient(this, options);
                        startActivityForResult(client.getSignInIntent(), GOOGLE_REQUEST);
                    } catch (Exception ex) { setBusy(false, "Google sign-in could not start."); }
                });
            } catch (Exception ex) { runOnUiThread(() -> setBusy(false, ex.getMessage() == null ? "Google sign-in failed" : ex.getMessage())); }
        }).start();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != GOOGLE_REQUEST) return;
        try {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null || account.getIdToken() == null) throw new Exception("Google did not return an ID token.");
            String idToken = account.getIdToken();
            new Thread(() -> {
                try {
                    JSONObject body = new JSONObject(); body.put("credential", idToken);
                    JSONObject result = post("/auth/google/android", body);
                    finishNativeLogin(result.getString("access_token"));
                } catch (Exception ex) { runOnUiThread(() -> setBusy(false, ex.getMessage() == null ? "Google authentication failed" : ex.getMessage())); }
            }).start();
        } catch (Exception ex) { setBusy(false, "Google sign-in was cancelled or failed."); }
    }

    private void authenticateWithFingerprint() {
        String token = getSharedPreferences(PREFS, MODE_PRIVATE).getString(TOKEN, null);
        if (token == null || token.isEmpty()) { message.setText("Sign in with your PWFB password first to enable fingerprint on this app."); return; }
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt prompt = new BiometricPrompt(this, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) { super.onAuthenticationSucceeded(result); launchMain(token); }
            @Override public void onAuthenticationError(int errorCode, CharSequence errString) { super.onAuthenticationError(errorCode, errString); message.setText("Fingerprint authentication cancelled. You can use your PWFB password."); }
        });
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("PWFB App Authentication")
                .setSubtitle("Use your fingerprint to unlock this PWFB app")
                .setNegativeButtonText("Use password")
                .build();
        prompt.authenticate(info);
    }

    private void finishNativeLogin(String token) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN, token).apply();
        runOnUiThread(() -> { setBusy(false, "PWFB app authentication successful."); launchMain(token); });
    }

    private void launchMain(String token) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("app_token", token);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent); finish();
    }

    private void setBusy(boolean busy, String text) {
        login.setEnabled(!busy); google.setEnabled(!busy); password.setEnabled(!busy); email.setEnabled(!busy);
        message.setText(text);
    }

    private JSONObject get(String path) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection();
        c.setRequestMethod("GET"); c.setConnectTimeout(15000); c.setReadTimeout(20000);
        return read(c);
    }

    private JSONObject post(String path, JSONObject body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection();
        c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(20000);
        c.setRequestProperty("Content-Type", "application/json");
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream out = c.getOutputStream()) { out.write(bytes); }
        return read(c);
    }

    private JSONObject read(HttpURLConnection c) throws Exception {
        int status = c.getResponseCode();
        java.io.InputStream stream = status >= 400 ? c.getErrorStream() : c.getInputStream();
        StringBuilder text = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) { String line; while ((line = r.readLine()) != null) text.append(line); }
        JSONObject result = new JSONObject(text.toString());
        if (status >= 400) throw new Exception(result.optString("message", "Authentication request failed"));
        return result;
    }
}
