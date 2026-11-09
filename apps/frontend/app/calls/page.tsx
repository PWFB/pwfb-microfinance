"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./calls.module.css";
import { pwfbApi } from "../../lib/pwfb-api";

type Branch = { id: string; name: string };
type CallContext = {
  userRole: string; currentUserId: string; currentBranchId?: string | null;
  customerId?: string; phone?: string; callEnabled?: boolean; consentAt?: string | null;
  branches?: Branch[]; iceServers?: RTCIceServer[];
};
type StaffContact = {
  staffId: string; userId: string; name: string; role: string; position?: string; phone?: string; callAvailable: boolean;
};
type ClientContact = {
  customerId: string; userId?: string | null; name: string; phone: string; callEnabled: boolean; callAvailable: boolean;
};
type CallContactData = { staff: StaffContact[]; clients: ClientContact[] };
type CallSession = {
  id: string; type: "STAFF" | "CLIENT"; branchId: string; branchName?: string;
  callerUserId: string; recipientUserId: string; status: string; direction: "INCOMING" | "OUTGOING";
  initiatedAt?: string; expiresAt?: string; acceptedAt?: string;
  callerFirstName?: string; callerLastName?: string; callerRole?: string;
  recipientFirstName?: string; recipientLastName?: string; recipientRole?: string;
};
type CallSignal = { sequence: string; kind: "OFFER" | "ANSWER" | "ICE"; payload: any };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin", SUPER_ADMIN: "Super Admin", REGIONAL_MANAGER: "Regional Manager",
  DIVISIONAL_MANAGER: "Divisional Manager", AREA_MANAGER: "Area Manager",
  BRANCH_MANAGER: "Branch Manager", CREDIT_OFFICER: "Credit Officer",
  TELLER: "Teller", LOAN_OFFICER: "Loan Officer", AUDITOR: "Auditor",
  MONITORING_TEAM: "Monitoring Team", STAFF: "Staff", CUSTOMER: "Client",
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PW";
const CALL_STATUS_LABELS: Record<string, string> = {
  RINGING: "Ringing", ACCEPTED: "Connected", DECLINED: "Declined",
  MISSED: "Missed", ENDED: "Call ended", FAILED: "Connection failed",
};
const statusLabel = (status: string) => CALL_STATUS_LABELS[status] || status;

