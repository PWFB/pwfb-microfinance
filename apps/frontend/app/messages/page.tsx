"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./messages.module.css";
import { pwfbApi } from "../../lib/pwfb-api";

type Branch = { id: string; name: string };
type StaffMember = { staffId: string; userId: string; firstName: string; lastName: string; position?: string; role: string };
type Conversation = {
  id: string; branchId: string; branchName: string; type: "ROLE" | "GROUP";
  roleTarget?: string; title?: string; lastMessage?: string; lastMessageCreatedAt?: string;
  lastSenderUserId?: string; unreadCount: number; participantCount: number;
};
type ChatMessage = {
  id: string; body: string; createdAt: string; senderUserId: string; isMine?: boolean;
  senderFirstName?: string; senderLastName?: string; senderRole?: string; staffNumber?: string;
};
type Context = { userRole: string; currentBranchId: string | null; canMonitorAllBranchMessages?: boolean; branches: Branch[]; roleTargets: string[] };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  REGIONAL_MANAGER: "Regional Manager", DIVISIONAL_MANAGER: "Divisional Manager",
  AREA_MANAGER: "Area Manager", BRANCH_MANAGER: "Branch Manager",
  CREDIT_OFFICER: "Credit Officer", TELLER: "Teller", LOAN_OFFICER: "Loan Officer",
  AUDITOR: "Auditor", MONITORING_TEAM: "Monitoring Team", STAFF: "Staff",
};
const initials = (first?: string, last?: string) => [first, last].filter(Boolean).map((part) => part?.[0]).join("").toUpperCase() || "PW";
const timeLabel = (value?: string) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString([], { day: "numeric", month: "short" }) : "";

