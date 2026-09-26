import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_user: "Waiting on user",
  resolved: "Resolved",
  closed: "Closed",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: ticketError } = await supabase
      .from("support_tickets")
      .select(
        "id, ticket_number, subject, category, status, priority, created_at, updated_at"
      )
      .order("updated_at", { ascending: false });

    if (ticketError) {
      console.error("Unable to load admin dashboard:", ticketError);
      setTickets([]);
      setError("Verdict could not load the support dashboard right now.");
      setLoading(false);
      return;
    }

    setTickets(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((ticket) => ticket.status === "open").length;
    const inProgress = tickets.filter(
      (ticket) => ticket.status === "in_progress"
    ).length;
    const waiting = tickets.filter(
      (ticket) => ticket.status === "waiting_on_user"
    ).length;

    return { total, open, inProgress, waiting };
  }, [tickets]);

  const recentTickets = tickets.slice(0, 5);

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">Admin dashboard</span>
          <h1>Support operations</h1>
          <p>
            A live overview of Verdict&apos;s current technical-support workload.
            These figures are calculated from the existing support ticket data,
            not placeholder dashboard numbers.
          </p>
        </div>

        <button
          type="button"
          className="admin-user-app-button"
          onClick={loadDashboard}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="admin-card admin-section-card" role="alert">
          <h2>Dashboard unavailable</h2>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="admin-stat-grid">
            <article className="admin-card admin-stat-card">
              <span>Total support tickets</span>
              <strong>{loading ? "—" : stats.total}</strong>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Open</span>
              <strong>{loading ? "—" : stats.open}</strong>
            </article>

            <article className="admin-card admin-stat-card">
              <span>In progress</span>
              <strong>{loading ? "—" : stats.inProgress}</strong>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Waiting on user</span>
              <strong>{loading ? "—" : stats.waiting}</strong>
            </article>
          </div>

          <div className="admin-section-grid">
            <article className="admin-card admin-section-card">
              <div className="admin-dashboard-section-head">
                <div>
                  <h2>Recent support tickets</h2>
                  <p>Most recently updated requests from Verdict users.</p>
                </div>

                <button
                  type="button"
                  className="admin-text-action"
                  onClick={() => navigate("/admin/support")}
                >
                  View all tickets
                </button>
              </div>

              {loading ? (
                <p className="admin-empty-state">Loading tickets…</p>
              ) : recentTickets.length === 0 ? (
                <p className="admin-empty-state">
                  No support tickets have been submitted yet.
                </p>
              ) : (
                <div className="admin-ticket-table-wrap">
                  <table className="admin-ticket-table">
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          onClick={() => navigate("/admin/support")}
                        >
                          <td>
                            <strong>
                              {ticket.ticket_number || "Support ticket"}
                            </strong>
                            <span>{ticket.subject}</span>
                          </td>
                          <td>{ticket.category || "—"}</td>
                          <td>
                            <span
                              className={`admin-status-pill status-${ticket.status}`}
                            >
                              {STATUS_LABELS[ticket.status] ||
                                ticket.status?.replaceAll("_", " ") ||
                                "Unknown"}
                            </span>
                          </td>
                          <td>{formatDate(ticket.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <aside className="admin-card admin-section-card">
              <h2>Admin tools</h2>
              <p>
                Use the administration workspace to support Verdict users and
                manage operational features.
              </p>

              <div className="admin-quick-actions">
                <button
                  type="button"
                  onClick={() => navigate("/admin/support")}
                >
                  <strong>Support Tickets</strong>
                  <span>Review and respond to user requests</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/home")}
                >
                  <strong>View User App</strong>
                  <span>See Verdict from the normal user experience</span>
                </button>
              </div>

              <div className="admin-dashboard-note">
                <strong>More admin areas are coming next.</strong>
                <p>
                  Users, Legal Knowledge, Referrals, System Activity and AI &
                  Product Health will be connected only as their real data and
                  permissions are implemented.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
