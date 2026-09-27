"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = { id:string; firstName?:string; lastName?:string; name?:string };
type Card = { id:string; customerId:string; cardholderName:string; last4:string; cardNetwork?:string|null; expiryMonth?:number|null; expiryYear?:number|null; status:string; hasFrontAttachment?:boolean; hasBackAttachment?:boolean; hasReusableAuthorization?:boolean };

const unwrap=(v:any)=>Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.customers)?v.customers:[];
const fullName=(c:Customer)=>c.name||[c.firstName,c.lastName].filter(Boolean).join(" ")||c.id;

function readImage(file:File){
  return new Promise<{data:string;mime:string}>((resolve,reject)=>{
    const allowed=["image/jpeg","image/png","image/webp"];
    if(!allowed.includes(file.type))return reject(new Error("Use JPEG, PNG, or WebP images."));
    if(file.size>5*1024*1024)return reject(new Error("Each card image must be 5 MB or smaller."));
    const reader=new FileReader();
    reader.onload=()=>resolve({data:String(reader.result),mime:file.type});
    reader.onerror=()=>reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

export default function AtmCardsPage(){
  const {user,loading:authLoading}=useAuth();
  const [customerId,setCustomerId]=useState("");
  const [search,setSearch]=useState("");
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [cards,setCards]=useState<Card[]>([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [depositing,setDepositing]=useState(false);
  const [message,setMessage]=useState("");
  const [cardholderName,setCardholderName]=useState("");
  const [cardNumber,setCardNumber]=useState("");
  const [cvv,setCvv]=useState("");
  const [network,setNetwork]=useState("VISA");
  const [month,setMonth]=useState("");
  const [year,setYear]=useState("");
  const [amount,setAmount]=useState("");
  const [selectedCardId,setSelectedCardId]=useState("");
  const [front,setFront]=useState<any>(null);
  const [back,setBack]=useState<any>(null);
  const isCustomer=user?.role==="CUSTOMER";

  const loadCards=async(id:string)=>{
    if(!id)return;
    setLoading(true);
    try{setCards(unwrap(await pwfbApi.banking.atmCards(id)));}catch(e:any){setMessage(e?.message||"Could not load ATM cards.");}
    finally{setLoading(false);}
  };

  useEffect(()=>{
    if(!authLoading&&isCustomer)pwfbApi.customers.me().then((v:any)=>{
      const id=String(v?.id||v?.customerId||v?.data?.id||"");setCustomerId(id);loadCards(id);
    }).catch(()=>{});
  },[authLoading,isCustomer]);

  useEffect(()=>{
    if(isCustomer||!search.trim())return;
    const timer=setTimeout(()=>pwfbApi.customers.search(search.trim()).then((v:any)=>setCustomers(unwrap(v))).catch(()=>setCustomers([])),250);
    return()=>clearTimeout(timer);
  },[search,isCustomer]);

  const selectedCard=cards.find(c=>c.id===selectedCardId);

  const submitAttachment=async()=>{
    setMessage("");
    if(!customerId)return setMessage("Select a customer first.");
    if(!cardholderName.trim())return setMessage("Enter the cardholder name.");
    if(cardNumber&&!/^\d{12,19}$/.test(cardNumber.replace(/\D/g,"")))return setMessage("Enter a valid card number.");
    if(!/^\d{4}$/.test(cardNumber.replace(/\D/g,""))&&cardNumber)return;
    if(!front&&!back)return setMessage("Attach at least the front or back of the card.");
    setSaving(true);
    try{
      await pwfbApi.banking.addAtmCard(customerId,{cardholderName:cardholderName.trim(),last4:cardNumber.replace(/\D/g,"").slice(-4),cardNetwork:network,expiryMonth:month?Number(month):null,expiryYear:year?Number(year):null,frontImage:front?.data||null,frontMimeType:front?.mime||null,backImage:back?.data||null,backMimeType:back?.mime||null});
      setMessage("ATM card attached successfully. The full card number and CVV were not stored.");
      setCardNumber("");setCvv("");setFront(null);setBack(null);setMonth("");setYear("");
      await loadCards(customerId);
    }catch(e:any){setMessage(e?.message||"ATM card could not be attached.");}
    finally{setSaving(false);}
  };

  const deposit=async()=>{
    setMessage("");
    if(!customerId)return setMessage("Select a customer first.");
    const numeric=Number(amount);
    if(!Number.isFinite(numeric)||numeric<=0)return setMessage("Enter a valid deposit amount.");
    if(!selectedCard)return setMessage("Select an attached ATM card.");
    setDepositing(true);
    try{
      let result:any;
      if(selectedCard.hasReusableAuthorization){
        result=await pwfbApi.banking.chargeSavedAtmCard(customerId,{cardId:selectedCard.id,amount:numeric});
      }else{
        const number=cardNumber.replace(/\D/g,"");
        if(!/^\d{12,19}$/.test(number))throw new Error("Enter the full card number for the first card deposit.");
        if(!/^\d{3,4}$/.test(cvv))throw new Error("Enter the CVV for the card authorization.");
        if(!month||!year)throw new Error("Enter the card expiry date.");
        result=await pwfbApi.banking.chargeAtmCard(customerId,{amount:numeric,cardId:selectedCard.id,card:{number,cvv,expiryMonth:month,expiryYear:year,cardholderName:selectedCard.cardholderName}});
      }
      if(result?.status==="success"){
        setMessage("Card deposit authorized and credited to the customer's PWFB wallet.");
        setAmount("");setCvv("");setCardNumber("");
        await loadCards(customerId);
      }else{
        setMessage(result?.message||"The card provider requires additional authorization. Follow the provider instruction and verify the payment.");
      }
    }catch(e:any){setMessage(e?.message||"Card deposit failed. The customer wallet was not credited unless payment was successfully authorized.");}
    finally{setDepositing(false);}
  };

  const openAttachment=async(card:Card,side:"front"|"back")=>{
    try{
      const v:any=await pwfbApi.banking.atmAttachment(card.customerId,card.id,side);
      if(v?.data&&v?.mimeType){const w=window.open();if(w)w.document.write('<img src="data:'+v.mimeType+';base64,'+v.data+'" style="max-width:100%;height:auto" />');}
    }catch(e:any){setMessage(e?.message||"Attachment could not be opened.");}
  };

  if(authLoading)return <main className="pwfb-content"><p>Checking authentication...</p></main>;

  return <main className="pwfb-content"><div className="atm-page">
    <header className="atm-header"><div><p className="atm-eyebrow">BANKING • CARD MANAGEMENT</p><h1>ATM Cards</h1><p>Attach customer cards and use a secure Paystack authorization to fund the customer's PWFB wallet.</p></div><div className="atm-mark">ATM</div></header>

    <section className="atm-panel">
      {!isCustomer&&<label className="atm-label">Customer search<input className="atm-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or customer ID"/>{customers.length>0&&<div className="atm-results">{customers.slice(0,6).map(c=><button className="atm-result" key={c.id} onClick={()=>{setCustomerId(c.id);setSearch(fullName(c)+" • "+c.id);setCardholderName(fullName(c));loadCards(c.id);}}>{fullName(c)} <small>{c.id}</small></button>)}</div>}</label>}

      <div className="atm-fields">
        <label className="atm-label">Cardholder name<input className="atm-input" value={cardholderName} onChange={e=>setCardholderName(e.target.value)} placeholder="Name printed on card"/></label>
        <label className="atm-label">Full card number<input className="atm-input" value={cardNumber} maxLength={19} inputMode="numeric" autoComplete="cc-number" onChange={e=>setCardNumber(e.target.value.replace(/\D/g,"").slice(0,19))} placeholder="Card number — not stored"/></label>
        <label className="atm-label">CVV<input className="atm-input" value={cvv} maxLength={4} inputMode="numeric" autoComplete="cc-csc" type="password" onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="3 or 4 digits — never stored"/></label>
        <label className="atm-label">Card network<select className="atm-input" value={network} onChange={e=>setNetwork(e.target.value)}><option>VISA</option><option>MASTERCARD</option><option>VERVE</option><option>OTHER</option></select></label>
        <label className="atm-label">Expiry month<input className="atm-input" value={month} maxLength={2} inputMode="numeric" onChange={e=>setMonth(e.target.value.replace(/\D/g,"").slice(0,2))} placeholder="MM"/></label>
        <label className="atm-label">Expiry year<input className="atm-input" value={year} maxLength={4} inputMode="numeric" onChange={e=>setYear(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="YYYY"/></label>
      </div>

      <div className="atm-security"><b>Payment security:</b> CVV and the full card number are used only for Paystack authorization and are not saved in PWFB. After a successful authorization, PWFB may save only the provider's reusable authorization token so the attached card can be charged again without retaining CVV.</div>

      <div className="atm-attachments">
        <label className="atm-drop"><b>Front attachment</b><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>e.target.files?.[0]&&readImage(e.target.files[0]).then(setFront).catch((e:any)=>setMessage(e.message))}/>{front?<img src={front.data} alt="ATM card front preview"/>:<small>JPEG, PNG or WebP • max 5 MB</small>}</label>
        <label className="atm-drop"><b>Back attachment</b><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>e.target.files?.[0]&&readImage(e.target.files[0]).then(setBack).catch((e:any)=>setMessage(e.message))}/>{back?<img src={back.data} alt="ATM card back preview"/>:<small>JPEG, PNG or WebP • max 5 MB</small>}</label>
      </div>
      {message&&<p className={message.includes("success")||message.includes("credited")?"atm-ok":"atm-error"}>{message}</p>}
      <button className="atm-submit" disabled={saving} onClick={submitAttachment}>{saving?"Attaching…":"Attach ATM Card"}</button>
    </section>

    <section className="atm-panel">
      <h2>Deposit with Attached ATM Card</h2>
      <div className="atm-fields">
        <label className="atm-label">Attached card<select className="atm-input" value={selectedCardId} onChange={e=>{setSelectedCardId(e.target.value);const c=cards.find(x=>x.id===e.target.value);if(c){setCardholderName(c.cardholderName);setNetwork(c.cardNetwork||"VISA");}}}><option value="">Select card</option>{cards.map(c=><option key={c.id} value={c.id}>•••• {c.last4} • {c.cardNetwork||"CARD"}{c.hasReusableAuthorization?" • Ready for deposit":""}</option>)}</select></label>
        <label className="atm-label">Deposit amount (NGN)<input className="atm-input" value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))} placeholder="0.00"/></label>
      </div>
      {selectedCard&&!selectedCard.hasReusableAuthorization&&<p className="atm-muted">This attached card has not completed a first card authorization. Enter the full card number, expiry and CVV above for the first deposit. CVV will not be stored.</p>}
      <button className="atm-submit" disabled={depositing||!selectedCard} onClick={deposit}>{depositing?"Processing card payment…":"Deposit with ATM Card"}</button>
    </section>

    <section className="atm-panel"><h2>Attached Cards</h2>{loading?<p>Loading cards…</p>:cards.length===0?<p className="atm-muted">No ATM card attached for the selected customer.</p>:cards.map(card=><div className="atm-card-row" key={card.id}><div><b>{card.cardholderName}</b><div className="atm-muted">{card.cardNetwork||"Card"} •••• {card.last4}{card.expiryMonth&&card.expiryYear?" • "+String(card.expiryMonth).padStart(2,"0")+"/"+card.expiryYear:""} • {card.status}{card.hasReusableAuthorization?" • payment ready":""}</div></div><div className="atm-actions">{card.hasFrontAttachment&&<button onClick={()=>openAttachment(card,"front")}>Front</button>}{card.hasBackAttachment&&<button onClick={()=>openAttachment(card,"back")}>Back</button>}<button className="danger" onClick={async()=>{if(confirm("Remove this ATM card record?")){await pwfbApi.banking.removeAtmCard(card.customerId,card.id);setCards(x=>x.filter(c=>c.id!==card.id));if(selectedCardId===card.id)setSelectedCardId("");}}}>Remove</button></div></div>)}</section>
  </div></main>;
}
