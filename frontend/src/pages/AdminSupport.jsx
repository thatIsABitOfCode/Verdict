import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const STATUS_OPTIONS = [
  "open",
  "in_progress",
  "waiting_on_user",
  "resolved",
  "closed",
];

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_user: "Waiting on user",
  resolved: "Resolved",
  closed: "Closed",
};

function label(value) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function loadTickets() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });

    if (loadError) {
      console.error("Unable to load support tickets:", loadError);
      setError("Verdict could not load support tickets right now.");
      setTickets([]);
    } else {
      setTickets(data || []);
    }

    setLoading(false);
  }

  async function loadThread(ticket) {
    if (!ticket?.id) return;

    setThreadLoading(true);

    const { data, error: threadError } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    if (threadError) {
      console.error("Unable to load support conversation:", threadError);
      setMessages([]);
    } else {
      setMessages(data || []);
    }

    setThreadLoading(false);
  }

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (selected?.id) loadThread(selected);
  }, [selected?.id]);

  const categories = useMemo(() => {
    return [...new Set(tickets.map((ticket) => ticket.category).filter(Boolean))]
      .sort();
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" || ticket.category === categoryFilter;

      const haystack = [
        ticket.ticket_number,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.status,
        ticket.priority,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || haystack.includes(term);

      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [tickets, search, statusFilter, categoryFilter]);

  async function updateStatus(nextStatus) {
    if (!selected?.id || nextStatus === selected.status) return;

    const { error: updateError } = await supabase
      .from("support_tickets")
      .update({ status: nextStatus })
      .eq("id", selected.id);

    if (updateError) {
      console.error("Unable to update ticket status:", updateError);
      return;
    }

    setSelected((current) => ({ ...current, status: nextStatus }));
    await loadTickets();
  }

  async function sendReply(event) {
    event.preventDefault();

    const message = reply.trim();
    if (!message || !selected?.id || sending) return;

    setSending(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSending(false);
      return;
    }

    const { error: messageError } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: selected.id,
        user_id: user.id,
        sender_type: "admin",
        message,
      });

    if (messageError) {
      console.error("Unable to send support reply:", messageError);
      setSending(false);
      return;
    }

    const { error: statusError } = await supabase
      .from("support_tickets")
      .update({ status: "waiting_on_user" })
      .eq("id", selected.id);

    if (statusError) {
      console.error("Reply sent, but ticket status could not be updated:", statusError);
    }

    setReply("");
    setSelected((current) => ({
      ...current,
      status: statusError ? current.status : "waiting_on_user",
    }));

    await Promise.all([loadThread(selected), loadTickets()]);
    setSending(false);
  }

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">User support</span>
          <h1>Support tickets</h1>
          <p>
            Review technical and account requests, respond to users and manage
            the status of each support conversation.
          </p>
        </div>

        <button
          type="button"
          className="admin-user-app-button"
          onClick={loadTickets}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="admin-support-toolbar">
        <label className="admin-support-search">
          <span>Search tickets</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ticket number, subject, description…"
          />
        </label>

        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Category</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {label(category)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="admin-card admin-section-card" role="alert">
          <h2>Tickets unavailable</h2>
          <p>{error}</p>
        </div>
      ) : (
        <div className="admin-support-workspace">
          <aside className="admin-card admin-ticket-list-panel">
            <div className="admin-ticket-list-heading">
              <strong>
                {loading
                  ? "Loading…"
                  : `${filteredTickets.length} ticket${
                      filteredTickets.length === 1 ? "" : "s"
                    }`}
              </strong>
            </div>

            <div className="admin-ticket-list">
              {!loading && filteredTickets.length === 0 ? (
                <p className="admin-ticket-list-empty">
                  No tickets match these filters.
                </p>
              ) : (
                filteredTickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    className={`admin-ticket-list-item${
                      selected?.id === ticket.id ? " selected" : ""
                    }`}
                    onClick={() => setSelected(ticket)}
                  >
                    <div>
                      <strong>{ticket.ticket_number || "Support ticket"}</strong>
                      <span
                        className={`admin-status-pill status-${ticket.status}`}
                      >
                        {STATUS_LABELS[ticket.status] || label(ticket.status)}
                      </span>
                    </div>

                    <h3>{ticket.subject}</h3>
                    <p>{ticket.description}</p>

                    <footer>
                      <span>{label(ticket.category)}</span>
                      <span>{formatDate(ticket.updated_at)}</span>
                    </footer>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="admin-card admin-ticket-detail">
            {!selected ? (
              <div className="admin-ticket-placeholder">
                <span>◇</span>
                <h2>Select a support ticket</h2>
                <p>
                  Choose a request from the list to review the conversation and
                  respond as Verdict Support.
                </p>
              </div>
            ) : (
              <>
                <header className="admin-ticket-detail-head">
                  <div>
                    <span className="admin-eyebrow">
                      {selected.ticket_number || "Support ticket"}
                    </span>
                    <h2>{selected.subject}</h2>
                    <p>{selected.description}</p>
                  </div>

                  <div className="admin-ticket-meta">
                    <span>
                      <b>Category</b>
                      {label(selected.category)}
                    </span>
                    <span>
                      <b>Priority</b>
                      {label(selected.priority)}
                    </span>
                    <span>
                      <b>Created</b>
                      {formatDate(selected.created_at)}
                    </span>
                  </div>
                </header>

                <div className="admin-ticket-status-control">
                  <label htmlFor="admin-ticket-status">Ticket status</label>
                  <select
                    id="admin-ticket-status"
                    value={selected.status}
                    onChange={(event) => updateStatus(event.target.value)}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-support-thread">
                  {threadLoading ? (
                    <p className="admin-empty-state">Loading conversation…</p>
                  ) : messages.length === 0 ? (
                    <p className="admin-empty-state">
                      No conversation messages yet.
                    </p>
                  ) : (
                    messages.map((message) => (
                      <article
                        key={message.id}
                        className={`admin-support-message ${message.sender_type}`}
                      >
                        <div>
                          <strong>
                            {message.sender_type === "admin"
                              ? "Verdict Support"
                              : "User"}
                          </strong>
                          <time>{formatDate(message.created_at)}</time>
                        </div>
                        <p>{message.message}</p>
                      </article>
                    ))
                  )}
                </div>

                <form className="admin-support-reply" onSubmit={sendReply}>
                  <label htmlFor="admin-support-reply">
                    Reply as Verdict Support
                  </label>
                  <textarea
                    id="admin-support-reply"
                    rows="5"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Write a clear support response…"
                  />
                  <div>
                    <small>
                      Do not request passwords, access tokens or other account
                      secrets.
                    </small>
                    <button
                      type="submit"
                      disabled={!reply.trim() || sending}
                    >
                      {sending ? "Sending…" : "Send reply"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
