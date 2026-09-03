package com.pwfb.microfinance;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.annotation.Nullable;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
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

public class NativeAuthActivity extends FragmentActivity {
    private static final String API = "https://pwfb-backend.onrender.com";
    private static final String PREFS = "pwfb_app_auth";
    private static final String TOKEN = "access_token";
    private static final int GOOGLE_REQUEST = 9001;
    private static final int GREEN = Color.rgb(8,117,52);
    private static final int DARK_GREEN = Color.rgb(5,78,34);
    private static final int ORANGE = Color.rgb(244,119,18);
    private EditText email,password;
    private Button login,google,fingerprint;
    private TextView message;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(DARK_GREEN);
        getWindow().setNavigationBarColor(DARK_GREEN);
        getWindow().getDecorView().setSystemUiVisibility(0);
        buildUi();
        if(getSharedPreferences(PREFS,MODE_PRIVATE).contains(TOKEN)){
            fingerprint.setVisibility(View.VISIBLE);
            message.setText("Use your fingerprint to unlock PWFB.");
            new android.os.Handler().postDelayed(this::authenticateWithFingerprint,450);
        }
    }

    private void buildUi(){
        ScrollView scroll=new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(Color.rgb(248,250,249));
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER_HORIZONTAL);

        LinearLayout top=new LinearLayout(this); top.setOrientation(LinearLayout.VERTICAL); top.setGravity(Gravity.CENTER_HORIZONTAL); top.setPadding(dp(22),dp(24),dp(22),dp(22)); top.setBackground(roundSolid(GREEN,0));
        ImageView logo=new ImageView(this); logo.setImageResource(com.pwfb.microfinance.R.drawable.pwfb_icon); logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE); top.addView(logo,new LinearLayout.LayoutParams(dp(82),dp(82)));
        TextView brand=text("PWFB",Color.WHITE,28,Typeface.BOLD,Gravity.CENTER); brand.setLetterSpacing(.06f); add(top,brand,8);
        add(top,text("Perfect Wisdom For Better Ltd",Color.rgb(231,248,237),12,Typeface.BOLD,Gravity.CENTER),3);
        root.addView(top,new LinearLayout.LayoutParams(-1,-2));

        LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(22),dp(24),dp(22),dp(22)); card.setBackground(roundSolid(Color.WHITE,18));
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,-2); cp.setMargins(dp(16),dp(18),dp(16),dp(20));
        add(card,text("Welcome back",Color.rgb(24,45,34),24,Typeface.BOLD,Gravity.CENTER),0);
        add(card,text("Sign in to your PWFB Microfinance account",Color.rgb(105,119,110),13,Typeface.NORMAL,Gravity.CENTER),6);
        email=input("Email address",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS); password=input("Password",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        addView(card,email,54,22); addView(card,password,54,12);
        login=actionButton("Login",GREEN,Color.WHITE); addView(card,login,52,16); login.setOnClickListener(v->passwordLogin());
        add(card,text("OR",Color.rgb(145,154,149),11,Typeface.BOLD,Gravity.CENTER),8);
        google=actionButton("Continue with Google",ORANGE,Color.WHITE); addView(card,google,52,4); google.setOnClickListener(v->googleLogin());
        fingerprint=actionButton("Use fingerprint",Color.WHITE,GREEN); fingerprint.setVisibility(View.GONE); fingerprint.setBackground(borderSolid(Color.WHITE,GREEN,14)); addView(card,fingerprint,52,12); fingerprint.setOnClickListener(v->authenticateWithFingerprint());
        message=text("",Color.rgb(75,94,82),12,Typeface.NORMAL,Gravity.CENTER); message.setPadding(dp(8),dp(14),dp(8),0); card.addView(message,new LinearLayout.LayoutParams(-1,-2));
        add(card,text("Secure app authentication",Color.rgb(122,136,128),11,Typeface.NORMAL,Gravity.CENTER),18);
        root.addView(card,cp);
        add(root,text("Secure  •  Reliable  •  Always With You",Color.rgb(120,136,126),10,Typeface.BOLD,Gravity.CENTER),0);
        scroll.addView(root); setContentView(scroll);
    }

    private void add(LinearLayout p,View v,int top){LinearLayout.LayoutParams q=new LinearLayout.LayoutParams(-1,-2);q.topMargin=dp(top);p.addView(v,q);}
    private void addView(LinearLayout p,View v,int h,int top){LinearLayout.LayoutParams q=new LinearLayout.LayoutParams(-1,dp(h));q.topMargin=dp(top);p.addView(v,q);}
    private EditText input(String hint,int type){EditText e=new EditText(this);e.setHint(hint);e.setTextSize(14);e.setSingleLine(true);e.setInputType(type);e.setTextColor(Color.rgb(35,48,41));e.setHintTextColor(Color.rgb(143,154,148));e.setPadding(dp(16),0,dp(16),0);e.setBackground(borderSolid(Color.WHITE,Color.rgb(213,225,217),13));return e;}
    private Button actionButton(String label,int bg,int fg){Button b=new Button(this);b.setText(label);b.setTextSize(14);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setTextColor(fg);b.setAllCaps(false);b.setGravity(Gravity.CENTER);b.setPadding(dp(10),0,dp(10),0);b.setBackground(roundSolid(bg,13));return b;}
    private TextView text(String value,int color,float size,int style,int gravity){TextView t=new TextView(this);t.setText(value);t.setTextColor(color);t.setTextSize(size);t.setTypeface(Typeface.DEFAULT,style);t.setGravity(gravity);return t;}
    private GradientDrawable roundSolid(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
    private GradientDrawable borderSolid(int fill,int stroke,int radius){GradientDrawable d=roundSolid(fill,radius);d.setStroke(dp(1),stroke);return d;}
    private int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}

    private void passwordLogin(){String e=email.getText().toString().trim(),p=password.getText().toString();if(e.isEmpty()||p.isEmpty()){message.setText("Enter your email and password.");return;}setBusy(true,"Signing in securely…");new Thread(()->{try{JSONObject b=new JSONObject();b.put("email",e);b.put("password",p);JSONObject r=post("/auth/login",b);finishNativeLogin(r.getString("access_token"));}catch(Exception ex){runOnUiThread(()->setBusy(false,ex.getMessage()==null?"Login failed":ex.getMessage()));}}).start();}
    private void googleLogin(){setBusy(true,"Opening secure Google sign-in…");new Thread(()->{try{JSONObject config=get("/auth/google/config");String serverClientId=config.optString("client_id","").trim();if(serverClientId.isEmpty())throw new Exception("Google server client is not configured on PWFB.");runOnUiThread(()->{try{GoogleSignInOptions options=new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).requestIdToken(serverClientId).requestEmail().build();GoogleSignInClient client=GoogleSignIn.getClient(this,options);client.signOut().addOnCompleteListener(task->{try{startActivityForResult(client.getSignInIntent(),GOOGLE_REQUEST);}catch(Exception ex){setBusy(false,"Google sign-in could not start.");}});}catch(Exception ex){setBusy(false,"Google sign-in could not start.");}});}catch(Exception ex){runOnUiThread(()->setBusy(false,ex.getMessage()==null?"Google sign-in failed":ex.getMessage()));}}).start();}
    @Override protected void onActivityResult(int requestCode,int resultCode,@Nullable Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode!=GOOGLE_REQUEST)return;try{Task<GoogleSignInAccount> task=GoogleSignIn.getSignedInAccountFromIntent(data);GoogleSignInAccount account=task.getResult(ApiException.class);if(account==null||account.getIdToken()==null)throw new Exception("Google did not return an ID token.");String idToken=account.getIdToken();new Thread(()->{try{JSONObject b=new JSONObject();b.put("credential",idToken);JSONObject r=post("/auth/google/android",b);finishNativeLogin(r.getString("access_token"));}catch(Exception ex){runOnUiThread(()->setBusy(false,ex.getMessage()==null?"Google authentication failed":ex.getMessage()));}}).start();}catch(ApiException ex){setBusy(false,"Google sign-in error (code "+ex.getStatusCode()+"). Check the PWFB Google configuration.");}catch(Exception ex){setBusy(false,"Google sign-in failed. Please try again.");}}
    private void authenticateWithFingerprint(){String token=getSharedPreferences(PREFS,MODE_PRIVATE).getString(TOKEN,null);if(token==null||token.isEmpty()){message.setText("Sign in with your PWFB password first to enable fingerprint.");return;}Executor executor=ContextCompat.getMainExecutor(this);BiometricPrompt prompt=new BiometricPrompt(this,executor,new BiometricPrompt.AuthenticationCallback(){@Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r){super.onAuthenticationSucceeded(r);launchMain(token);}@Override public void onAuthenticationError(int code,CharSequence err){super.onAuthenticationError(code,err);message.setText("Fingerprint cancelled. You can use your password.");}});BiometricPrompt.PromptInfo info=new BiometricPrompt.PromptInfo.Builder().setTitle("PWFB App Authentication").setSubtitle("Use your fingerprint to unlock this app").setNegativeButtonText("Use password").build();prompt.authenticate(info);}
    private void finishNativeLogin(String token){getSharedPreferences(PREFS,MODE_PRIVATE).edit().putString(TOKEN,token).apply();runOnUiThread(()->{setBusy(false,"Authentication successful.");launchMain(token);});}
    private void launchMain(String token){Intent i=new Intent(this,MainActivity.class);i.putExtra("app_token",token);i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_NEW_TASK);startActivity(i);finish();}
    private void setBusy(boolean busy,String t){login.setEnabled(!busy);google.setEnabled(!busy);password.setEnabled(!busy);email.setEnabled(!busy);message.setText(t);}
    private JSONObject get(String path)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(API+path).openConnection();c.setRequestMethod("GET");c.setConnectTimeout(15000);c.setReadTimeout(20000);return read(c);}
    private JSONObject post(String path,JSONObject body)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(API+path).openConnection();c.setRequestMethod("POST");c.setDoOutput(true);c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setRequestProperty("Content-Type","application/json");byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);try(OutputStream out=c.getOutputStream()){out.write(bytes);}return read(c);}
    private JSONObject read(HttpURLConnection c)throws Exception{int status=c.getResponseCode();java.io.InputStream stream=status>=400?c.getErrorStream():c.getInputStream();StringBuilder s=new StringBuilder();try(BufferedReader r=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null)s.append(line);}JSONObject result=new JSONObject(s.toString());if(status>=400)throw new Exception(result.optString("message","Authentication request failed"));return result;}
}
