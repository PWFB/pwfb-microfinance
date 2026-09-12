"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { apiRequest } from "../../../lib/api";

declare global {
  interface Window {
    PWFBNative?: {
      signInWithGoogle?: () => void;
      registerPasskey: (replaceExisting: boolean, token: string) => void;
    };
    __pwfbNativePasskeyStatus?: (message: string) => void;
    __pwfbNativePasskeyResult?: (payload: { ok: boolean; message?: string; result?: any }) => void;
  }
}

export default function RegisterPasskeyPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || sessionStorage.getItem("token") || "" : "";

  const register = async () => {
    setError(""); setMessage(""); setLoading(true);
    try {
      if (!token) throw new Error("Please sign in first before registering a fingerprint.");
      if (window.PWFBNative?.registerPasskey) {
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => { if (!done) { done = true; resolve(); } };
          window.__pwfbNativePasskeyStatus = (text) => setMessage(text);
          window.__pwfbNativePasskeyResult = (payload) => {
            if (payload?.ok) setMessage("Fingerprint saved successfully on this device.");
            else setError(payload?.message || "Fingerprint registration failed.");
            finish();
          };
          window.PWFBNative!.registerPasskey(true, token);
          window.setTimeout(finish, 30000);
        });
        return;
      }
      if (!("credentials" in navigator) || !("PublicKeyCredential" in window)) throw new Error("Fingerprint authentication is not available on this device.");
      await apiRequest("/auth/passkey/unregister-all", { method: "POST" });
      const options = await apiRequest("/auth/passkey/register/options", { method: "POST", body: JSON.stringify({ replaceExisting: true }) });
      const credential = await startRegistration({ optionsJSON: options });
      await apiRequest("/auth/passkey/register/verify", { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) });
      setMessage("Fingerprint saved successfully on this device.");
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Fingerprint registration failed.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    window.__pwfbNativePasskeyStatus = (text) => setMessage(text);
    window.__pwfbNativePasskeyResult = (payload) => payload?.ok ? setMessage("Fingerprint saved successfully on this device.") : setError(payload?.message || "Fingerprint registration failed.");
    return () => { delete window.__pwfbNativePasskeyStatus; delete window.__pwfbNativePasskeyResult; };
  }, []);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f2f7f4",padding:24,fontFamily:"system-ui"}}><section style={{width:"min(520px,100%)",background:"#fff",borderRadius:24,padding:34,boxShadow:"0 20px 60px #063b1820"}}><div style={{fontSize:11,fontWeight:900,letterSpacing:2,color:"#f47712"}}>PWFB SECURITY</div><h1 style={{color:"#075e2c",margin:"8px 0"}}>Register this fingerprint</h1><p style={{color:"#65716a",lineHeight:1.6,fontSize:14}}>Your Gmail/password login identifies your PWFB account. Your fingerprint is then saved securely on this device so you can use <b>Use fingerprint</b> on the next login without entering Gmail first.</p>{message&&<div style={{padding:12,background:"#eaf7ef",color:"#075e2c",borderRadius:10,margin:"18px 0",fontSize:13}}>{message}</div>}{error&&<div style={{padding:12,background:"#fff1ea",color:"#9a4500",borderRadius:10,margin:"18px 0",fontSize:13}}>{error}</div>}<button onClick={register} disabled={loading} style={{width:"100%",height:52,border:0,borderRadius:10,background:"#087534",color:"white",fontWeight:900,borderBottom:"4px solid #f47712"}}>{loading?"Saving fingerprint…":"Register Fresh Fingerprint"}</button></section></main>;
}
