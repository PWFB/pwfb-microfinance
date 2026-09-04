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
    private static final String LOGIN_URL = "https://pwfb-frontend.onrender.com/login";
    private static final String DASHBOARD_URL = "https://pwfb-frontend.onrender.com/dashboard";
    private static final String BACKEND_PROFILE_URL = "https://pwfb-backend.onrender.com/auth/profile";
    private static final String SCHEME = "pwfb";
    private static final String OPEN_APP_HOST = "open-app";
    private static final String OPEN_CHROME_HOST = "open-chrome";
    private static final int DEEP_GREEN = Color.rgb(5, 78, 34);
    private static final int GREEN = Color.rgb(8, 117, 52);
    private static final int ORANGE = Color.rgb(244, 119, 18);
    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;
    private String pendingNativeToken;
    private boolean nativeLoginRedirected;

    @Override protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(DEEP_GREEN);
        getWindow().setNavigationBarColor(DEEP_GREEN);
        getWindow().getDecorView().setSystemUiVisibility(0);

        Intent launchIntent = getIntent();
        pendingNativeToken = launchIntent == null ? null : launchIntent.getStringExtra("app_token");
        if (isBlank(pendingNativeToken) && launchIntent != null) pendingNativeToken = extractTokenFromAppIntent(launchIntent);

        if (isBlank(pendingNativeToken)) resetWebSession();
        buildWebApp();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String token = intent == null ? null : intent.getStringExtra("app_token");
        if (isBlank(token)) token = extractTokenFromAppIntent(intent);
        if (!isBlank(token)) {
            pendingNativeToken = token;
            nativeLoginRedirected = false;
            if (webView != null) webView.loadUrl(LOGIN_URL);
            return;
        }
        if (handleAppIntent(intent)) return;
        if (webView != null) webView.loadUrl(START_URL);
    }

    private boolean isBlank(String value) { return value == null || value.trim().isEmpty(); }

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
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return handleWebViewUrl(request.getUrl().toString()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return handleWebViewUrl(url); }
            @Override public void onPageFinished(WebView view, String url) {
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
                continueNativeLogin(view, url);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame() && swipeRefresh != null) swipeRefresh.setRefreshing(false);
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        swipeRefresh.addView(webView);
        swipeRefresh.setOnRefreshListener(() -> { if (webView != null) webView.reload(); else swipeRefresh.setRefreshing(false); });
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> webView != null && webView.getScrollY() > 0);
        setContentView(swipeRefresh);
        webView.loadUrl(isBlank(pendingNativeToken) ? START_URL : LOGIN_URL);
    }

    private void continueNativeLogin(WebView view, String url) {
        if (nativeLoginRedirected || isBlank(pendingNativeToken)) return;
        Uri current;
        try { current = Uri.parse(url == null ? "" : url); } catch (Exception ignored) { return; }
        if (!"pwfb-frontend.onrender.com".equalsIgnoreCase(current.getHost())) return;
        if (!"/".equals(current.getPath()) && !"/login".equals(current.getPath())) return;

        nativeLoginRedirected = true;
        String token = JSONObjectEscape(pendingNativeToken);
        String script = "(function(){" +
                "var token='" + token + "';" +
                "window.localStorage.setItem('token',token);" +
                "fetch('" + BACKEND_PROFILE_URL + "',{headers:{Authorization:'Bearer '+token}})" +
                ".then(function(r){if(!r.ok)throw new Error('profile');return r.json();})" +
                ".then(function(profile){" +
                "var role=profile&&(profile.role||(profile.user&&profile.user.role));" +
                "var destination=role==='CUSTOMER'?'/customer-dashboard':role==='SUPER_ADMIN'?'/dashboard':'/staff-dashboard';" +
                "window.location.replace(destination);" +
                "})" +
                ".catch(function(){window.localStorage.removeItem('token');window.location.replace('" + LOGIN_URL + "');});" +
                "})();";
        view.evaluateJavascript(script, null);
    }

    private String JSONObjectEscape(String value) {
        return value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r");
    }

    private String extractTokenFromAppIntent(Intent intent) {
        try {
            Uri data = intent == null ? null : intent.getData();
            if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme()) || !OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) return null;
            String direct = data.getQueryParameter("app_token");
            if (!isBlank(direct)) return direct;
            String target = data.getQueryParameter("url");
            if (isBlank(target)) return null;
            Uri targetUri = Uri.parse(target);
            String fragment = targetUri.getFragment();
            if (isBlank(fragment)) return null;
            return new android.net.UrlQuerySanitizer(fragment).getValue("app_token");
        } catch (Exception ignored) { return null; }
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private boolean handleAppIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        if (OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) {
            String target = data.getQueryParameter("url");
            if (isBlank(target)) target = START_URL;
            try {
                Uri targetUri = Uri.parse(target);
                if ("http".equalsIgnoreCase(targetUri.getScheme()) || "https".equalsIgnoreCase(targetUri.getScheme())) {
                    if ("pwfb-frontend.onrender.com".equalsIgnoreCase(targetUri.getHost())) {
                        String token = extractTokenFromAppIntent(intent);
                        if (!isBlank(token)) {
                            pendingNativeToken = token;
                            nativeLoginRedirected = false;
                        }
                        if (webView != null) webView.loadUrl(isBlank(pendingNativeToken) ? targetUri.toString() : LOGIN_URL);
                    } else if (webView != null) webView.loadUrl(START_URL);
                }
            } catch (Exception ignored) { if (webView != null) webView.loadUrl(START_URL); }
            return true;
        }
        if (OPEN_CHROME_HOST.equalsIgnoreCase(data.getHost())) {
            String target = data.getQueryParameter("url");
            if (isBlank(target)) target = START_URL;
            try {
                Uri targetUri = Uri.parse(target);
                if ("http".equalsIgnoreCase(targetUri.getScheme()) || "https".equalsIgnoreCase(targetUri.getScheme())) {
                    Intent chromeIntent = new Intent(Intent.ACTION_VIEW, targetUri);
                    chromeIntent.setPackage("com.android.chrome");
                    try { startActivity(chromeIntent); } catch (Exception chromeUnavailable) { startActivity(new Intent(Intent.ACTION_VIEW, targetUri)); }
                }
            } catch (Exception ignored) { }
            return true;
        }
        return true;
    }

    private boolean handleWebViewUrl(String url) {
        if (url == null) return false;
        Uri data = Uri.parse(url);
        if (!SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        return handleAppIntent(new Intent(Intent.ACTION_VIEW, data));
    }

    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) { webView.goBack(); return; } super.onBackPressed(); }

    @Override protected void onDestroy() {
        if (webView != null) { webView.stopLoading(); webView.setWebChromeClient(null); webView.setWebViewClient(null); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
