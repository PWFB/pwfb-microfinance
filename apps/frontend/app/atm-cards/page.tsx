"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = { id:string; firstName?:string; lastName?:string; name?:string };
type Card = { id:string; customerId:string; cardholderName:string; last4:string; cardNetwork?:string|null; expiryMonth?:number|null; expiryYear?:number|null; status:string; hasFrontAttachment?:boolean; hasBackAttachment?:boolean };

const unwrap = (v:any) => Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : Array.isArray(v?.customers) ? v.customers : [];
const fullName = (c:Customer) => c.name || [c.firstName,c.lastName].filter(Boolean).join(" ") || c.id;

function readImage(file:File) {
  return new Promise<{data:string; mime:string}>((resolve,reject) => {
    const allowed = ["image/jpeg","image/png","image/webp"];
    if (!allowed.includes(file.type)) {
      reject(new Error("Use JPEG, PNG, or WebP images."));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Each card image must be 5 MB or smaller."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({data:String(reader.result), mime:file.type});
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

export default function AtmCardsPage() {
  const {user, loading:authLoading} = useAuth();
  const [customerId,setCustomerId] = useState("");
  const [search,setSearch] = useState("");
  const [customers,setCustomers] = useState<Customer[]>([]);
  const [cards,setCards] = useState<Card[]>([]);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [cardholderName,setCardholderName] = useState("");
  const [last4,setLast4] = useState("");
  const [network,setNetwork] = useState("VISA");
  const [month,setMonth] = useState("");
  const [year,setYear] = useState("");
  const [front,setFront] = useState<any>(null);
  const [back,setBack] = useState<any>(null);
  const isCustomer = user?.role === "CUSTOMER";

  useEffect(() => {
    if (!authLoading && isCustomer) {
      pwfbApi.customers.me()
        .then((v:any) => setCustomerId(String(v?.id || v?.customerId || v?.data?.id || "")))
        .catch(() => {});
    }
  }, [authLoading,isCustomer]);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    pwfbApi.banking.atmCards(customerId)
      .then((v:any) => setCards(unwrap(v)))
      .catch((e:any) => setMessage(e?.message || "Could not load ATM cards."))
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => {
    if (isCustomer || !search.trim()) return;
    const timer = setTimeout(() => {
      pwfbApi.customers.search(search.trim())
        .then((v:any) => setCustomers(unwrap(v)))
        .catch(() => setCustomers([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search,isCustomer]);

  const submit = async () => {
    setMessage("");
    if (!customerId) return setMessage("Select a customer first.");
    if (last4.length !== 4) return setMessage("Enter the last 4 digits of the ATM card.");
    if (!cardholderName.trim()) return setMessage("Enter the cardholder name.");
    if (!front && !back) return setMessage("Attach at least the front or back of the card.");
    setSaving(true);
    try {
      await pwfbApi.banking.addAtmCard(customerId,{
        cardholderName:cardholderName.trim(),
        last4,
        cardNetwork:network,
        expiryMonth:month ? Number(month) : null,
        expiryYear:year ? Number(year) : null,
        frontImage:front?.data || null,
        frontMimeType:front?.mime || null,
        backImage:back?.data || null,
        backMimeType:back?.mime || null
      });
      setMessage("ATM card attached successfully.");
      setLast4("");
      setFront(null);
      setBack(null);
      setMonth("");
      setYear("");
      const v = await pwfbApi.banking.atmCards(customerId);
      setCards(unwrap(v));
    } catch (e:any) {
      setMessage(e?.message || "ATM card could not be attached.");
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (card:Card, side:"front"|"back") => {
    try {
      const v:any = await pwfbApi.banking.atmAttachment(card.customerId,card.id,side);
      if (v?.data && v?.mimeType) {
        const w = window.open();
        if (w) {
          w.document.write('<img src="data:' + v.mimeType + ';base64,' + v.data + '" style="max-width:100%;height:auto" />');
        }
      }
    } catch (e:any) {
      setMessage(e?.message || "Attachment could not be opened.");
    }
  };

  const chooseFile = async (file:File|null, setter:(value:any)=>void) => {
    if (!file) return;
    try {
      setter(await readImage(file));
    } catch (e:any) {
      setMessage(e?.message || "Could not read the image.");
    }
  };

  if (authLoading) return <main className="pwfb-content"><p>Checking authentication...</p></main>;

  return (
    <main className="pwfb-content">
      <div className="atm-page">
        <header className="atm-header">
          <div>
            <p className="atm-eyebrow">BANKING • CARD MANAGEMENT</p>
            <h1>ATM Cards</h1>
            <p>Attach and manage a customer ATM card securely.</p>
          </div>
          <div className="atm-mark">ATM</div>
        </header>

        <section className="atm-panel">
          {!isCustomer && (
            <label className="atm-label">
              Customer search
              <input className="atm-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or customer ID" />
              {customers.length > 0 && (
                <div className="atm-results">
                  {customers.slice(0,6).map(c => (
                    <button className="atm-result" key={c.id} onClick={() => {
                      setCustomerId(c.id);
                      setSearch(fullName(c) + " • " + c.id);
                      setCardholderName(fullName(c));
                    }}>
                      {fullName(c)} <small>{c.id}</small>
                    </button>
                  ))}
                </div>
              )}
            </label>
          )}

          <div className="atm-fields">
            <label className="atm-label">Cardholder name<input className="atm-input" value={cardholderName} onChange={e=>setCardholderName(e.target.value)} placeholder="Name printed on card" /></label>
            <label className="atm-label">Last 4 digits<input className="atm-input" value={last4} maxLength={4} inputMode="numeric" onChange={e=>setLast4(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="1234" /></label>
            <label className="atm-label">Card network<select className="atm-input" value={network} onChange={e=>setNetwork(e.target.value)}><option>VISA</option><option>MASTERCARD</option><option>VERVE</option><option>OTHER</option></select></label>
            <label className="atm-label">Expiry<input className="atm-input" value={month && year ? month + "/" + year : ""} onChange={e=>{const x=e.target.value.replace(/\D/g,"").slice(0,6);setMonth(x.slice(0,2));setYear(x.slice(2,6));}} placeholder="MMYYYY" /></label>
          </div>

          <div className="atm-security"><b>Security:</b> PWFB does not store the PIN, CVV, or full card number. Only the last 4 digits are recorded.</div>

          <div className="atm-attachments">
            <label className="atm-drop">
              <b>Front attachment</b>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>chooseFile(e.target.files?.[0] || null,setFront)} />
              {front ? <img src={front.data} alt="ATM card front preview" /> : <small>JPEG, PNG or WebP • max 5 MB</small>}
            </label>
            <label className="atm-drop">
              <b>Back attachment</b>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>chooseFile(e.target.files?.[0] || null,setBack)} />
              {back ? <img src={back.data} alt="ATM card back preview" /> : <small>JPEG, PNG or WebP • max 5 MB</small>}
            </label>
          </div>

          {message && <p className={message.includes("successfully") ? "atm-ok" : "atm-error"}>{message}</p>}
          <button className="atm-submit" disabled={saving} onClick={submit}>{saving ? "Attaching…" : "Attach ATM Card"}</button>
        </section>

        <section className="atm-panel">
          <h2>Attached Cards</h2>
          {loading ? <p>Loading cards…</p> : cards.length === 0 ? <p className="atm-muted">No ATM card attached for the selected customer.</p> : cards.map(card => (
            <div className="atm-card-row" key={card.id}>
              <div>
                <b>{card.cardholderName}</b>
                <div className="atm-muted">{card.cardNetwork || "Card"} •••• {card.last4}{card.expiryMonth && card.expiryYear ? " • " + String(card.expiryMonth).padStart(2,"0") + "/" + card.expiryYear : ""} • {card.status}</div>
              </div>
              <div className="atm-actions">
                {card.hasFrontAttachment && <button onClick={()=>openAttachment(card,"front")}>Front</button>}
                {card.hasBackAttachment && <button onClick={()=>openAttachment(card,"back")}>Back</button>}
                <button className="danger" onClick={async()=>{if(confirm("Remove this ATM card record?")){await pwfbApi.banking.removeAtmCard(card.customerId,card.id);setCards(x=>x.filter(c=>c.id!==card.id));}}}>Remove</button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
