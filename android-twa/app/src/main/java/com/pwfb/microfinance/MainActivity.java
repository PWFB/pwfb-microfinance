package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.splashscreen.SplashScreen;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/dashboard";
    private static final String SCHEME = "pwfb";
    private static final String OPEN_CHROME_HOST = "open-chrome";
    private static final String OPEN_APP_HOST = "open-app";
    private static final String REGISTER_PASSKEY_HOST = "register-passkey";
    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;

    @Override protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(5, 78, 34));
        getWindow().setNavigationBarColor(Color.rgb(5, 78, 34));
        getWindow().getDecorView().setSystemUiVisibility(0);
        String token = getIntent() == null ? null : getIntent().getStringExtra("app_token");
        if (token == null || token.trim().isEmpty()) token = getSharedPreferences("pwfb_app_auth", MODE_PRIVATE).getString("access_token", null);
        if (token == null || token.trim().isEmpty()) { startActivity(new Intent(this, NativeAuthActivity.class)); finish(); return; }
        buildWebApp(token);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (handleAppIntent(intent)) return;
        String token = intent == null ? null : intent.getStringExtra("app_token");
        if (token != null && !token.trim().isEmpty()) loadDashboard(token);
    }

    private void buildWebApp(String token) {
        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        swipeRefresh.setColorSchemeColors(Color.rgb(8,117,52), Color.rgb(244,119,18));
        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false); s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return handleWebViewUrl(request.getUrl().toString()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return handleWebViewUrl(url); }
            @Override public void onPageFinished(WebView view, String url) { if (swipeRefresh != null) swipeRefresh.setRefreshing(false); }
        });
        webView.setWebChromeClient(new WebChromeClient());
        swipeRefresh.addView(webView);
        swipeRefresh.setOnRefreshListener(() -> webView.reload());
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> webView.getScrollY() > 0);
        setContentView(swipeRefresh); loadDashboard(token);
    }

    private void loadDashboard(String token) { if (webView != null) webView.loadUrl(START_URL + "#app_token=" + Uri.encode(token)); }

    private boolean handleAppIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        if (REGISTER_PASSKEY_HOST.equalsIgnoreCase(data.getHost())) { startActivity(new Intent(this, NativePasskeyActivity.class)); return true; }
        if (OPEN_CHROME_HOST.equalsIgnoreCase(data.getHost())) {
            String target = data.getQueryParameter("url");
            if (target != null && !target.isEmpty()) try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(target))); } catch (Exception ignored) { }
            return true;
        }
        if (OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) {
            String token = getSharedPreferences("pwfb_app_auth", MODE_PRIVATE).getString("access_token", null);
            if (token != null && !token.isEmpty()) loadDashboard(token);
            return true;
        }
        return false;
    }

    private boolean handleWebViewUrl(String url) {
        if (url == null) return false; Uri data = Uri.parse(url);
        if (!SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        return handleAppIntent(new Intent(Intent.ACTION_VIEW, data));
    }

    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) { webView.goBack(); return; } super.onBackPressed(); }
    @Override protected void onDestroy() { if (webView != null) { webView.stopLoading(); webView.setWebChromeClient(null); webView.setWebViewClient(null); webView.destroy(); webView = null; } super.onDestroy(); }
}