export default function MessagesPage() {
  const [context, setContext] = useState<Context | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [branchId, setBranchId] = useState("");
  const [directory, setDirectory] = useState<StaffMember[]>([]);
  const [roleTargets, setRoleTargets] = useState<string[]>([]);
  const [loadingRoleTargets, setLoadingRoleTargets] = useState(false);
  const [newMode, setNewMode] = useState<"ROLE" | "GROUP" | null>(null);
  const [roleTarget, setRoleTarget] = useState("BRANCH_MANAGER");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupStaffIds, setGroupStaffIds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const canSeeUnreadCounts = Boolean(context?.canMonitorAllBranchMessages);
  const unreadTotal = useMemo(
    () => conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0),
    [conversations],
  );
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) || activeConversation,
    [conversations, selectedId, activeConversation],
  );
  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((item) =>
      [item.title, item.branchName, item.roleTarget ? ROLE_LABELS[item.roleTarget] : "", item.lastMessage]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [conversations, search]);

  const refreshInbox = useCallback(async () => {
    try {
      const items = await pwfbApi.messages.list();
      setConversations(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load branch messages");
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const result = await pwfbApi.messages.conversation(id);
      setActiveConversation(result?.conversation || null);
      setMessages(Array.isArray(result?.messages) ? result.messages : []);
      await refreshInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open this conversation");
    }
  }, [refreshInbox]);

  useEffect(() => {
    let alive = true;
    const initialize = async () => {
      try {
        const result = await pwfbApi.messages.context();
        if (!alive) return;
        setContext(result);
        const firstBranch = result?.currentBranchId || result?.branches?.[0]?.id || "";
        setBranchId(firstBranch);
        setRoleTargets(Array.isArray(result?.roleTargets) ? result.roleTargets : []);
        if (Array.isArray(result?.roleTargets) && result.roleTargets.length) {
          setRoleTarget(result.roleTargets.includes("BRANCH_MANAGER") ? "BRANCH_MANAGER" : result.roleTargets[0]);
        } else {
          setRoleTarget("");
        }
        const items = await pwfbApi.messages.list();
        if (!alive) return;
        setConversations(Array.isArray(items) ? items : []);
        if (Array.isArray(items) && items.length) setSelectedId(items[0].id);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Unable to open the messaging centre");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void initialize();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }
    void loadConversation(selectedId);
    const timer = window.setInterval(() => { void loadConversation(selectedId); }, 12000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadConversation]);

  useEffect(() => {
    if (!branchId) {
      setRoleTargets([]);
      setRoleTarget("");
      setLoadingRoleTargets(false);
      return;
    }
    let alive = true;
    setLoadingRoleTargets(true);
    setRoleTargets([]);
    setRoleTarget("");
    pwfbApi.messages.roles(branchId)
      .then((items: string[]) => {
        if (!alive) return;
        const available = Array.isArray(items) ? items : [];
        setRoleTargets(available);
        setRoleTarget(available.includes("BRANCH_MANAGER") ? "BRANCH_MANAGER" : available[0] || "");
        setLoadingRoleTargets(false);
      })
      .catch((err: unknown) => {
        if (alive) {
          setRoleTargets([]);
          setRoleTarget("");
          setLoadingRoleTargets(false);
          setError(err instanceof Error ? err.message : "Unable to load roles for this branch");
        }
      });
    return () => { alive = false; };
  }, [branchId]);

  useEffect(() => {
    if (!branchId) {
      setDirectory([]);
      return;
    }
    let alive = true;
    pwfbApi.messages.staff(branchId)
      .then((items: StaffMember[]) => { if (alive) setDirectory(Array.isArray(items) ? items : []); })
      .catch((err: unknown) => { if (alive) setError(err instanceof Error ? err.message : "Unable to load branch staff"); });
    return () => { alive = false; };
  }, [branchId]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refreshInbox(); }, 20000);
    return () => window.clearInterval(timer);
  }, [refreshInbox]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    setError("");
    try {
      const result = await pwfbApi.messages.send(selectedId, body);
      setDraft("");
      setActiveConversation(result?.conversation || activeConversation);
      setMessages(Array.isArray(result?.messages) ? result.messages : []);
      await refreshInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent");
    } finally {
      setSending(false);
    }
  };

  const startRoleMessage = async () => {
    const body = draft.trim();
    if (!branchId || !roleTarget || !roleTargets.includes(roleTarget) || !body || sending || loadingRoleTargets) return;
    setSending(true);
    setError("");
    try {
      const result = await pwfbApi.messages.sendToRole({ branchId, roleTarget, message: body });
      const id = String(result?.conversation?.id || "");
      setDraft("");
      setNewMode(null);
      await refreshInbox();
      if (id) setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the branch message");
    } finally {
      setSending(false);
    }
  };

  const createGroup = async () => {
    if (!branchId || groupStaffIds.length < 2 || !groupTitle.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const result = await pwfbApi.messages.createGroup({
        branchId, title: groupTitle.trim(), staffIds: groupStaffIds,
      });
      const id = String(result?.conversation?.id || "");
      setGroupTitle("");
      setGroupStaffIds([]);
      setNewMode(null);
      await refreshInbox();
      if (id) setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Group chat could not be created");
    } finally {
      setSending(false);
    }
  };

  const toggleMember = (staffId: string) => {
    setGroupStaffIds((current) => current.includes(staffId)
      ? current.filter((id) => id !== staffId)
      : [...current, staffId]);
  };

  if (loading) return <main className={styles.loading}>Opening secure branch messenger…</main>;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.heading}>
          <div className={styles.headingIcon}>✉</div>
          <div>
            <p className={styles.eyebrow}>LAB MICROFINANCE • INTERNAL COMMUNICATION</p>
            <h1>Branch Messenger</h1>
            <p className={styles.subheading}>Send updates to a branch role or coordinate in an approved staff group.</p>
          </div>
        </div>
        <div className={styles.headerStats}>
          <span className={styles.onlineDot} />
          <span>Secure workspace</span>
          {canSeeUnreadCounts && <><strong>{unreadTotal}</strong><small>unread</small></>}
        </div>
      </header>

      {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}

      <section className={styles.workspace}>
        <aside className={styles.inbox}>
          <div className={styles.inboxTop}>
            <div><span className={styles.sectionLabel}>MESSAGES</span><h2>Inbox {canSeeUnreadCounts && <span>{unreadTotal}</span>}</h2></div>
            <button className={styles.iconButton} title="Refresh messages" onClick={() => void refreshInbox()}>↻</button>
          </div>
          <label className={styles.searchBox}>
            <span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" />
          </label>
          <div className={styles.newButtons}>
            <button onClick={() => setNewMode(newMode === "ROLE" ? null : "ROLE")}>＋ Role message</button>
            <button onClick={() => setNewMode(newMode === "GROUP" ? null : "GROUP")}>＋ Group chat</button>
          </div>
          <div className={styles.conversationList}>
            {filteredConversations.map((item) => {
              const isActive = item.id === selectedId;
              const title = item.type === "ROLE" ? ROLE_LABELS[item.roleTarget || ""] || item.roleTarget : item.title;
              return (
                <button key={item.id} className={styles.conversationItem + (isActive ? " " + styles.activeConversation : "")} onClick={() => setSelectedId(item.id)}>
                  <span className={styles.avatar + (item.type === "GROUP" ? " " + styles.groupAvatar : "")}>{item.type === "GROUP" ? "👥" : initials(title, "")}</span>
                  <span className={styles.conversationText}>
                    <span className={styles.conversationTitle}>{title || "Branch conversation"}</span>
                    <span className={styles.conversationMeta}>{item.branchName}{item.type === "GROUP" ? " · " + item.participantCount + " members" : " · Role channel"}</span>
                    <span className={styles.preview}>{item.lastMessage || "No messages yet"}</span>
                  </span>
                  <span className={styles.conversationAside}>
                    <small>{dateLabel(item.lastMessageCreatedAt)}</small>
                    {canSeeUnreadCounts && Number(item.unreadCount) > 0 && <b>{item.unreadCount > 99 ? "99+" : item.unreadCount}</b>}
                  </span>
                </button>
              );
            })}
            {!filteredConversations.length && <div className={styles.emptyInbox}><span>✉</span><strong>No conversations yet</strong><small>Start a role message or create a staff group.</small></div>}
          </div>
          <div className={styles.inboxFoot}>Messages are visible only to authorized branch roles, group members, and scoped administrators.</div>
        </aside>

        <section className={styles.chatPanel}>
          {newMode === "ROLE" && (
            <div className={styles.composerPanel}>
              <div className={styles.panelTitle}><div><span className={styles.sectionLabel}>NEW CONVERSATION</span><h2>Message a branch role</h2></div><button onClick={() => setNewMode(null)}>×</button></div>
              {context && <label className={styles.field}>Branch<select value={branchId} disabled={context.branches.length <= 1} onChange={(event) => setBranchId(event.target.value)}>{context.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>{!context.branches.length && <small className={styles.helper}>No branch assignment was detected for this login. Ask an administrator to check your active Staff Assignment.</small>}</label>}
              <label className={styles.field}>Send to role<select value={roleTarget} disabled={!roleTargets.length || loadingRoleTargets} onChange={(event) => setRoleTarget(event.target.value)}>{roleTargets.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}</select>{loadingRoleTargets && <small className={styles.helper}>Loading available roles for this branch…</small>}{!loadingRoleTargets && !roleTargets.length && <small className={styles.helper}>No active recipient roles were found in this branch. Choose another assigned branch or ask an administrator to review staff role assignments.</small>}</label>
              <label className={styles.field}>Message<textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a branch update or request…" rows={4} maxLength={5000} /></label>
              <div className={styles.panelFooter}><small>{draft.length}/5,000 characters</small><button disabled={!branchId || !roleTarget || !roleTargets.includes(roleTarget) || loadingRoleTargets || !draft.trim() || sending} onClick={() => void startRoleMessage()}>{sending ? "Sending…" : "Send to role"}</button></div>
              <p className={styles.helper}>The selected role and authorized branch administrators can read and reply. Staff cannot open private one-to-one chats.</p>
            </div>
          )}

          {newMode === "GROUP" && (
            <div className={styles.composerPanel}>
              <div className={styles.panelTitle}><div><span className={styles.sectionLabel}>NEW GROUP</span><h2>Create staff group chat</h2></div><button onClick={() => setNewMode(null)}>×</button></div>
              {context && <label className={styles.field}>Branch<select value={branchId} disabled={context.branches.length <= 1} onChange={(event) => { setBranchId(event.target.value); setGroupStaffIds([]); }}>{context.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>{!context.branches.length && <small className={styles.helper}>No branch assignment was detected for this login. Ask an administrator to check your active Staff Assignment.</small>}</label>}
              <label className={styles.field}>Group name<input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="e.g. Monday Operations Team" maxLength={80} /></label>
              <div className={styles.memberPicker}>
                <div className={styles.memberPickerHead}><strong>Add branch staff</strong><span>{groupStaffIds.length + 1} selected incl. you</span></div>
                {directory.map((member) => (
                  <label key={member.staffId} className={styles.memberOption}>
                    <input type="checkbox" checked={groupStaffIds.includes(member.staffId)} onChange={() => toggleMember(member.staffId)} />
                    <span className={styles.miniAvatar}>{initials(member.firstName, member.lastName)}</span>
                    <span><strong>{member.firstName} {member.lastName}</strong><small>{ROLE_LABELS[member.role] || member.role} · {member.position || "Staff"}</small></span>
                  </label>
                ))}
                {!directory.length && <small className={styles.helper}>No active, linked staff accounts were found in this branch.</small>}
              </div>
              <div className={styles.panelFooter}><small>Choose at least 2 other staff to create a group.</small><button disabled={!groupTitle.trim() || groupStaffIds.length < 2 || sending} onClick={() => void createGroup()}>{sending ? "Creating…" : "Create group"}</button></div>
            </div>
          )}

          {!newMode && selectedConversation && (
            <>
              <div className={styles.chatHeader}>
                <div className={styles.avatar + (selectedConversation.type === "GROUP" ? " " + styles.groupAvatar : "")}>{selectedConversation.type === "GROUP" ? "👥" : initials(selectedConversation.roleTarget ? ROLE_LABELS[selectedConversation.roleTarget] : "Branch", "")}</div>
                <div className={styles.chatHeading}>
                  <strong>{selectedConversation.type === "ROLE" ? ROLE_LABELS[selectedConversation.roleTarget || ""] || selectedConversation.roleTarget : selectedConversation.title}</strong>
                  <small>{selectedConversation.branchName} · {selectedConversation.type === "ROLE" ? "Branch role channel" : selectedConversation.participantCount + " group members"}</small>
                </div>
                <span className={styles.secureTag}>● Branch scoped</span>
              </div>
              <div className={styles.messageStream}>
                {messages.map((message) => {
                  const own = Boolean(message.isMine);
                  return (
                    <div key={message.id} className={styles.messageRow + (own ? " " + styles.ownMessage : "")}>
                      {!own && <span className={styles.messageAvatar}>{initials(message.senderFirstName, message.senderLastName)}</span>}
                      <div className={styles.messageBubble}>
                        <div className={styles.messageMeta}><strong>{own ? "You" : ([message.senderFirstName, message.senderLastName].filter(Boolean).join(" ") || "Branch staff")}</strong><span>{message.senderRole ? (ROLE_LABELS[message.senderRole] || message.senderRole) : ""}</span></div>
                        <p>{message.body}</p>
                        <small>{timeLabel(message.createdAt)} · {dateLabel(message.createdAt)}</small>
                      </div>
                    </div>
                  );
                })}
                {!messages.length && <div className={styles.emptyChat}><span>✦</span><strong>Start the conversation</strong><small>Keep branch discussions professional and relevant to operations.</small></div>}
              </div>
              <div className={styles.messageComposer}>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" rows={2} maxLength={5000} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} />
                <div><small>Enter to send · Shift + Enter for a new line</small><button disabled={!draft.trim() || sending} onClick={() => void handleSend()}>{sending ? "Sending…" : "Send ↗"}</button></div>
              </div>
            </>
          )}

          {!newMode && !selectedConversation && (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>✉</div><h2>Branch conversations, in one place</h2>
              <p>Choose a role channel to contact a branch function, or create a group with at least three staff members. Direct staff-to-staff chats are disabled.</p>
              <div className={styles.welcomeActions}><button onClick={() => setNewMode("ROLE")}>Message a role</button><button onClick={() => setNewMode("GROUP")}>Create a group</button></div>
            </div>
          )}
        </section>
      </section>
      <footer className={styles.pageFoot}>Group membership is limited to active staff connected to the selected branch. Authorized Admins and Super Admins can monitor messages and unread totals within their access scope.</footer>
    </main>
  );
}
