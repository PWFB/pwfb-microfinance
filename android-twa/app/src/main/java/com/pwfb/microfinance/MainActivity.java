package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
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
    private static final int GREEN = Color.rgb(8, 117, 52);
    private static final int DEEP_GREEN = Color.rgb(5, 78, 34);
    private static final int ORANGE = Color.rgb(244, 119, 18);
    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;
    private ProgressBar pageProgress;

    @Override protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(DEEP_GREEN);
        getWindow().setNavigationBarColor(DEEP_GREEN);
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
        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        root.setBackgroundColor(Color.WHITE);

        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
        swipeRefresh.setColorSchemeColors(GREEN, ORANGE);
        swipeRefresh.setProgressBackgroundColorSchemeColor(Color.WHITE);
        swipeRefresh.setDistanceToTriggerSync(dp(72));
        swipeRefresh.setSlingshotDistance(dp(96));
        swipeRefresh.setEnabled(true);

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        webView.setBackgroundColor(Color.WHITE);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false); s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return handleWebViewUrl(request.getUrl().toString()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return handleWebViewUrl(url); }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (pageProgress != null) { pageProgress.setVisibility(View.VISIBLE); pageProgress.setProgress(20); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                if (pageProgress != null) { pageProgress.setProgress(100); pageProgress.postDelayed(() -> pageProgress.setVisibility(View.GONE), 180); }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame() && pageProgress != null) pageProgress.setVisibility(View.GONE);
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                if (pageProgress != null) {
                    pageProgress.setProgress(newProgress);
                    if (newProgress >= 100) pageProgress.postDelayed(() -> pageProgress.setVisibility(View.GONE), 120);
                    else pageProgress.setVisibility(View.VISIBLE);
                }
            }
        });

        swipeRefresh.addView(webView);
        swipeRefresh.setOnRefreshListener(() -> {
            if (webView != null) webView.reload();
            else swipeRefresh.setRefreshing(false);
        });
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> webView != null && webView.getScrollY() > 0);
        root.addView(swipeRefresh);

        pageProgress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP);
        pageProgress.setLayoutParams(progressParams);
        pageProgress.setMax(100);
        pageProgress.setProgress(0);
        pageProgress.setIndeterminate(false);
        pageProgress.setProgressDrawable(getResources().getDrawable(android.R.drawable.progress_horizontal));
        pageProgress.setVisibility(View.GONE);
        root.addView(pageProgress);

        setContentView(root);
        loadDashboard(token);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void loadDashboard(String token) { if (webView != null) webView.loadUrl(START_URL + "#app_token=" + Uri.encode(token)); }

    private boolean handleAppIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme())) return false;
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
