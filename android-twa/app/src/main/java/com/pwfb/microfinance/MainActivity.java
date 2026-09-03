package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.splashscreen.SplashScreen;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";
    private static final String SCHEME = "pwfb";
    private static final String OPEN_APP_HOST = "open-app";
    private static final int DEEP_GREEN = Color.rgb(5, 78, 34);
    private static final int GREEN = Color.rgb(8, 117, 52);
    private static final int ORANGE = Color.rgb(244, 119, 18);
    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;

    @Override protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(DEEP_GREEN);
        getWindow().setNavigationBarColor(DEEP_GREEN);
        getWindow().getDecorView().setSystemUiVisibility(0);

        // Start every fresh app launch at PWFB's public landing/login flow.
        // This clears only the WebView session; native biometric credentials remain untouched.
        resetWebSession();
        buildWebApp();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (handleAppIntent(intent)) return;
        if (webView != null) webView.loadUrl(START_URL);
    }

    private void resetWebSession() {
        CookieManager cookies = CookieManager.getInstance();
        cookies.removeAllCookies(null);
        cookies.flush();
        WebStorage.getInstance().deleteAllData();
    }

    private void buildWebApp() {
        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        swipeRefresh.setColorSchemeColors(GREEN, ORANGE);
        swipeRefresh.setProgressBackgroundColorSchemeColor(Color.WHITE);
        swipeRefresh.setDistanceToTriggerSync(dp(72));
        swipeRefresh.setSlingshotDistance(dp(96));

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        webView.setBackgroundColor(Color.WHITE);
        webView.setOverScrollMode(View.OVER_SCROLL_ALWAYS);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleWebViewUrl(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleWebViewUrl(url);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame() && swipeRefresh != null) swipeRefresh.setRefreshing(false);
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        swipeRefresh.addView(webView);
        swipeRefresh.setOnRefreshListener(() -> {
            if (webView != null) webView.reload();
            else swipeRefresh.setRefreshing(false);
        });
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> webView != null && webView.getScrollY() > 0);
        setContentView(swipeRefresh);
        webView.loadUrl(START_URL);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private boolean handleAppIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        if (OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) {
            if (webView != null) webView.loadUrl(START_URL);
            return true;
        }
        return false;
    }

    private boolean handleWebViewUrl(String url) {
        if (url == null) return false;
        Uri data = Uri.parse(url);
        if (!SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        return handleAppIntent(new Intent(Intent.ACTION_VIEW, data));
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