export default function CallsPage() {
  const [context, setContext] = useState<CallContext | null>(null);
  const [branchId, setBranchId] = useState("");
  const [contacts, setContacts] = useState<CallContactData>({ staff: [], clients: [] });
  const [tab, setTab] = useState<"STAFF" | "CLIENT">("STAFF");
  const [search, setSearch] = useState("");
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [peerLabel, setPeerLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [savingPermission, setSavingPermission] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Ready");
  const [error, setError] = useState("");

  const contextRef = useRef<CallContext | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeCallIdRef = useRef("");
  const signalCursorRef = useRef("0");
  const offerStartedRef = useRef("");
  const signalBusyRef = useRef(false);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);

  const customerMode = context?.userRole === "CUSTOMER";
  const isActive = activeCall?.status === "RINGING" || activeCall?.status === "ACCEPTED";
  const incoming = activeCall?.direction === "INCOMING";
  const outgoing = activeCall?.direction === "OUTGOING";

  useEffect(() => {
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      void remoteAudioRef.current.play().catch(() => undefined);
    }
  }, [activeCall?.id, connectionStatus]);

  const cleanupPeer = useCallback(() => {
    try { peerRef.current?.getSenders().forEach((sender) => sender.track?.stop()); } catch { /* Ignore a closed peer */ }
    try { peerRef.current?.close(); } catch { /* Ignore a closed peer */ }
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    queuedCandidatesRef.current = [];
    signalCursorRef.current = "0";
    activeCallIdRef.current = "";
    offerStartedRef.current = "";
    setMuted(false);
  }, []);

  const openPeer = useCallback(async (callId: string, makeOffer: boolean) => {
    if (activeCallIdRef.current === callId && peerRef.current) return;
    cleanupPeer();
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      throw new Error("This device or browser does not support in-app voice calls.");
    }
    setConnectionStatus("Requesting microphone");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const remote = new MediaStream();
    const peer = new RTCPeerConnection({ iceServers: contextRef.current?.iceServers || [{ urls: "stun:stun.l.google.com:19302" }] });
    activeCallIdRef.current = callId;
    localStreamRef.current = stream;
    remoteStreamRef.current = remote;
    peerRef.current = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      const incomingStream = event.streams?.[0];
      if (incomingStream) incomingStream.getTracks().forEach((track) => {
        if (!remote.getTracks().some((existing) => existing.id === track.id)) remote.addTrack(track);
      });
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remote;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
      setConnectionStatus("Audio connected");
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void pwfbApi.calls.signal(callId, "ICE", event.candidate.toJSON()).catch(() => undefined);
      }
    };
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === "connected") setConnectionStatus("Audio connected");
      else if (state === "connecting") setConnectionStatus("Connecting audio");
      else if (state === "disconnected") setConnectionStatus("Reconnecting audio");
      else if (state === "failed") setConnectionStatus("Connection failed — check network/TURN settings");
    };
    setConnectionStatus("Microphone ready");
    if (makeOffer) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await pwfbApi.calls.signal(callId, "OFFER", peer.localDescription);
      offerStartedRef.current = callId;
      setConnectionStatus("Calling");
    }
  }, [cleanupPeer]);

  const processSignals = useCallback(async (callId: string) => {
    if (signalBusyRef.current || activeCallIdRef.current !== callId || !peerRef.current) return;
    signalBusyRef.current = true;
    try {
      const signals: CallSignal[] = await pwfbApi.calls.signals(callId, signalCursorRef.current);
      for (const signal of Array.isArray(signals) ? signals : []) {
        signalCursorRef.current = String(signal.sequence);
        const peer = peerRef.current;
        if (!peer || activeCallIdRef.current !== callId) return;
        if (signal.kind === "OFFER" && !peer.remoteDescription) {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
          for (const candidate of queuedCandidatesRef.current.splice(0)) {
            try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* Candidate may already be obsolete */ }
          }
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await pwfbApi.calls.signal(callId, "ANSWER", peer.localDescription);
          setConnectionStatus("Answer sent — connecting");
        } else if (signal.kind === "ANSWER" && !peer.remoteDescription) {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
          for (const candidate of queuedCandidatesRef.current.splice(0)) {
            try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* Candidate may already be obsolete */ }
          }
          setConnectionStatus("Connecting audio");
        } else if (signal.kind === "ICE") {
          const candidate = signal.payload as RTCIceCandidateInit;
          if (peer.remoteDescription) {
            try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* Ignore stale ICE candidates */ }
          } else {
            queuedCandidatesRef.current.push(candidate);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Call signalling failed");
    } finally {
      signalBusyRef.current = false;
    }
  }, []);

  const refreshCalls = useCallback(async () => {
    try {
      const items: CallSession[] = await pwfbApi.calls.list();
      const list = Array.isArray(items) ? items : [];
      setCalls(list);
      setActiveCall((current) => {
        if (current) return list.find((item) => item.id === current.id) || current;
        return list.find((item) => item.status === "ACCEPTED")
          || list.find((item) => item.status === "RINGING" && item.direction === "INCOMING")
          || list.find((item) => item.status === "RINGING" && item.direction === "OUTGOING")
          || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh call status");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const initialize = async () => {
      try {
        const result = await pwfbApi.calls.context();
        if (!alive) return;
        contextRef.current = result;
        setContext(result);
        if (result?.currentBranchId) setBranchId(result.currentBranchId);
        else if (result?.branches?.[0]?.id) setBranchId(result.branches[0].id);
        const history = await pwfbApi.calls.list();
        if (!alive) return;
        const list = Array.isArray(history) ? history : [];
        setCalls(list);
        const active = list.find((item) => item.status === "ACCEPTED")
          || list.find((item) => item.status === "RINGING" && item.direction === "INCOMING")
          || list.find((item) => item.status === "RINGING" && item.direction === "OUTGOING");
        if (active) setActiveCall(active);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Unable to open PWFB calling");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void initialize();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!context || customerMode || !branchId) return;
    let alive = true;
    setContactsLoading(true);
    pwfbApi.calls.contacts(branchId, search)
      .then((data: CallContactData) => { if (alive) setContacts({ staff: data.staff || [], clients: data.clients || [] }); })
      .catch((err: unknown) => { if (alive) setError(err instanceof Error ? err.message : "Unable to load call contacts"); })
      .finally(() => { if (alive) setContactsLoading(false); });
    return () => { alive = false; };
  }, [context, customerMode, branchId, search]);

  useEffect(() => {
    if (!context) return;
    const timer = window.setInterval(() => { void refreshCalls(); }, 2500);
    return () => window.clearInterval(timer);
  }, [context, refreshCalls]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== "ACCEPTED") return;
    let alive = true;
    const id = activeCall.id;
    const isCaller = activeCall.direction === "OUTGOING";
    const connect = async () => {
      try {
        if (activeCallIdRef.current !== id) await openPeer(id, isCaller);
        if (!alive) return;
        await processSignals(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not access the microphone");
        setConnectionStatus("Microphone unavailable");
        void pwfbApi.calls.end(id).catch(() => undefined);
      }
    };
    void connect();
    const timer = window.setInterval(() => { if (alive) void processSignals(id); }, 1200);
    return () => { alive = false; window.clearInterval(timer); };
  }, [activeCall?.id, activeCall?.status, activeCall?.direction, openPeer, processSignals]);

  useEffect(() => {
    if (!activeCall || activeCall.status === "RINGING" || activeCall.status === "ACCEPTED") return;
    cleanupPeer();
    setConnectionStatus(statusLabel(activeCall.status));
  }, [activeCall?.id, activeCall?.status, cleanupPeer]);

  useEffect(() => () => cleanupPeer(), [cleanupPeer]);

  const filteredContacts = useMemo(() => tab === "STAFF"
    ? contacts.staff
    : contacts.clients, [contacts, tab]);

  const getCallPeerName = (call: CallSession) => call.direction === "INCOMING"
    ? [call.callerFirstName, call.callerLastName].filter(Boolean).join(" ") || "PWFB caller"
    : [call.recipientFirstName, call.recipientLastName].filter(Boolean).join(" ") || peerLabel || "PWFB contact";

  const startStaffCall = async (person: StaffContact) => {
    if (isActive) return;
    setError("");
    setPeerLabel(person.name);
    try {
      const result = await pwfbApi.calls.startStaff(person.staffId);
      setActiveCall(result.call);
      setConnectionStatus("Calling " + person.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start this staff call");
    }
  };

  const startClientCall = async (person: ClientContact) => {
    if (isActive || !person.customerId) return;
    setError("");
    setPeerLabel(person.name);
    try {
      const result = await pwfbApi.calls.startClient(person.customerId);
      setActiveCall(result.call);
      setConnectionStatus("Calling " + person.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not call this client");
    }
  };

  const acceptIncoming = async () => {
    if (!activeCall || !incoming) return;
    try {
      await pwfbApi.calls.accept(activeCall.id);
      setActiveCall({ ...activeCall, status: "ACCEPTED" });
      setConnectionStatus("Joining call");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept this call");
    }
  };

  const declineIncoming = async () => {
    if (!activeCall || !incoming) return;
    try {
      await pwfbApi.calls.decline(activeCall.id);
      setActiveCall({ ...activeCall, status: "DECLINED" });
      cleanupPeer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline this call");
    }
  };

  const endActiveCall = async () => {
    if (!activeCall) return;
    try {
      await pwfbApi.calls.end(activeCall.id);
      setActiveCall({ ...activeCall, status: "ENDED" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end this call");
    } finally {
      cleanupPeer();
      setConnectionStatus("Call ended");
    }
  };

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };

  const setPermission = async (enabled: boolean) => {
    setSavingPermission(true);
    setError("");
    try {
      const result = await pwfbApi.calls.permission(enabled);
      setContext((current) => {
        if (!current) return current;
        const updated: CallContext = {
          ...current,
          callEnabled: Boolean(result?.preference?.enabled),
          consentAt: result?.preference?.consentAt ?? null,
        };
        contextRef.current = updated;
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update call permission");
    } finally {
      setSavingPermission(false);
    }
  };

  const dismissCall = () => {
    cleanupPeer();
    setActiveCall(null);
    setPeerLabel("");
    setConnectionStatus("Ready");
  };

  if (loading) return <main className={styles.loading}>Preparing PWFB voice service…</main>;

  if (customerMode) {
    return (
      <main className={styles.page}>
        <audio ref={remoteAudioRef} autoPlay playsInline />
        <header className={styles.header}>
          <div className={styles.brandIcon}>☎</div>
          <div><p className={styles.eyebrow}>PWFB CLIENT APPLICATION</p><h1>Voice Calls</h1><p className={styles.subtitle}>Receive secure voice calls from authorized staff in your branch.</p></div>
        </header>
        {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
        <section className={styles.clientPermission}>
          <div className={styles.permissionIcon}>☎</div>
          <div className={styles.permissionText}>
            <strong>Allow calls from your PWFB branch</strong>
            <p>When enabled, authorized staff can call you inside the PWFB app using an internet connection. Your phone number remains on your registered profile; PWFB does not dial your mobile network.</p>
          </div>
          <label className={styles.toggle}>
            <input type="checkbox" checked={Boolean(context?.callEnabled)} disabled={savingPermission || !context?.phone} onChange={(event) => void setPermission(event.target.checked)} />
            <span />
          </label>
        </section>
        <section className={styles.clientStatus}>
          <div><small>YOUR CALL STATUS</small><strong>{context?.callEnabled ? "Available for in-app calls" : "Calls are turned off"}</strong></div>
          <span className={context?.callEnabled ? styles.enabledDot : styles.disabledDot} />
        </section>
        {activeCall?.status === "RINGING" && incoming && (
          <section className={styles.incomingCard}>
            <div className={styles.ringingAvatar}>☎</div>
            <small>INCOMING PWFB CALL</small>
            <h2>{getCallPeerName(activeCall)}</h2>
            <p>{activeCall.callerRole ? (ROLE_LABELS[activeCall.callerRole] || activeCall.callerRole) : "Authorized branch staff"} is calling you.</p>
            <div className={styles.callActions}><button className={styles.acceptButton} onClick={() => void acceptIncoming()}>Accept call</button><button className={styles.declineButton} onClick={() => void declineIncoming()}>Decline</button></div>
          </section>
        )}
        {activeCall?.status === "ACCEPTED" && (
          <section className={styles.activeCallCard}>
            <div className={styles.ringingAvatar}>☎</div><small>CALL IN PROGRESS</small><h2>{getCallPeerName(activeCall)}</h2><p>{connectionStatus}</p>
            <div className={styles.callActions}><button className={muted ? styles.activeControl : styles.controlButton} onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button><button className={styles.endButton} onClick={() => void endActiveCall()}>End call</button></div>
          </section>
        )}
        {activeCall && ["DECLINED", "MISSED", "ENDED", "FAILED"].includes(activeCall.status) && (
          <section className={styles.endedCard}><strong>{statusLabel(activeCall.status)}</strong><p>{getCallPeerName(activeCall)}</p><button onClick={dismissCall}>Close</button></section>
        )}
        <p className={styles.privacyNote}>You can switch call permission off at any time. Calls are not recorded by PWFB. Keep this screen open while expecting an incoming in-app call.</p>
      </main>
    );
  }

  const selectedBranch = context?.branches?.find((item) => item.id === branchId);
  const currentCallName = activeCall ? getCallPeerName(activeCall) : peerLabel;

  return (
    <main className={styles.page}>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <header className={styles.header}>
        <div className={styles.brandIcon}>☎</div>
        <div><p className={styles.eyebrow}>LAB MICROFINANCE • PWFB SERVER</p><h1>Voice Calls</h1><p className={styles.subtitle}>Free in-app staff calling and permission-based client calls.</p></div>
        <div className={styles.serverBadge}><span /> PWFB signalling online</div>
      </header>
      {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}

      <section className={styles.summaryRow}>
        <div><small>RECENT CALLS</small><strong>{calls.length}</strong></div>
        <div><small>ACTIVE CALL</small><strong>{isActive ? "1" : "0"}</strong></div>
        <div><small>CALL NETWORK</small><strong>Internet audio</strong></div>
      </section>

      <section className={styles.layout}>
        <div className={styles.directoryPanel}>
          <div className={styles.panelHeader}><div><small>CALL DIRECTORY</small><h2>Branch contacts</h2></div><span className={styles.countPill}>{contacts.staff.length + contacts.clients.length}</span></div>
          {context?.branches && context.branches.length > 1 && <label className={styles.branchSelect}>Branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)}>{context.branches.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
          {context?.branches && context.branches.length === 1 && <div className={styles.branchName}>{selectedBranch?.name || "Your branch"}</div>}
          <label className={styles.search}><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find staff or client by name/phone" /></label>
          <div className={styles.tabs}><button className={tab === "STAFF" ? styles.activeTab : ""} onClick={() => setTab("STAFF")}>Staff ({contacts.staff.length})</button><button className={tab === "CLIENT" ? styles.activeTab : ""} onClick={() => setTab("CLIENT")}>Clients ({contacts.clients.length})</button></div>
          <div className={styles.contactList}>
            {contactsLoading && <div className={styles.loadingContacts}>Loading branch contacts…</div>}
            {!contactsLoading && tab === "STAFF" && (filteredContacts as StaffContact[]).map((person) => (
              <div className={styles.contact} key={person.staffId}>
                <span className={styles.avatar}>{initials(person.name)}</span>
                <div className={styles.contactText}><strong>{person.name}</strong><small>{ROLE_LABELS[person.role] || person.role}{person.position ? " · " + person.position : ""}</small>{person.phone && <small>{person.phone}</small>}</div>
                <button className={styles.callButton} disabled={Boolean(isActive) || !person.callAvailable} onClick={() => void startStaffCall(person)} aria-label={"Call " + person.name}>☎</button>
              </div>
            ))}
            {!contactsLoading && tab === "CLIENT" && (filteredContacts as ClientContact[]).map((person) => (
              <div className={styles.contact} key={person.customerId}>
                <span className={styles.clientAvatar}>{initials(person.name)}</span>
                <div className={styles.contactText}><strong>{person.name}</strong><small>{person.phone}</small><small>{!person.userId ? "No linked PWFB app login" : person.callEnabled ? "Client has enabled calls" : "Client call permission is off"}</small></div>
                <button className={styles.callButton} disabled={Boolean(isActive) || !person.callAvailable || !person.userId} onClick={() => void startClientCall(person)} aria-label={"Call " + person.name}>☎</button>
              </div>
            ))}
            {!contactsLoading && !filteredContacts.length && <div className={styles.emptyContacts}><span>☎</span><strong>No matching contacts</strong><small>Try another name or phone number.</small></div>}
          </div>
          {tab === "CLIENT" && <p className={styles.directoryNote}>Only clients with a registered phone number are listed. In-app calling requires a linked PWFB login and the client’s explicit call permission.</p>}
        </div>

        <div className={styles.callPanel}>
          {activeCall && isActive ? (
            <section className={styles.activeCallCard}>
              <div className={styles.callPulse}><span>☎</span></div>
              <small>{incoming && activeCall.status === "RINGING" ? "INCOMING CALL" : outgoing && activeCall.status === "RINGING" ? "OUTGOING CALL" : "VOICE CALL"}</small>
              <h2>{currentCallName}</h2>
              <p>{activeCall.status === "RINGING" ? (incoming ? "This contact is calling your PWFB account." : "Waiting for the other person to answer…") : connectionStatus}</p>
              {activeCall.status === "RINGING" && incoming ? (
                <div className={styles.callActions}><button className={styles.acceptButton} onClick={() => void acceptIncoming()}>Accept</button><button className={styles.declineButton} onClick={() => void declineIncoming()}>Decline</button></div>
              ) : (
                <div className={styles.callActions}><button className={muted ? styles.activeControl : styles.controlButton} disabled={activeCall.status !== "ACCEPTED"} onClick={toggleMute}>{muted ? "Unmute microphone" : "Mute microphone"}</button><button className={styles.endButton} onClick={() => void endActiveCall()}>End call</button></div>
              )}
              <p className={styles.callSecurity}>Private peer-to-peer audio · Not recorded</p>
            </section>
          ) : activeCall ? (
            <section className={styles.endedCard}><strong>{statusLabel(activeCall.status)}</strong><p>{currentCallName}</p><button onClick={dismissCall}>Close call card</button></section>
          ) : (
            <section className={styles.callWelcome}>
              <div className={styles.welcomeIcon}>☎</div><h2>Connect with your branch</h2><p>Choose a staff member for an internal call, or select a client who has enabled voice calls in the PWFB app.</p><div className={styles.networkSteps}><span>1</span><p>Select an authorized contact</p><span>2</span><p>Allow microphone access</p><span>3</span><p>Start your in-app voice conversation</p></div>
            </section>
          )}
          <section className={styles.history}>
            <button className={styles.historyToggle} onClick={() => setCallHistoryOpen((value) => !value)}><span>Recent call activity</span><span>{calls.length} records</span><b>{callHistoryOpen ? "−" : "+"}</b></button>
            {callHistoryOpen && <div className={styles.historyList}>{calls.slice(0, 12).map((call) => <div className={styles.historyItem} key={call.id}><span className={call.status === "ACCEPTED" || call.status === "ENDED" ? styles.historyGood : styles.historyMuted}>☎</span><div><strong>{getCallPeerName(call)}</strong><small>{call.type === "CLIENT" ? "Client" : "Staff"} · {call.branchName || "PWFB"} · {statusLabel(call.status)}</small></div><time>{call.initiatedAt ? new Date(call.initiatedAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</time></div>)}</div>}
          </section>
        </div>
      </section>
      <p className={styles.footnote}>PWFB routes call setup and secure signalling. Audio normally travels directly between devices over the internet. A TURN relay must be configured for networks that cannot connect directly; ordinary mobile-number calls require a separate paid telephony provider.</p>
    </main>
  );
}
