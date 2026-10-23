"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = { id:string; firstName?:string; middleName?:string; lastName?:string; name?:string };
type Card = { id:string; customerId:string; cardholderName:string; last4:string; cardNetwork?:string|null; expiryMonth?:number|null; expiryYear?:number|null; status:string; hasFrontAttachment?:boolean; hasBackAttachment?:boolean; hasReusableAuthorization?:boolean };

const unwrap=(v:any)=>Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.customers)?v.customers:[];
const fullName=(c:Customer)=>c.name||[c.firstName,c.middleName,c.lastName].filter(Boolean).join(" ")||c.id;

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
    try{const nextCards=unwrap(await pwfbApi.banking.atmCards(id));setCards(nextCards);setSelectedCardId(current=>nextCards.some((card:Card)=>card.id===current)?current:nextCards[0]?.id||"");}catch(e:any){setMessage(e?.message||"Could not load ATM cards.");}
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
      setMessage("Card reference saved against the registered PWFB customer profile. This does not itself verify card ownership or authorize payments; Paystack must authorize the first payment.");
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
        result=await pwfbApi.banking.chargeAtmCard(customerId,{amount:numeric,cardId:selectedCard.id,card:{number,cvv,expiryMonth:String(selectedCard.expiryMonth??month),expiryYear:String(selectedCard.expiryYear??year),cardholderName:selectedCard.cardholderName}});
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
    <header className="atm-header"><div><p className="atm-eyebrow">BANKING • CARD MANAGEMENT</p><h1>ATM Cards</h1><p>Save a card reference and fund the customer's PWFB wallet through Paystack. Card payments may require provider-managed OTP or 3-D Secure.</p></div><div className="atm-mark">ATM</div></header>

    <section className="atm-panel">
      {!isCustomer&&<label className="atm-label">Customer search<input className="atm-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or customer ID"/>{customers.length>0&&<div className="atm-results">{customers.slice(0,6).map(c=><button className="atm-result" key={c.id} onClick={()=>{setCustomerId(c.id);setSearch(fullName(c)+" • "+c.id);setCardholderName(fullName(c));loadCards(c.id);}}>{fullName(c)} <small>{c.id}</small></button>)}</div>}</label>}

      <div className="atm-fields">
        <label className="atm-label">Registered customer name<input className="atm-input" value={cardholderName} readOnly aria-readonly="true" placeholder="Select a registered PWFB customer"/></label>
        <label className="atm-label">Last four digits<input className="atm-input" value={last4} maxLength={4} inputMode="numeric" onChange={e=>setLast4(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="1234"/></label>
        <label className="atm-label">Card network<select className="atm-input" value={network} onChange={e=>setNetwork(e.target.value)}><option>VISA</option><option>MASTERCARD</option><option>VERVE</option><option>OTHER</option></select></label>
        <label className="atm-label">Expiry month<input className="atm-input" value={month} maxLength={2} inputMode="numeric" onChange={e=>setMonth(e.target.value.replace(/\D/g,"").slice(0,2))} placeholder="MM"/></label>
        <label className="atm-label">Expiry year<input className="atm-input" value={year} maxLength={4} inputMode="numeric" onChange={e=>setYear(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="YYYY"/></label>
      </div>

      <div className="atm-security"><b>Customer profile matching:</b> the name comes from the registered PWFB profile and cannot be edited here. Saving the last four digits does not verify card ownership. For a first payment, Paystack may require card details and additional authorization; PWFB does not request or store an ATM PIN.</div>
      {message&&<p className={message.includes("success")||message.includes("credited")?"atm-ok":"atm-error"}>{message}</p>}
      <button className="atm-submit" disabled={saving} onClick={submitAttachment}>{saving?"Attaching…":"Attach ATM Card"}</button>
    </section>

    <section className="atm-panel">
      <h2>Deposit with Attached ATM Card</h2>
      <p className="atm-muted">Select a saved card. Profile matching is not card verification; Paystack confirms payment authorization.</p>
      {loading?<p>Loading saved cards…</p>:cards.length===0?<p className="atm-muted">No saved card for the selected customer yet.</p>:<div className="atm-saved-cards">{cards.map(card=><div className="atm-card-row" key={card.id}><label className="atm-label" style={{display:"flex",alignItems:"center",gap:10,flex:1}}><input type="radio" name="saved-atm-card" checked={selectedCardId===card.id} onChange={()=>{setSelectedCardId(card.id);setCardholderName(card.cardholderName);setNetwork(card.cardNetwork||"VISA");}}/><span><b>•••• {card.last4} · {card.cardNetwork||"CARD"}</b><span className="atm-muted" style={{display:"block"}}>{card.cardholderName} · {card.hasReusableAuthorization?"Paystack authorization saved":"Authorization required"} · Profile linked</span></span></label><button className="danger" onClick={async()=>{if(confirm("Unlink this saved card reference from the customer profile?")){await pwfbApi.banking.removeAtmCard(card.customerId,card.id);const remaining=cards.filter(c=>c.id!==card.id);setCards(remaining);if(selectedCardId===card.id)setSelectedCardId(remaining[0]?.id||"");}}}>Unlink card</button></div>)}</div>}
      <div className="atm-fields">
        <label className="atm-label">Deposit amount (NGN)<input className="atm-input" value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))} placeholder="0.00"/></label>
      </div>
      {!selectedCard?.hasReusableAuthorization&&selectedCard&&<div className="atm-fields"><label className="atm-label">Card number (first authorization only)<input className="atm-input" value={cardNumber} maxLength={19} inputMode="numeric" autoComplete="cc-number" onChange={e=>setCardNumber(e.target.value.replace(/\D/g,"").slice(0,19))} placeholder="Card number — not stored"/></label><label className="atm-label">CVV (first authorization only)<input className="atm-input" value={cvv} maxLength={4} inputMode="numeric" autoComplete="cc-csc" type="password" onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="3 or 4 digits — never stored"/></label><p className="atm-muted">The saved expiry date is reused for this card. The first payment needs Paystack authorization. PWFB does not collect an ATM PIN. Later payments may need only an amount when reusable authorization is supported, though Paystack can still request OTP or 3-D Secure.</p></div>}
      <button className="atm-submit" disabled={depositing||!selectedCard} onClick={deposit}>{depositing?"Processing card payment…":"Continue to Paystack authorization"}</button>
    </section>
  </div></main>;
}
