import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

function formatDate(value) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function providerLabel(value) {
  if (!value) return "Unknown";
  if (value === "email") return "Email";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your Verdict session is unavailable.");
      }

      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || "Verdict could not load users."
        );
      }

      setUsers(payload.users || []);
    } catch (loadError) {
      console.error("Unable to load Verdict admin users:", loadError);
      setUsers([]);
      setError(
        loadError.message || "Verdict could not load users right now."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((user) => user.isAdmin).length,
      confirmed: users.filter((user) => user.emailConfirmedAt).length,
      signedIn: users.filter((user) => user.lastSignInAt).length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "admin" && user.isAdmin) ||
        (roleFilter === "user" && !user.isAdmin);

      const haystack = [
        user.displayName,
        user.email,
        user.phone,
        user.provider,
        user.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesRole && (!term || haystack.includes(term));
    });
  }, [users, search, roleFilter]);

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">Account administration</span>
          <h1>Users</h1>
          <p>
            Review Verdict accounts and identify which authenticated users
            currently have administrative access.
          </p>
        </div>

        <button
          type="button"
          className="admin-user-app-button"
          onClick={loadUsers}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="admin-card admin-section-card" role="alert">
          <h2>Users unavailable</h2>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="admin-stat-grid">
            <article className="admin-card admin-stat-card">
              <span>Total accounts</span>
              <strong>{loading ? "—" : stats.total}</strong>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Admins</span>
              <strong>{loading ? "—" : stats.admins}</strong>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Email confirmed</span>
              <strong>{loading ? "—" : stats.confirmed}</strong>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Have signed in</span>
              <strong>{loading ? "—" : stats.signedIn}</strong>
            </article>
          </div>

          <div className="admin-users-toolbar">
            <label className="admin-users-search">
              <span>Search users</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, phone or user ID…"
              />
            </label>

            <label>
              <span>Access</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="all">All accounts</option>
                <option value="admin">Admins</option>
                <option value="user">Standard users</option>
              </select>
            </label>
          </div>

          <article className="admin-card admin-users-card">
            <div className="admin-users-card-head">
              <div>
                <h2>Verdict accounts</h2>
                <p>
                  {loading
                    ? "Loading authenticated users…"
                    : `${filteredUsers.length} account${
                        filteredUsers.length === 1 ? "" : "s"
                      } shown`}
                </p>
              </div>
            </div>

            {!loading && filteredUsers.length === 0 ? (
              <p className="admin-users-empty">
                No accounts match the current filters.
              </p>
            ) : (
              <div className="admin-users-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Access</th>
                      <th>Sign-in method</th>
                      <th>Joined</th>
                      <th>Last sign-in</th>
                      <th>Email</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="admin-user-identity">
                            <span className="admin-user-avatar">
                              {(user.displayName || user.email || "V")
                                .charAt(0)
                                .toUpperCase()}
                            </span>

                            <div>
                              <strong>{user.displayName}</strong>
                              <span>{user.email || user.phone || user.id}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`admin-role-pill${
                              user.isAdmin ? " admin" : ""
                            }`}
                          >
                            {user.isAdmin ? "Admin" : "User"}
                          </span>
                        </td>

                        <td>{providerLabel(user.provider)}</td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>{formatDate(user.lastSignInAt)}</td>

                        <td>
                          <span
                            className={`admin-verification-pill${
                              user.emailConfirmedAt ? " confirmed" : ""
                            }`}
                          >
                            {user.emailConfirmedAt
                              ? "Confirmed"
                              : "Unconfirmed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
