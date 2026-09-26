import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

const CATEGORY_LABELS = {
  matters: "Matters",
  evidence: "Evidence",
  evidence_integrity: "Evidence Integrity",
  support: "Support",
  legal_knowledge: "Legal Knowledge",
  referrals: "Referrals",
};

const CATEGORY_ICONS = {
  matters: "◇",
  evidence: "▣",
  evidence_integrity: "✓",
  support: "◌",
  legal_knowledge: "§",
  referrals: "↗",
};

function formatDate(value) {
  if (!value) return "Unknown time";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeTime(value) {
  if (!value) return "";

  const date = new Date(value);
  const time = date.getTime();

  if (!Number.isFinite(time)) return "";

  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) {
    const count = Math.floor(diff / minute);
    return `${count} min${count === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    const count = Math.floor(diff / hour);
    return `${count} hour${count === 1 ? "" : "s"} ago`;
  }
  if (diff < 7 * day) {
    const count = Math.floor(diff / day);
    return `${count} day${count === 1 ? "" : "s"} ago`;
  }

  return formatDate(value);
}

function humanize(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function AdminActivity() {
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    last24Hours: 0,
    last7Days: 0,
    categories: {},
  });
  const [note, setNote] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        throw new Error("Your admin session has expired. Please sign in again.");
      }

      const response = await fetch(`${API_URL}/api/admin/activity`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to load system activity."
        );
      }

      const nextActivities = Array.isArray(payload?.activities)
        ? payload.activities
        : [];

      setActivities(nextActivities);
      setSummary({
        total: payload?.summary?.total || 0,
        last24Hours: payload?.summary?.last24Hours || 0,
        last7Days: payload?.summary?.last7Days || 0,
        categories: payload?.summary?.categories || {},
      });
      setNote(payload?.note || "");
      setGeneratedAt(payload?.generatedAt || null);

      setSelectedActivity((current) => {
        if (!current) return null;

        return (
          nextActivities.find((item) => item.id === current.id) || null
        );
      });
    } catch (loadError) {
      console.error("Unable to load admin activity:", loadError);
      setError(
        loadError?.message || "Unable to load system activity."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const categories = useMemo(() => {
    const found = new Set(
      activities.map((item) => item.category).filter(Boolean)
    );

    return Array.from(found).sort((a, b) =>
      (CATEGORY_LABELS[a] || a).localeCompare(
        CATEGORY_LABELS[b] || b
      )
    );
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();

    return activities.filter((item) => {
      if (category !== "all" && item.category !== category) {
        return false;
      }

      if (timeRange !== "all") {
        const eventTime = new Date(item.occurredAt).getTime();

        if (!Number.isFinite(eventTime)) return false;

        const maximumAge =
          timeRange === "24h"
            ? 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;

        if (now - eventTime > maximumAge) {
          return false;
        }
      }

      if (!query) return true;

      const searchable = [
        item.title,
        item.description,
        item.type,
        item.category,
        item.entityType,
        item.entityId,
        item.userId,
        ...Object.values(item.metadata || {}),
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [activities, category, search, timeRange]);

  const categoryCount = (key) =>
    summary.categories?.[key] || 0;

  return (
    <div className="admin-page admin-activity-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Operations</p>
          <h1>System Activity</h1>
          <p className="admin-page-description">
            Review timestamped operational activity across Verdict.
          </p>
        </div>

        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => loadActivity(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh activity"}
        </button>
      </div>

      {note ? (
        <div className="admin-info-notice">
          <strong>Operational activity, not a complete audit log.</strong>
          <span>{note}</span>
        </div>
      ) : null}

      {error ? (
        <div className="admin-error-notice">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadActivity()}
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="admin-stat-grid admin-activity-stats">
        <div className="admin-stat-card">
          <span className="admin-stat-label">Total activity</span>
          <strong>{summary.total}</strong>
          <small>Timestamped records</small>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-label">Last 24 hours</span>
          <strong>{summary.last24Hours}</strong>
          <small>Recent activity</small>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-label">Last 7 days</span>
          <strong>{summary.last7Days}</strong>
          <small>Weekly activity</small>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-label">Activity areas</span>
          <strong>
            {
              Object.values(summary.categories || {}).filter(
                (count) => count > 0
              ).length
            }
          </strong>
          <small>Verdict product areas</small>
        </div>
      </div>

      <div className="admin-activity-category-strip">
        {Object.keys(CATEGORY_LABELS).map((key) => (
          <button
            type="button"
            key={key}
            className={`admin-activity-category-card ${
              category === key ? "selected" : ""
            }`}
            onClick={() =>
              setCategory((current) =>
                current === key ? "all" : key
              )
            }
          >
            <span>{CATEGORY_ICONS[key]}</span>
            <div>
              <strong>{categoryCount(key)}</strong>
              <small>{CATEGORY_LABELS[key]}</small>
            </div>
          </button>
        ))}
      </div>

      <div className="admin-toolbar admin-activity-toolbar">
        <div className="admin-search-wrap">
          <span>⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activity, record IDs or status…"
            aria-label="Search system activity"
          />
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter activity by category"
        >
          <option value="all">All areas</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {CATEGORY_LABELS[item] || humanize(item)}
            </option>
          ))}
        </select>

        <select
          value={timeRange}
          onChange={(event) => setTimeRange(event.target.value)}
          aria-label="Filter activity by time"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
      </div>

      <div className="admin-activity-workspace">
        <section className="admin-panel admin-activity-feed">
          <div className="admin-panel-head">
            <div>
              <h2>Activity feed</h2>
              <p>
                {filteredActivities.length} of {activities.length} events
              </p>
            </div>

            {generatedAt ? (
              <small>
                Generated {formatRelativeTime(generatedAt)}
              </small>
            ) : null}
          </div>

          {loading ? (
            <div className="admin-empty-state">
              <strong>Loading system activity…</strong>
              <p>Verdict is reading the current operational records.</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="admin-empty-state">
              <strong>No activity matches these filters.</strong>
              <p>
                Try another product area, time range or search term.
              </p>
            </div>
          ) : (
            <div className="admin-activity-list">
              {filteredActivities.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`admin-activity-item ${
                    selectedActivity?.id === item.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => setSelectedActivity(item)}
                >
                  <span className="admin-activity-icon">
                    {CATEGORY_ICONS[item.category] || "•"}
                  </span>

                  <span className="admin-activity-item-main">
                    <span className="admin-activity-item-head">
                      <strong>{item.title}</strong>
                      <time dateTime={item.occurredAt}>
                        {formatRelativeTime(item.occurredAt)}
                      </time>
                    </span>

                    <span className="admin-activity-description">
                      {item.description || "No additional description."}
                    </span>

                    <span className="admin-activity-item-meta">
                      <span>
                        {CATEGORY_LABELS[item.category] ||
                          humanize(item.category)}
                      </span>
                      <span>{humanize(item.entityType)}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="admin-panel admin-activity-detail">
          {selectedActivity ? (
            <>
              <div className="admin-panel-head">
                <div>
                  <p className="admin-eyebrow">
                    {CATEGORY_LABELS[selectedActivity.category] ||
                      humanize(selectedActivity.category)}
                  </p>
                  <h2>{selectedActivity.title}</h2>
                </div>

                <button
                  type="button"
                  className="admin-icon-button"
                  onClick={() => setSelectedActivity(null)}
                  aria-label="Close activity details"
                >
                  ×
                </button>
              </div>

              <p className="admin-activity-detail-description">
                {selectedActivity.description ||
                  "No additional description."}
              </p>

              <dl className="admin-activity-detail-grid">
                <div>
                  <dt>Occurred</dt>
                  <dd>{formatDate(selectedActivity.occurredAt)}</dd>
                </div>

                <div>
                  <dt>Event type</dt>
                  <dd>{humanize(selectedActivity.type)}</dd>
                </div>

                <div>
                  <dt>Record type</dt>
                  <dd>{humanize(selectedActivity.entityType)}</dd>
                </div>

                <div>
                  <dt>Record ID</dt>
                  <dd className="admin-mono">
                    {selectedActivity.entityId || "—"}
                  </dd>
                </div>

                {selectedActivity.userId ? (
                  <div>
                    <dt>Related user ID</dt>
                    <dd className="admin-mono">
                      {selectedActivity.userId}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {Object.keys(selectedActivity.metadata || {}).length >
              0 ? (
                <div className="admin-activity-metadata">
                  <h3>Record context</h3>

                  <dl>
                    {Object.entries(
                      selectedActivity.metadata || {}
                    ).map(([key, value]) => (
                      <div key={key}>
                        <dt>{humanize(key)}</dt>
                        <dd>
                          {typeof value === "boolean"
                            ? value
                              ? "Yes"
                              : "No"
                            : value ?? "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <div className="admin-activity-boundary">
                <strong>Activity boundary</strong>
                <p>
                  This event comes from an existing timestamped Verdict
                  record. Unless the source record explicitly identifies
                  an actor, this page does not claim who performed the
                  action.
                </p>
              </div>
            </>
          ) : (
            <div className="admin-empty-state admin-activity-detail-empty">
              <span className="admin-activity-empty-icon">≡</span>
              <strong>Select an activity event</strong>
              <p>
                Choose an event from the feed to inspect its recorded
                context.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default AdminActivity;
