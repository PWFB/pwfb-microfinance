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
    private static final String LOGIN_URL = "https://pwfb-frontend.onrender.com/login";
    private static final String DASHBOARD_URL = "https://pwfb-frontend.onrender.com/dashboard";
    private static final String CUSTOMER_DASHBOARD_URL = "https://pwfb-frontend.onrender.com/customer-dashboard";
    private static final String STAFF_DASHBOARD_URL = "https://pwfb-frontend.onrender.com/staff-dashboard";
    private static final String BACKEND_PROFILE_URL = "https://pwfb-backend.onrender.com/auth/profile";
    private static final String FRONTEND_HOST = "pwfb-frontend.onrender.com";
    private static final String SCHEME = "pwfb";
    private static final String OPEN_APP_HOST = "open-app";
    private static final String OPEN_CHROME_HOST = "open-chrome";
    private static final int DEEP_GREEN = Color.rgb(5, 78, 34);
    private static final int GREEN = Color.rgb(8, 117, 52);
    private static final int ORANGE = Color.rgb(244, 119, 18);
    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;
    private String pendingNativeToken;
    private boolean nativeLoginStarted;

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
            nativeLoginStarted = false;
            if (webView != null) {
                webView.stopLoading();
                webView.loadUrl(DASHBOARD_URL);
            }
            return;
        }
        if (handleAppIntent(intent)) return;
        if (webView != null) webView.loadUrl(LOGIN_URL);
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
        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true);
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
        });
        webView.setWebChromeClient(new WebChromeClient());
        swipeRefresh.addView(webView);
        swipeRefresh.setOnRefreshListener(() -> webView.reload());
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> webView.getScrollY() > 0);
        setContentView(swipeRefresh);
        // A native token is authoritative. Never begin at the old login page after successful native auth.
        webView.loadUrl(isBlank(pendingNativeToken) ? LOGIN_URL : DASHBOARD_URL);
    }

    private void continueNativeLogin(WebView view, String url) {
        if (nativeLoginStarted || isBlank(pendingNativeToken)) return;
        try {
            Uri current = Uri.parse(url == null ? "" : url);
            if (!FRONTEND_HOST.equalsIgnoreCase(current.getHost())) return;
        } catch (Exception ignored) { return; }

        nativeLoginStarted = true;
        String token = escapeJs(pendingNativeToken);
        String script = "(function(){" +
                "var token='" + token + "';" +
                "try{window.localStorage.setItem('token',token);window.localStorage.setItem('access_token',token);" +
                "window.sessionStorage.setItem('token',token);window.sessionStorage.setItem('access_token',token);}catch(e){}" +
                "fetch('" + BACKEND_PROFILE_URL + "',{headers:{Authorization:'Bearer '+token}})" +
                ".then(function(r){if(!r.ok)throw new Error('profile');return r.json();})" +
                ".then(function(profile){" +
                "var role=String((profile&&profile.role)||((profile&&profile.user)&&profile.user.role)||'').toUpperCase();" +
                "var destination=role==='CUSTOMER'?'" + CUSTOMER_DASHBOARD_URL + "':(role==='SUPER_ADMIN'?'" + DASHBOARD_URL + "':'" + STAFF_DASHBOARD_URL + "');" +
                "window.location.replace(destination+'?nativeApp=1');" +
                "})" +
                ".catch(function(){window.localStorage.removeItem('token');window.sessionStorage.removeItem('token');window.location.replace('" + LOGIN_URL + "');});" +
                "})();";
        view.evaluateJavascript(script, null);
    }

    private String escapeJs(String value) {
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

    private boolean handleAppIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !SCHEME.equalsIgnoreCase(data.getScheme())) return false;
        if (OPEN_APP_HOST.equalsIgnoreCase(data.getHost())) {
            String token = extractTokenFromAppIntent(intent);
            if (!isBlank(token)) {
                pendingNativeToken = token;
                nativeLoginStarted = false;
                if (webView != null) webView.loadUrl(DASHBOARD_URL);
            }
            return true;
        }
        if (OPEN_CHROME_HOST.equalsIgnoreCase(data.getHost())) {
            String target = data.getQueryParameter("url");
            if (isBlank(target)) target = LOGIN_URL;
            try {
                Uri targetUri = Uri.parse(target);
                if (("http".equalsIgnoreCase(targetUri.getScheme()) || "https".equalsIgnoreCase(targetUri.getScheme())) && FRONTEND_HOST.equalsIgnoreCase(targetUri.getHost()) && webView != null) webView.loadUrl(targetUri.toString());
            } catch (Exception ignored) { }
            return true;
        }
        return true;
    }

    private boolean handleWebViewUrl(String url) {
        if (url == null) return false;
        try {
            Uri data = Uri.parse(url);
            if (!SCHEME.equalsIgnoreCase(data.getScheme())) return false;
            return handleAppIntent(new Intent(Intent.ACTION_VIEW, data));
        } catch (Exception ignored) { return true; }
    }

    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) { webView.goBack(); return; } super.onBackPressed(); }

    @Override protected void onDestroy() {
        if (webView != null) { webView.stopLoading(); webView.setWebChromeClient(null); webView.setWebViewClient(null); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
