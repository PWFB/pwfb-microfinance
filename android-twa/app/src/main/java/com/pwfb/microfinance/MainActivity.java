package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CreatePublicKeyCredentialRequest;
import androidx.credentials.CreatePublicKeyCredentialResponse;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
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

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";
    private static final String DASHBOARD_URL = "https://pwfb-frontend.onrender.com/dashboard";
    private static final String API = "https://pwfb-backend.onrender.com";
    private static final String SCHEME = "pwfb";
    private static final String OPEN_APP_HOST = "open-app";
    private static final String OPEN_CHROME_HOST = "open-chrome";
    private static final String PREFS = "pwfb_app_auth";
    private static final String TOKEN = "access_token";
    private static final String ANDROID_ORIGIN = "android:apk-key-hash:EydbDY6N21LaX0LLvx4Qks583zIW5-AaZP5_8vsNy7TU";
    private static final int GOOGLE_REQUEST = 9101;
    private static final int DEEP_GREEN = Color.rgb(5, 78, 34);
    private static final int GREEN = Color.rgb(8, 117, 52);
    private static final int ORANGE = Color.rgb(244, 119, 18);
    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;
    private String pendingNativeToken;
    private boolean nativeLoginRedirected;
    private CredentialManager credentialManager;
    private GoogleSignInClient googleClient;

    @Override protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this); super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(DEEP_GREEN); getWindow().setNavigationBarColor(DEEP_GREEN); getWindow().getDecorView().setSystemUiVisibility(0);
        credentialManager = CredentialManager.create(this);
        Intent launchIntent = getIntent();
        pendingNativeToken = launchIntent == null ? null : launchIntent.getStringExtra("app_token");
        if ((pendingNativeToken == null || pendingNativeToken.trim().isEmpty()) && launchIntent != null) pendingNativeToken = extractTokenFromAppIntent(launchIntent);
        if (launchIntent != null && isLogoutIntent(launchIntent)) clearNativeAuth();
        if (pendingNativeToken == null || pendingNativeToken.trim().isEmpty()) resetWebSession();
        buildWebApp();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (isLogoutIntent(intent)) { clearNativeAuth(); pendingNativeToken = null; nativeLoginRedirected = false; resetWebSession(); launchNativeAuth(); return; }
        String token = intent == null ? null : intent.getStringExtra("app_token");
        if (token == null || token.trim().isEmpty()) token = extractTokenFromAppIntent(intent);
        if (token != null && !token.trim().isEmpty()) { pendingNativeToken = token; nativeLoginRedirected = false; if (webView != null) webView.loadUrl(START_URL); return; }
        if (handleAppIntent(intent)) return;
        if (webView != null) webView.loadUrl(START_URL);
    }

    private boolean isLogoutIntent(Intent intent) { try { Uri data = intent == null ? null : intent.getData(); return data != null && SCHEME.equalsIgnoreCase(data.getScheme()) && OPEN_APP_HOST.equalsIgnoreCase(data.getHost()) && "1".equals(data.getQueryParameter("logout")); } catch (Exception ignored) { return false; } }
    private void clearNativeAuth() { getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove(TOKEN).apply(); }
    private void launchNativeAuth() { Intent i = new Intent(this, NativeAuthActivity.class); i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); finish(); }
    private void resetWebSession() { CookieManager cookies = CookieManager.getInstance(); cookies.removeAllCookies(null); cookies.flush(); WebStorage.getInstance().deleteAllData(); }

    private void buildWebApp() {
        swipeRefresh = new SwipeRefreshLayout(this); swipeRefresh.setLayoutParams(new ViewGroup.LayoutParams(-1, -1)); swipeRefresh.setColorSchemeColors(GREEN, ORANGE); swipeRefresh.setProgressBackgroundColorSchemeColor(Color.WHITE); swipeRefresh.setDistanceToTriggerSync(dp(72)); swipeRefresh.setSlingshotDistance(dp(96));
        webView = new WebView(this); webView.setLayoutParams(new ViewGroup.LayoutParams(-1, -1)); webView.setBackgroundColor(Color.WHITE); webView.setOverScrollMode(View.OVER_SCROLL_ALWAYS);
        WebSettings s = webView.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true); s.setLoadsImagesAutomatically(true); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false); s.setSupportMultipleWindows(false); s.setJavaScriptCanOpenWindowsAutomatically(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); s.setUserAgentString(s.getUserAgentString() + " PWFBAndroidApp/1.0");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) WebSettingsCompat.setWebAuthenticationSupport(s, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new NativePasskeyBridge(), "PWFBNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return handleWebViewUrl(request.getUrl().toString()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return handleWebViewUrl(url); }
            @Override public void onPageFinished(WebView view, String url) { if (swipeRefresh != null) swipeRefresh.setRefreshing(false); continueNativeLogin(view, url); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) { if (request.isForMainFrame() && swipeRefresh != null) swipeRefresh.setRefreshing(false); }
        });
        webView.setWebChromeClient(new WebChromeClient()); swipeRefresh.addView(webView); swipeRefresh.setOnRefreshListener(() -> { if (webView != null) webView.reload(); else swipeRefresh.setRefreshing(false); }); swipeRefresh.setOnChildScrollUpCallback((parent, child) -> webView != null && webView.getScrollY() > 0); setContentView(swipeRefresh); webView.loadUrl(START_URL);
    }

    public final class NativePasskeyBridge {
        @JavascriptInterface public void registerPasskey(final boolean replaceExisting, final String token) { runOnUiThread(() -> registerPasskeyOnMainThread(true, token)); }
        @JavascriptInterface public void signInWithGoogle() { runOnUiThread(MainActivity.this::startNativeGoogleSignIn); }
    }

    private void startNativeGoogleSignIn() {
        new Thread(() -> {
            try {
                JSONObject config = get("/auth/google/config");
                String clientId = config.optString("android_client_id", "").trim();
                if (clientId.isEmpty()) throw new Exception("Google sign-in is not configured for the Android app.");
                GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).requestIdToken(clientId).requestEmail().build();
                googleClient = GoogleSignIn.getClient(this, options);
                runOnUiThread(() -> googleClient.signOut().addOnCompleteListener(task -> {
                    try { startActivityForResult(googleClient.getSignInIntent(), GOOGLE_REQUEST); }
                    catch (Exception e) { sendNativeGoogleResult(false, "Google sign-in could not start.", null); }
                }));
            } catch (Exception e) { sendNativeGoogleResult(false, e.getMessage() == null ? "Google sign-in is unavailable." : e.getMessage(), null); }
        }).start();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != GOOGLE_REQUEST) return;
        if (googleClient == null) { sendNativeGoogleResult(false, "Google sign-in session is unavailable.", null); return; }
        try {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null || account.getIdToken() == null) throw new Exception("Google did not return a secure ID token.");
            String idToken = account.getIdToken();
            new Thread(() -> {
                try {
                    JSONObject body = new JSONObject(); body.put("credential", idToken);
                    JSONObject result = postPublic("/auth/google/android", body);
                    String token = result.optString("access_token", "");
                    if (token.isEmpty()) throw new Exception("PWFB did not return a login session.");
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN, token).apply();
                    sendNativeGoogleResult(true, "Google sign-in successful.", result);
                } catch (Exception e) { sendNativeGoogleResult(false, e.getMessage() == null ? "Google sign-in failed." : e.getMessage(), null); }
            }).start();
        } catch (ApiException e) { sendNativeGoogleResult(false, "Google sign-in error (code " + e.getStatusCode() + "). Please verify the PWFB Android Google configuration.", null); }
        catch (Exception e) { sendNativeGoogleResult(false, e.getMessage() == null ? "Google sign-in failed." : e.getMessage(), null); }
    }

    private JSONObject get(String path) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection(); c.setRequestMethod("GET"); c.setConnectTimeout(15000); c.setReadTimeout(30000); return readResponse(c);
    }

    private JSONObject postPublic(String path, JSONObject body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection(); c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setRequestProperty("Content-Type", "application/json");
        try (OutputStream out = c.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); } return readResponse(c);
    }

    private void sendNativeGoogleResult(boolean ok, String message, JSONObject result) { runOnUiThread(() -> { if (webView == null) return; try { JSONObject payload = new JSONObject(); payload.put("ok", ok); payload.put("message", message == null ? "" : message); if (result != null) { payload.put("access_token", result.optString("access_token", "")); if (result.has("user")) payload.put("user", result.get("user")); } webView.evaluateJavascript("window.__pwfbNativeGoogleResult && window.__pwfbNativeGoogleResult(" + payload.toString() + ")", null); } catch (Exception ignored) {} }); }

    private void registerPasskeyOnMainThread(final boolean replaceExisting, final String token) {
        try {
            if (webView == null) return;
            Uri current = Uri.parse(webView.getUrl() == null ? "" : webView.getUrl());
            if (!"pwfb-frontend.onrender.com".equalsIgnoreCase(current.getHost())) { sendNativePasskeyResult(false, "PWFB native passkey registration is only available on the PWFB application domain.", null); return; }
            if (token == null || token.trim().isEmpty()) { sendNativePasskeyResult(false, "Your PWFB login session is missing. Please sign in again before registering your fingerprint.", null); return; }
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN, token).apply();
            sendNativePasskeyStatus("Save your PWFB fingerprint now…");
            new Thread(() -> {
                try {
                    postAuthenticated("/auth/passkey/unregister-all", new JSONObject(), token);
                    JSONObject requestBody = new JSONObject(); requestBody.put("replaceExisting", true);
                    JSONObject options = postAuthenticated("/auth/passkey/register/options", requestBody, token); options.remove("excludeCredentials");
                    runOnUiThread(() -> createNativePasskey(options, token));
                } catch (Exception e) { sendNativePasskeyResult(false, e.getMessage() == null ? "Unable to prepare fingerprint registration." : e.getMessage(), null); }
            }).start();
        } catch (Throwable t) { sendNativePasskeyResult(false, t.getMessage() == null ? "Unable to start fingerprint registration." : t.getMessage(), null); }
    }

    private void createNativePasskey(JSONObject options, String token) {
        try {
            CreatePublicKeyCredentialRequest request = new CreatePublicKeyCredentialRequest(options.toString(), null, false, null, false, false);
            sendNativePasskeyStatus("Touch your fingerprint sensor to save PWFB on this device…");
            credentialManager.createCredentialAsync(this, request, null, ContextCompat.getMainExecutor(this), new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                @Override public void onResult(CreateCredentialResponse response) {
                    if (!(response instanceof CreatePublicKeyCredentialResponse)) { sendNativePasskeyResult(false, "PWFB did not receive a passkey credential from the device.", null); return; }
                    String registrationJson = ((CreatePublicKeyCredentialResponse) response).getRegistrationResponseJson();
                    new Thread(() -> verifyNativePasskey(registrationJson, options.optString("challenge", ""), token)).start();
                }
                @Override public void onError(CreateCredentialException error) { String message = error == null ? "Fingerprint registration was cancelled." : error.getMessage(); sendNativePasskeyResult(false, message == null ? "Fingerprint registration failed." : message, null); }
            });
        } catch (Exception e) { sendNativePasskeyResult(false, e.getMessage() == null ? "This Android device cannot save a PWFB fingerprint passkey." : e.getMessage(), null); }
    }

    private void verifyNativePasskey(String registrationJson, String challenge, String token) {
        try { JSONObject body = new JSONObject(); body.put("credential", new JSONObject(registrationJson)); body.put("challenge", challenge); JSONObject result = postAuthenticated("/auth/passkey/register/verify", body, token); if (!result.optBoolean("verified", false)) throw new Exception(result.optString("message", "PWFB could not verify the fingerprint passkey.")); sendNativePasskeyResult(true, result.optString("message", "Fingerprint saved successfully."), result); }
        catch (Exception e) { sendNativePasskeyResult(false, e.getMessage() == null ? "PWFB could not verify the fingerprint passkey." : e.getMessage(), null); }
    }

    private JSONObject postAuthenticated(String path, JSONObject body, String token) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection(); c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Authorization", "Bearer " + token); c.setRequestProperty("Origin", ANDROID_ORIGIN);
        try (OutputStream out = c.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); } return readResponse(c);
    }

    private JSONObject readResponse(HttpURLConnection c) throws Exception {
        int status = c.getResponseCode(); java.io.InputStream stream = status >= 400 ? c.getErrorStream() : c.getInputStream(); if (stream == null) throw new Exception("PWFB server returned no response."); StringBuilder s = new StringBuilder(); try (BufferedReader r = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) { String line; while ((line = r.readLine()) != null) s.append(line); } if (s.length() == 0) { if (status >= 400) throw new Exception("PWFB server error (" + status + ")."); return new JSONObject(); } JSONObject result = new JSONObject(s.toString()); if (status >= 400) throw new Exception(result.optString("message", "PWFB server error (" + status + ")")); return result;
    }

    private void sendNativePasskeyStatus(String status) { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.__pwfbNativePasskeyStatus && window.__pwfbNativePasskeyStatus(" + JSONObject.quote(status) + ")", null); }); }
    private void sendNativePasskeyResult(boolean ok, String message, JSONObject result) { runOnUiThread(() -> { if (webView == null) return; try { JSONObject payload = new JSONObject(); payload.put("ok", ok); payload.put("message", message == null ? "" : message); if (result != null) payload.put("result", result); webView.evaluateJavascript("window.__pwfbNativePasskeyResult && window.__pwfbNativePasskeyResult(" + payload.toString() + ")", null); } catch (Exception ignored) {} }); }

    private void continueNativeLogin(WebView view, String url) {
        if (nativeLoginRedirected || pendingNativeToken == null || pendingNativeToken.trim().isEmpty()) return;
        Uri current = Uri.parse(url == null ? "" : url); if (!"pwfb-frontend.onrender.com".equalsIgnoreCase(current.getHost())) return; if (!"/".equals(current.getPath()) && !"/login".equals(current.getPath())) return;
        nativeLoginRedirected = true; String token = escapeJs(pendingNativeToken); getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN, pendingNativeToken).apply();
        view.evaluateJavascript("window.localStorage.setItem('token','" + token + "');window.sessionStorage.setItem('token','" + token + "');window.localStorage.setItem('access_token','" + token + "');window.sessionStorage.setItem('access_token','" + token + "');window.location.replace('" + DASHBOARD_URL + "?nativeApp=1');", null);
    }

    private String escapeJs(String value) { return value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r"); }
    private String extractTokenFromAppIntent(Intent intent) { try { Uri data = intent == null ? null : intent.getData(); if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme()) || !OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) return null; String direct = data.getQueryParameter("app_token"); if (direct != null && !direct.trim().isEmpty()) return direct; String target = data.getQueryParameter("url"); if (target == null || target.trim().isEmpty()) return null; Uri targetUri = Uri.parse(target); String fragment = targetUri.getFragment(); if (fragment == null || fragment.isEmpty()) return null; return new android.net.UrlQuerySanitizer(fragment).getValue("app_token"); } catch (Exception ignored) { return null; } }

    private boolean handleAppIntent(Intent intent) {
        if (isLogoutIntent(intent)) { clearNativeAuth(); pendingNativeToken = null; nativeLoginRedirected = false; resetWebSession(); launchNativeAuth(); return true; }
        Uri data = intent == null ? null : intent.getData(); if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        if (OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) { String target = data.getQueryParameter("url"); if (target == null || target.trim().isEmpty()) target = START_URL; try { Uri targetUri = Uri.parse(target); if ("http".equalsIgnoreCase(targetUri.getScheme()) || "https".equalsIgnoreCase(targetUri.getScheme())) { if ("pwfb-frontend.onrender.com".equalsIgnoreCase(targetUri.getHost())) { String token = extractTokenFromAppIntent(intent); if (token != null && !token.trim().isEmpty()) { pendingNativeToken = token; nativeLoginRedirected = false; } if (webView != null) webView.loadUrl(targetUri.toString()); } else if (webView != null) webView.loadUrl(START_URL); } } catch (Exception ignored) { if (webView != null) webView.loadUrl(START_URL); } return true; }
        if (OPEN_CHROME_HOST.equalsIgnoreCase(data.getHost())) { String target = data.getQueryParameter("url"); if (target == null || target.trim().isEmpty()) target = START_URL; try { Uri targetUri = Uri.parse(target); if ("http".equalsIgnoreCase(targetUri.getScheme()) || "https".equalsIgnoreCase(targetUri.getScheme())) { Intent chromeIntent = new Intent(Intent.ACTION_VIEW, targetUri); chromeIntent.setPackage("com.android.chrome"); try { startActivity(chromeIntent); } catch (Exception chromeUnavailable) { startActivity(new Intent(Intent.ACTION_VIEW, targetUri)); } } } catch (Exception ignored) {} return true; }
        return true;
    }

    private boolean handleWebViewUrl(String url) { if (url == null) return false; Uri data = Uri.parse(url); if (!SCHEME.equalsIgnoreCase(data.getScheme())) return false; return handleAppIntent(new Intent(Intent.ACTION_VIEW, data)); }
    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) { webView.goBack(); return; } super.onBackPressed(); }
    @Override protected void onDestroy() { if (webView != null) { webView.removeJavascriptInterface("PWFBNative"); webView.stopLoading(); webView.setWebChromeClient(null); webView.setWebViewClient(null); webView.destroy(); webView = null; } super.onDestroy(); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
