"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = { id:string; firstName?:string; lastName?:string; name?:string };
type Card = { id:string; customerId:string; cardholderName:string; last4:string; cardNetwork?:string|null; expiryMonth?:number|null; expiryYear?:number|null; status:string; hasFrontAttachment?:boolean; hasBackAttachment?:boolean; hasReusableAuthorization?:boolean };

const unwrap=(v:any)=>Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.customers)?v.customers:[];
const fullName=(c:Customer)=>c.name||[c.firstName,c.lastName].filter(Boolean).join(" ")||c.id;

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
  const [last4,setLast4]=useState("");
  const [cvv,setCvv]=useState("");
  const [network,setNetwork]=useState("VISA");
  const [month,setMonth]=useState("");
  const [year,setYear]=useState("");
  const [amount,setAmount]=useState("");
  const [selectedCardId,setSelectedCardId]=useState("");
  const isCustomer=user?.role==="CUSTOMER";

  const loadCards=async(id:string)=>{
    if(!id)return;
    setLoading(true);
    try{setCards(unwrap(await pwfbApi.banking.atmCards(id)));}catch(e:any){setMessage(e?.message||"Could not load ATM cards.");}
    finally{setLoading(false);}
  };

  useEffect(()=>{
    if(!authLoading&&isCustomer)pwfbApi.customers.me().then((v:any)=>{
      const profile=v?.data??v;const id=String(profile?.id||profile?.customerId||"");setCustomerId(id);setCardholderName(fullName(profile));loadCards(id);
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
    if(!cardholderName.trim())return setMessage("Select a registered customer so PWFB can verify the name.");
    if(!/^\d{4}$/.test(last4))return setMessage("Enter the last four digits of the ATM card.");
    if(!month||!year)return setMessage("Enter the card expiry month and year.");
    setSaving(true);
    try{
      await pwfbApi.banking.addAtmCard(customerId,{cardholderName:cardholderName.trim(),last4,cardNetwork:network,expiryMonth:Number(month),expiryYear:Number(year)});
      setMessage("ATM card attached. Customer name was matched to the registered PWFB profile; no card images, full card number, or CVV were stored.");
      setLast4("");setCardNumber("");setCvv("");setMonth("");setYear("");
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

  if(authLoading)return <main className="pwfb-content"><p>Checking authentication...</p></main>;

  return <main className="pwfb-content"><div className="atm-page">
    <header className="atm-header"><div><p className="atm-eyebrow">BANKING • CARD MANAGEMENT</p><h1>ATM Cards</h1><p>Attach customer cards and use a secure Paystack authorization to fund the customer's PWFB wallet.</p></div><div className="atm-mark">ATM</div></header>

    <section className="atm-panel">
      {!isCustomer&&<label className="atm-label">Customer search<input className="atm-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or customer ID"/>{customers.length>0&&<div className="atm-results">{customers.slice(0,6).map(c=><button className="atm-result" key={c.id} onClick={()=>{setCustomerId(c.id);setSearch(fullName(c)+" • "+c.id);setCardholderName(fullName(c));loadCards(c.id);}}>{fullName(c)} <small>{c.id}</small></button>)}</div>}</label>}

      <div className="atm-fields">
        <label className="atm-label">Verified customer name<input className="atm-input" value={cardholderName} readOnly aria-readonly="true" placeholder="Select a registered PWFB customer"/></label>
        <label className="atm-label">Last four digits<input className="atm-input" value={last4} maxLength={4} inputMode="numeric" onChange={e=>setLast4(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="1234"/></label>
        <label className="atm-label">Card network<select className="atm-input" value={network} onChange={e=>setNetwork(e.target.value)}><option>VISA</option><option>MASTERCARD</option><option>VERVE</option><option>OTHER</option></select></label>
        <label className="atm-label">Expiry month<input className="atm-input" value={month} maxLength={2} inputMode="numeric" onChange={e=>setMonth(e.target.value.replace(/\D/g,"").slice(0,2))} placeholder="MM"/></label>
        <label className="atm-label">Expiry year<input className="atm-input" value={year} maxLength={4} inputMode="numeric" onChange={e=>setYear(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="YYYY"/></label>
      </div>

      <div className="atm-security"><b>Automatic customer-name verification:</b> the cardholder name is populated from the selected customer's registered PWFB profile and cannot be edited here. Card images are not required. Full card details and CVV are requested only if a first card payment needs provider authorization; they are not stored by PWFB.</div>
      {message&&<p className={message.includes("success")||message.includes("credited")?"atm-ok":"atm-error"}>{message}</p>}
      <button className="atm-submit" disabled={saving} onClick={submitAttachment}>{saving?"Attaching…":"Attach ATM Card"}</button>
    </section>

    <section className="atm-panel">
      <h2>Deposit with Attached ATM Card</h2>
      {!selectedCard?.hasReusableAuthorization&&<div className="atm-fields"><label className="atm-label">Card number (first deposit only)<input className="atm-input" value={cardNumber} maxLength={19} inputMode="numeric" autoComplete="cc-number" onChange={e=>setCardNumber(e.target.value.replace(/\D/g,"").slice(0,19))} placeholder="Card number — not stored"/></label><label className="atm-label">CVV (first deposit only)<input className="atm-input" value={cvv} maxLength={4} inputMode="numeric" autoComplete="cc-csc" type="password" onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="3 or 4 digits — never stored"/></label><label className="atm-label">Expiry month<input className="atm-input" value={month} maxLength={2} inputMode="numeric" onChange={e=>setMonth(e.target.value.replace(/\D/g,"").slice(0,2))} placeholder="MM"/></label><label className="atm-label">Expiry year<input className="atm-input" value={year} maxLength={4} inputMode="numeric" onChange={e=>setYear(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="YYYY"/></label></div>}
      <div className="atm-fields">
        <label className="atm-label">Attached card<select className="atm-input" value={selectedCardId} onChange={e=>{setSelectedCardId(e.target.value);const c=cards.find(x=>x.id===e.target.value);if(c){setCardholderName(c.cardholderName);setNetwork(c.cardNetwork||"VISA");}}}><option value="">Select card</option>{cards.map(c=><option key={c.id} value={c.id}>•••• {c.last4} • {c.cardNetwork||"CARD"}{c.hasReusableAuthorization?" • Ready for deposit":""}</option>)}</select></label>
        <label className="atm-label">Deposit amount (NGN)<input className="atm-input" value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))} placeholder="0.00"/></label>
      </div>
      {selectedCard&&!selectedCard.hasReusableAuthorization&&<p className="atm-muted">This attached card has not completed a first provider authorization. For a first deposit only, enter the card number, expiry and CVV above; these details are used for authorization and are not stored by PWFB.</p>}
      <button className="atm-submit" disabled={depositing||!selectedCard} onClick={deposit}>{depositing?"Processing card payment…":"Deposit with ATM Card"}</button>
    </section>

    <section className="atm-panel"><h2>Attached Cards</h2>{loading?<p>Loading cards…</p>:cards.length===0?<p className="atm-muted">No ATM card attached for the selected customer.</p>:cards.map(card=><div className="atm-card-row" key={card.id}><div><b>{card.cardholderName}</b><div className="atm-muted">{card.cardNetwork||"Card"} •••• {card.last4}{card.expiryMonth&&card.expiryYear?" • "+String(card.expiryMonth).padStart(2,"0")+"/"+card.expiryYear:""} • {card.status}{card.hasReusableAuthorization?" • payment ready":""}</div></div><div className="atm-actions"><span className="atm-muted">Customer profile name matched</span><button className="danger" onClick={async()=>{if(confirm("Remove this ATM card record?")){await pwfbApi.banking.removeAtmCard(card.customerId,card.id);setCards(x=>x.filter(c=>c.id!==card.id));if(selectedCardId===card.id)setSelectedCardId("");}}}>Remove</button></div></div>)}</section>
  </div></main>;
}
