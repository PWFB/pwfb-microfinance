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
    private static final String START_URL="https://pwfb-frontend.onrender.com/login";
    private static final String DASHBOARD_URL="https://pwfb-frontend.onrender.com/dashboard";
    private static final String SCHEME="pwfb";
    private static final String OPEN_APP_HOST="open-app";
    private static final String OPEN_CHROME_HOST="open-chrome";
    private static final int DEEP_GREEN=Color.rgb(5,78,34),GREEN=Color.rgb(8,117,52),ORANGE=Color.rgb(244,119,18);
    private SwipeRefreshLayout swipeRefresh;
    private WebView webView;
    private String pendingNativeToken;
    private boolean nativeLoginRedirected;

    @Override protected void onCreate(Bundle b){
        SplashScreen.installSplashScreen(this); super.onCreate(b);
        getWindow().setStatusBarColor(DEEP_GREEN); getWindow().setNavigationBarColor(DEEP_GREEN);
        getWindow().getDecorView().setSystemUiVisibility(0);
        Intent i=getIntent();
        pendingNativeToken=i==null?null:i.getStringExtra("app_token");
        if((pendingNativeToken==null||pendingNativeToken.trim().isEmpty())&&i!=null) pendingNativeToken=extractToken(i);
        buildWebApp();
    }

    @Override protected void onNewIntent(Intent i){
        super.onNewIntent(i); setIntent(i);
        String t=i==null?null:i.getStringExtra("app_token");
        if(t==null||t.trim().isEmpty()) t=extractToken(i);
        if(t!=null&&!t.trim().isEmpty()){
            pendingNativeToken=t;
            nativeLoginRedirected=false;
            if(webView!=null) handoffTokenToWebApp();
            return;
        }
        if(handleAppIntent(i)) return;
        if(webView!=null) webView.loadUrl(START_URL);
    }

    private void buildWebApp(){
        swipeRefresh=new SwipeRefreshLayout(this);
        swipeRefresh.setLayoutParams(new ViewGroup.LayoutParams(-1,-1));
        swipeRefresh.setColorSchemeColors(GREEN,ORANGE);
        swipeRefresh.setProgressBackgroundColorSchemeColor(Color.WHITE);
        webView=new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(-1,-1));
        WebSettings s=webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false); s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView,false);
        webView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return handleWebViewUrl(r.getUrl().toString());}
            @Override public boolean shouldOverrideUrlLoading(WebView v,String u){return handleWebViewUrl(u);}
            @Override public void onPageFinished(WebView v,String u){
                if(swipeRefresh!=null)swipeRefresh.setRefreshing(false);
                continueNativeLogin(v,u);
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        swipeRefresh.addView(webView);
        swipeRefresh.setOnRefreshListener(()->{if(webView!=null)webView.reload();});
        setContentView(swipeRefresh);
        webView.loadUrl(START_URL);
    }

    private void continueNativeLogin(WebView v,String u){
        if(nativeLoginRedirected||pendingNativeToken==null||pendingNativeToken.trim().isEmpty()) return;
        Uri x=Uri.parse(u==null?"":u);
        if(!"pwfb-frontend.onrender.com".equalsIgnoreCase(x.getHost())) return;
        if(!"/".equals(x.getPath())&&!"/login".equals(x.getPath())) return;
        handoffTokenToWebApp();
    }

    private void handoffTokenToWebApp(){
        if(webView==null||pendingNativeToken==null||pendingNativeToken.trim().isEmpty()||nativeLoginRedirected) return;
        String t=pendingNativeToken.replace("\\","\\\\").replace("'","\\'").replace("\n","\\n").replace("\r","\\r");
        nativeLoginRedirected=true;
        String dashboard=jsString(DASHBOARD_URL);
        webView.evaluateJavascript(
            "(function(){"+
            "localStorage.setItem('token','"+t+"');"+
            "localStorage.setItem('access_token','"+t+"');"+
            "sessionStorage.setItem('token','"+t+"');"+
            "sessionStorage.setItem('access_token','"+t+"');"+
            "window.location.replace("+dashboard+");"+
            "})();",
            value->{ }
        );
    }

    private String jsString(String value){
        return "'"+value.replace("\\","\\\\").replace("'","\\'").replace("\n","\\n").replace("\r","\\r")+"'";
    }

    private String extractToken(Intent i){
        try{
            Uri d=i==null?null:i.getData();
            if(d==null||!SCHEME.equalsIgnoreCase(d.getScheme())||!OPEN_APP_HOST.equalsIgnoreCase(d.getHost())) return null;
            String t=d.getQueryParameter("app_token");
            if(t!=null&&!t.isEmpty()) return t;
            String u=d.getQueryParameter("url");
            if(u==null||u.isEmpty()) return null;
            Uri target=Uri.parse(u);
            String f=target.getEncodedFragment();
            if(f==null||f.isEmpty()) return null;
            String raw=f.startsWith("#")?f.substring(1):f;
            String parsed=new android.net.UrlQuerySanitizer(raw).getValue("app_token");
            return parsed==null?null:Uri.decode(parsed);
        }catch(Exception e){return null;}
    }

    private boolean handleAppIntent(Intent i){
        Uri d=i==null?null:i.getData();
        if(d==null||!SCHEME.equalsIgnoreCase(d.getScheme())) return false;
        if(OPEN_APP_HOST.equalsIgnoreCase(d.getHost())){
            String t=d.getQueryParameter("app_token");
            if(t!=null&&!t.trim().isEmpty()){
                pendingNativeToken=t;
                nativeLoginRedirected=false;
            }
            if(webView!=null){
                if(pendingNativeToken!=null&&!pendingNativeToken.trim().isEmpty()) handoffTokenToWebApp();
                else webView.loadUrl(START_URL);
            }
            return true;
        }
        if(OPEN_CHROME_HOST.equalsIgnoreCase(d.getHost())){
            String u=d.getQueryParameter("url"); if(u==null||u.isEmpty()) u=START_URL;
            try{
                Uri x=Uri.parse(u); Intent c=new Intent(Intent.ACTION_VIEW,x); c.setPackage("com.android.chrome");
                try{startActivity(c);}catch(Exception e){startActivity(new Intent(Intent.ACTION_VIEW,x));}
            }catch(Exception e){}
            return true;
        }
        return true;
    }

    private boolean handleWebViewUrl(String u){
        if(u==null) return false;
        Uri d=Uri.parse(u);
        return SCHEME.equalsIgnoreCase(d.getScheme())&&handleAppIntent(new Intent(Intent.ACTION_VIEW,d));
    }

    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack()){webView.goBack();return;}super.onBackPressed();}
}
