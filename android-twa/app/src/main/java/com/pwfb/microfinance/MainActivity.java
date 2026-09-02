package com.pwfb.microfinance;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.ViewGroup;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.TrustedWebUtils;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends Activity {
    private static final String START_URL = "https://pwfb-frontend.onrender.com/";
    private static final String OPEN_CHROME_SCHEME = "pwfb";
    private static final String OPEN_CHROME_HOST = "open-chrome";
    private static final long STARTUP_SPLASH_MS = 1800L;
    private static final long TWA_FALLBACK_MS = 2200L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean fallbackShown = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        final long splashUntil = System.currentTimeMillis() + STARTUP_SPLASH_MS;
        splashScreen.setKeepOnScreenCondition(() -> System.currentTimeMillis() < splashUntil);
        super.onCreate(savedInstanceState);

        if (handleChromeIntent(getIntent())) return;
        launchTrustedWebActivity(Uri.parse(START_URL));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (handleChromeIntent(intent)) return;
        fallbackShown = false;
        launchTrustedWebActivity(Uri.parse(START_URL));
    }

    private boolean handleChromeIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !OPEN_CHROME_SCHEME.equalsIgnoreCase(data.getScheme())
                || !OPEN_CHROME_HOST.equalsIgnoreCase(data.getHost())) return false;

        String target = data.getQueryParameter("url");
        if (target == null || target.trim().isEmpty()) return false;
        try {
            Uri uri = Uri.parse(target);
            if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
            Intent chrome = new Intent(Intent.ACTION_VIEW, uri);
            chrome.setPackage("com.android.chrome");
            chrome.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(chrome);
            finish();
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void launchTrustedWebActivity(Uri uri) {
        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder().build();
        customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            TrustedWebUtils.launchAsTrustedWebActivity(this, customTabsIntent, uri);
            handler.postDelayed(() -> {
                if (!isFinishing() && !fallbackShown) showInAppWebView(uri);
            }, TWA_FALLBACK_MS);
        } catch (Exception error) {
            showInAppWebView(uri);
        }
    }

    private void showInAppWebView(Uri uri) {
        if (fallbackShown || isFinishing()) return;
        fallbackShown = true;
        WebView webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadsImagesAutomatically(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);
        webView.loadUrl(uri.toString());
    }

    @Override
    public void onBackPressed() {
        ViewGroup root = findViewById(android.R.id.content);
        if (fallbackShown && root != null && root.getChildCount() > 0
                && root.getChildAt(0) instanceof WebView) {
            WebView webView = (WebView) root.getChildAt(0);
            if (webView.canGoBack()) {
                webView.goBack();
                return;
            }
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
