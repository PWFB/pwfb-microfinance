package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
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
    private static final String PREFS = "pwfb_app_auth";
    private static final String TOKEN = "access_token";
    private static final String ANDROID_ORIGIN = "android:apk-key-hash:EydbDY6N21LaX0LLvx4Qks583zIW5-AaZP5_8vsNy7TU";
    private static final int DEEP_GREEN = Color.rgb(5, 78, 34);
    private WebView webView;
    private SwipeRefreshLayout refreshLayout;
    private String pendingNativeToken;
    private boolean nativeLoginRedirected;
    private CredentialManager credentialManager;

    @Override protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(DEEP_GREEN);
        getWindow().setNavigationBarColor(DEEP_GREEN);
        getWindow().getDecorView().setSystemUiVisibility(0);
        credentialManager = CredentialManager.create(this);
        Intent launchIntent = getIntent();
        pendingNativeToken = launchIntent == null ? null : launchIntent.getStringExtra("app_token");
        if ((pendingNativeToken == null || pendingNativeToken.trim().isEmpty()) && launchIntent != null) pendingNativeToken = extractTokenFromAppIntent(launchIntent);
        buildWebApp();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String token = intent == null ? null : intent.getStringExtra("app_token");
        if (token == null || token.trim().isEmpty()) token = extractTokenFromAppIntent(intent);
        if (token != null && !token.trim().isEmpty()) {
            pendingNativeToken = token; nativeLoginRedirected = false;
            if (webView != null) webView.loadUrl(START_URL);
            return;
        }
        if (handleAppIntent(intent) && webView != null) return;
        if (webView != null) webView.loadUrl(START_URL);
    }

    private void buildWebApp() {
        refreshLayout = new SwipeRefreshLayout(this);
        refreshLayout.setLayoutParams(new android.view.ViewGroup.LayoutParams(-1, -1));
        refreshLayout.setOnChildScrollUpCallback((parent, child) -> webView != null && webView.canScrollVertically(-1));
        refreshLayout.setOnRefreshListener(() -> {
            if (webView != null) webView.reload();
            else if (refreshLayout != null) refreshLayout.setRefreshing(false);
        });
        webView = new WebView(this);
        webView.setLayoutParams(new android.view.ViewGroup.LayoutParams(-1, -1));
        webView.setBackgroundColor(Color.WHITE);
        webView.setOverScrollMode(View.OVER_SCROLL_ALWAYS);
        webView.setVerticalScrollBarEnabled(true);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setNestedScrollingEnabled(false);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false); s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) WebSettingsCompat.setWebAuthenticationSupport(s, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.addJavascriptInterface(new NativePasskeyBridge(), "PWFBNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return handleWebViewUrl(request.getUrl().toString()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return handleWebViewUrl(url); }
            @Override public void onPageFinished(WebView view, String url) { if (refreshLayout != null) refreshLayout.setRefreshing(false); continueNativeLogin(view, url); }
        });
        webView.setWebChromeClient(new WebChromeClient());
        refreshLayout.addView(webView);
        setContentView(refreshLayout); webView.loadUrl(START_URL);
    }

    public final class NativePasskeyBridge {
        @JavascriptInterface public void registerPasskey(final boolean replaceExisting, final String token) {
            runOnUiThread(() -> registerPasskeyOnMainThread(true, token));
        }
    }

    private void registerPasskeyOnMainThread(final boolean replaceExisting, final String token) {
        try {
            if (webView == null) return;
            Uri current = Uri.parse(webView.getUrl() == null ? "" : webView.getUrl());
            if (!"pwfb-frontend.onrender.com".equalsIgnoreCase(current.getHost())) {
                sendNativePasskeyResult(false, "PWFB native passkey registration is only available on the PWFB application domain.", null); return;
            }
            if (token == null || token.trim().isEmpty()) {
                sendNativePasskeyResult(false, "Your PWFB login session is missing. Please sign in again before registering your fingerprint.", null); return;
            }
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN, token).apply();
            sendNativePasskeyStatus("Removing the old PWFB passkey and preparing a fresh device credential…");
            new Thread(() -> {
                try {
                    postAuthenticated("/auth/passkey/unregister-all", new JSONObject(), token);
                    JSONObject requestBody = new JSONObject();
                    requestBody.put("replaceExisting", true);
                    JSONObject options = postAuthenticated("/auth/passkey/register/options", requestBody, token);
                    // The Android Credential Manager must never receive an exclusion list during
                    // the replacement flow. A stale credential can remain on the local provider
                    // even after the server-side Passkey row has been removed, and Credential
                    // Manager rejects registration when that stale ID appears in excludeCredentials.
                    options.remove("excludeCredentials");
                    runOnUiThread(() -> createNativePasskey(options, token));
                } catch (Exception e) {
                    sendNativePasskeyResult(false, e.getMessage() == null ? "Unable to prepare passkey registration." : e.getMessage(), null);
                }
            }).start();
        } catch (Throwable t) {
            sendNativePasskeyResult(false, t.getMessage() == null ? "Unable to start native PWFB passkey registration." : t.getMessage(), null);
        }
    }

    private void createNativePasskey(JSONObject options, String token) {
        try {
            CreatePublicKeyCredentialRequest request = new CreatePublicKeyCredentialRequest(options.toString(), null, false, null, false, false);
            sendNativePasskeyStatus("Use your fingerprint or device security to create the fresh PWFB passkey…");
            credentialManager.createCredentialAsync(this, request, null, ContextCompat.getMainExecutor(this), new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                @Override public void onResult(CreateCredentialResponse response) {
                    if (!(response instanceof CreatePublicKeyCredentialResponse)) {
                        sendNativePasskeyResult(false, "PWFB did not receive a passkey credential from the device.", null); return;
                    }
                    String registrationJson = ((CreatePublicKeyCredentialResponse) response).getRegistrationResponseJson();
                    new Thread(() -> verifyNativePasskey(registrationJson, options.optString("challenge", ""), token)).start();
                }
                @Override public void onError(CreateCredentialException error) {
                    String message = error == null ? "Native passkey registration was cancelled." : error.getMessage();
                    sendNativePasskeyResult(false, message == null ? "Native passkey registration failed." : message, null);
                }
            });
        } catch (Exception e) {
            sendNativePasskeyResult(false, e.getMessage() == null ? "This Android device cannot create a native PWFB passkey." : e.getMessage(), null);
        }
    }

    private void verifyNativePasskey(String registrationJson, String challenge, String token) {
        try {
            JSONObject body = new JSONObject();
            body.put("credential", new JSONObject(registrationJson)); body.put("challenge", challenge);
            JSONObject result = postAuthenticated("/auth/passkey/register/verify", body, token);
            if (!result.optBoolean("verified", false)) throw new Exception(result.optString("message", "PWFB could not verify the native passkey."));
            sendNativePasskeyResult(true, result.optString("message", "PWFB passkey registered successfully on this device."), result);
        } catch (Exception e) {
            sendNativePasskeyResult(false, e.getMessage() == null ? "PWFB could not verify the native passkey." : e.getMessage(), null);
        }
    }

    private JSONObject postAuthenticated(String path, JSONObject body, String token) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection();
        c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(30000);
        c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Authorization", "Bearer " + token); c.setRequestProperty("Origin", ANDROID_ORIGIN);
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream out = c.getOutputStream()) { out.write(bytes); }
        return readResponse(c);
    }

    private JSONObject readResponse(HttpURLConnection c) throws Exception {
        int status = c.getResponseCode();
        java.io.InputStream stream = status >= 400 ? c.getErrorStream() : c.getInputStream();
        if (stream == null) throw new Exception("PWFB server returned no response.");
        StringBuilder s = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) { String line; while ((line = r.readLine()) != null) s.append(line); }
        if (s.length() == 0) { if (status >= 400) throw new Exception("PWFB server error (" + status + ")."); return new JSONObject(); }
        JSONObject result = new JSONObject(s.toString());
        if (status >= 400) throw new Exception(result.optString("message", "PWFB server error (" + status + ")"));
        return result;
    }

    private void sendNativePasskeyStatus(String status) { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.__pwfbNativePasskeyStatus && window.__pwfbNativePasskeyStatus(" + JSONObject.quote(status) + ")", null); }); }

    private void sendNativePasskeyResult(boolean ok, String message, JSONObject result) {
        runOnUiThread(() -> { if (webView == null) return; try { JSONObject payload = new JSONObject(); payload.put("ok", ok); payload.put("message", message == null ? "" : message); if (result != null) payload.put("result", result); webView.evaluateJavascript("window.__pwfbNativePasskeyResult && window.__pwfbNativePasskeyResult(" + payload.toString() + ")", null); } catch (Exception ignored) { } });
    }

    private void continueNativeLogin(WebView view, String url) {
        if (nativeLoginRedirected || pendingNativeToken == null || pendingNativeToken.trim().isEmpty()) return;
        Uri current = Uri.parse(url == null ? "" : url);
        if (!"pwfb-frontend.onrender.com".equalsIgnoreCase(current.getHost())) return;
        if (!"/".equals(current.getPath()) && !"/login".equals(current.getPath())) return;
        nativeLoginRedirected = true; String token = escapeJs(pendingNativeToken);
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN, pendingNativeToken).apply();
        String script = "window.localStorage.setItem('token','" + token + "');window.sessionStorage.setItem('token','" + token + "');window.localStorage.setItem('access_token','" + token + "');window.sessionStorage.setItem('access_token','" + token + "');window.location.replace('" + DASHBOARD_URL + "?nativeApp=1');";
        view.evaluateJavascript(script, null);
    }

    private String escapeJs(String value) { return value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r"); }

    private String extractTokenFromAppIntent(Intent intent) {
        try { Uri data = intent == null ? null : intent.getData(); if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme()) || !OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) return null; String direct = data.getQueryParameter("app_token"); if (direct != null && !direct.trim().isEmpty()) return direct; String target = data.getQueryParameter("url"); if (target == null || target.trim().isEmpty()) return null; Uri targetUri = Uri.parse(target); String fragment = targetUri.getFragment(); if (fragment == null || fragment.isEmpty()) return null; return new android.net.UrlQuerySanitizer(fragment).getValue("app_token"); } catch (Exception ignored) { return null; }
    }

    private boolean handleAppIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData(); if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        if (OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) { String token = extractTokenFromAppIntent(intent); if (token != null && !token.trim().isEmpty()) { pendingNativeToken = token; nativeLoginRedirected = false; } String target = data.getQueryParameter("url"); if (target == null || target.trim().isEmpty()) target = START_URL; try { Uri targetUri = Uri.parse(target); if (("http".equalsIgnoreCase(targetUri.getScheme()) || "https".equalsIgnoreCase(targetUri.getScheme())) && "pwfb-frontend.onrender.com".equalsIgnoreCase(targetUri.getHost())) { if (webView != null) webView.loadUrl(targetUri.toString()); } else if (webView != null) webView.loadUrl(START_URL); } catch (Exception ignored) { if (webView != null) webView.loadUrl(START_URL); } return true; }
        return true;
    }

    private boolean handleWebViewUrl(String url) { if (url == null) return false; Uri data = Uri.parse(url); if (!SCHEME.equalsIgnoreCase(data.getScheme())) return false; return handleAppIntent(new Intent(Intent.ACTION_VIEW, data)); }
    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) { webView.goBack(); return; } super.onBackPressed(); }
    @Override protected void onDestroy() { if (webView != null) { webView.removeJavascriptInterface("PWFBNative"); webView.stopLoading(); webView.setWebChromeClient(null); webView.setWebViewClient(null); webView.destroy(); webView = null; } refreshLayout = null; super.onDestroy(); }
}