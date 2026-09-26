import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

function formatDate(value) {
  if (!value) return "Not verified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function normaliseStatus(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AdminLegalKnowledge() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadKnowledge() {
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

      const response = await fetch(
        `${API_URL}/api/admin/legal-knowledge`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || "Verdict could not load legal knowledge."
        );
      }

      setData(payload);

      if (!selectedTopicId && payload.topics?.length) {
        setSelectedTopicId(payload.topics[0].id);
      }
    } catch (loadError) {
      console.error(
        "Unable to load Verdict legal knowledge:",
        loadError
      );

      setError(
        loadError.message ||
          "Verdict could not load legal knowledge right now."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKnowledge();
  }, []);

  const filteredTopics = useMemo(() => {
    const topics = data?.topics || [];
    const term = search.trim().toLowerCase();

    return topics.filter((topic) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "ready" && topic.retrievalReady) ||
        (statusFilter === "review" && !topic.retrievalReady) ||
        topic.status === statusFilter;

      const haystack = [
        topic.name,
        topic.slug,
        topic.category,
        topic.summary,
        topic.issue?.name,
        topic.domain?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [data, search, statusFilter]);

  const selectedTopic =
    data?.topics?.find((topic) => topic.id === selectedTopicId) ||
    filteredTopics[0] ||
    null;

  const summary = data?.summary || {};

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">
            Verified legal knowledge
          </span>
          <h1>Legal Knowledge</h1>
          <p>
            Review the legal domains, topics, rules and official sources
            that support Verdict's grounded legal guidance.
          </p>
        </div>

        <button
          type="button"
          className="admin-user-app-button"
          onClick={loadKnowledge}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <article className="admin-card admin-section-card" role="alert">
          <h2>Legal knowledge unavailable</h2>
          <p>{error}</p>
        </article>
      ) : (
        <>
          <div className="admin-stat-grid">
            <article className="admin-card admin-stat-card">
              <span>Legal domains</span>
              <strong>{loading ? "—" : summary.domains ?? 0}</strong>
              <small>
                {loading ? "Loading…" : `${summary.activeDomains ?? 0} active`}
              </small>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Published topics</span>
              <strong>
                {loading ? "—" : summary.publishedTopics ?? 0}
              </strong>
              <small>
                {loading ? "Loading…" : `${summary.topics ?? 0} total`}
              </small>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Verified rules</span>
              <strong>
                {loading ? "—" : summary.verifiedRules ?? 0}
              </strong>
              <small>
                {loading
                  ? "Loading…"
                  : `${summary.rulesNeedingReview ?? 0} need review`}
              </small>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Retrieval-ready</span>
              <strong>
                {loading ? "—" : summary.retrievalReadyTopics ?? 0}
              </strong>
              <small>Published topics with verified rules</small>
            </article>
          </div>

          <div className="admin-knowledge-safety">
            <strong>Knowledge safety boundary</strong>
            <p>
              This workspace is currently read-only. A topic is shown as
              retrieval-ready only when it is published and has verified
              legal rules. Reviewing a record here does not verify or
              publish it.
            </p>
          </div>

          <div className="admin-users-toolbar">
            <label className="admin-users-search">
              <span>Search knowledge</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Topic, domain, issue or category…"
              />
            </label>

            <label>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">All topics</option>
                <option value="ready">Retrieval-ready</option>
                <option value="review">Needs attention</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>

          <div className="admin-knowledge-workspace">
            <article className="admin-card admin-knowledge-list">
              <div className="admin-users-card-head">
                <div>
                  <h2>Legal topics</h2>
                  <p>
                    {loading
                      ? "Loading topics…"
                      : `${filteredTopics.length} topic${
                          filteredTopics.length === 1 ? "" : "s"
                        } shown`}
                  </p>
                </div>
              </div>

              <div className="admin-knowledge-topic-list">
                {!loading && filteredTopics.length === 0 ? (
                  <p className="admin-users-empty">
                    No legal topics match the current filters.
                  </p>
                ) : (
                  filteredTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      className={`admin-knowledge-topic${
                        selectedTopic?.id === topic.id
                          ? " selected"
                          : ""
                      }`}
                      onClick={() => setSelectedTopicId(topic.id)}
                    >
                      <div className="admin-knowledge-topic-head">
                        <strong>{topic.name}</strong>

                        <span
                          className={`admin-role-pill${
                            topic.retrievalReady ? " admin" : ""
                          }`}
                        >
                          {topic.retrievalReady
                            ? "Retrieval-ready"
                            : normaliseStatus(topic.status)}
                        </span>
                      </div>

                      <span>
                        {[topic.domain?.name, topic.issue?.name]
                          .filter(Boolean)
                          .join(" · ") || "Uncategorised"}
                      </span>

                      <small>
                        {topic.counts?.verifiedRules ?? 0} verified rule
                        {(topic.counts?.verifiedRules ?? 0) === 1
                          ? ""
                          : "s"}{" "}
                        · {topic.counts?.linkedSources ?? 0} linked source
                        {(topic.counts?.linkedSources ?? 0) === 1
                          ? ""
                          : "s"}
                      </small>
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="admin-card admin-knowledge-detail">
              {!selectedTopic ? (
                <div className="admin-users-empty">
                  Select a legal topic to inspect its verified knowledge.
                </div>
              ) : (
                <>
                  <div className="admin-knowledge-detail-head">
                    <div>
                      <span className="admin-eyebrow">
                        {selectedTopic.category}
                      </span>
                      <h2>{selectedTopic.name}</h2>
                      <p>
                        {selectedTopic.summary ||
                          "No topic summary has been added."}
                      </p>
                    </div>

                    <span
                      className={`admin-role-pill${
                        selectedTopic.retrievalReady ? " admin" : ""
                      }`}
                    >
                      {selectedTopic.retrievalReady
                        ? "Retrieval-ready"
                        : "Needs attention"}
                    </span>
                  </div>

                  <div className="admin-knowledge-meta">
                    <div>
                      <span>Domain</span>
                      <strong>
                        {selectedTopic.domain?.name || "Not linked"}
                      </strong>
                    </div>
                    <div>
                      <span>Issue type</span>
                      <strong>
                        {selectedTopic.issue?.name || "Not linked"}
                      </strong>
                    </div>
                    <div>
                      <span>Topic status</span>
                      <strong>
                        {normaliseStatus(selectedTopic.status)}
                      </strong>
                    </div>
                  </div>

                  <section className="admin-knowledge-section">
                    <div className="admin-dashboard-section-head">
                      <div>
                        <h3>Legal rules</h3>
                        <p>
                          Only rules marked verified are used as verified
                          legal guidance.
                        </p>
                      </div>
                    </div>

                    <div className="admin-knowledge-rule-list">
                      {selectedTopic.rules?.length ? (
                        selectedTopic.rules.map((rule) => (
                          <article
                            key={rule.id}
                            className="admin-knowledge-rule"
                          >
                            <div className="admin-knowledge-rule-head">
                              <div>
                                <strong>{rule.title}</strong>
                                <span>
                                  {normaliseStatus(rule.rule_type)}
                                </span>
                              </div>

                              <span
                                className={`admin-verification-pill${
                                  rule.verification_status === "verified"
                                    ? " confirmed"
                                    : ""
                                }`}
                              >
                                {normaliseStatus(
                                  rule.verification_status
                                )}
                              </span>
                            </div>

                            <p>{rule.plain_language_text}</p>

                            <div className="admin-knowledge-rule-meta">
                              {rule.section_reference && (
                                <span>
                                  Section: {rule.section_reference}
                                </span>
                              )}

                              {rule.citation_label && (
                                <span>{rule.citation_label}</span>
                              )}

                              <span>
                                Last verified:{" "}
                                {formatDate(rule.last_verified_at)}
                              </span>
                            </div>

                            {rule.source && (
                              <div className="admin-knowledge-source-inline">
                                <strong>{rule.source.title}</strong>
                                <span>
                                  {rule.source.authority} ·{" "}
                                  {rule.source.jurisdiction}
                                </span>
                              </div>
                            )}
                          </article>
                        ))
                      ) : (
                        <p className="admin-knowledge-muted">
                          No legal rules are attached to this topic.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="admin-knowledge-section">
                    <div className="admin-dashboard-section-head">
                      <div>
                        <h3>Linked sources</h3>
                        <p>
                          Official authorities connected to this topic.
                        </p>
                      </div>
                    </div>

                    <div className="admin-knowledge-source-list">
                      {selectedTopic.sourceLinks?.length ? (
                        selectedTopic.sourceLinks.map((link) => (
                          <article
                            key={link.id}
                            className="admin-knowledge-source"
                          >
                            <div>
                              <strong>
                                {link.source?.title ||
                                  "Unavailable source"}
                              </strong>
                              <span>
                                {link.source?.authority || "Unknown authority"}
                              </span>
                            </div>

                            <div className="admin-knowledge-source-flags">
                              {link.is_primary && (
                                <span className="admin-role-pill admin">
                                  Primary
                                </span>
                              )}

                              <span
                                className={`admin-verification-pill${
                                  link.source?.is_verified
                                    ? " confirmed"
                                    : ""
                                }`}
                              >
                                {link.source?.is_verified
                                  ? "Verified"
                                  : "Unverified"}
                              </span>
                            </div>

                            {link.relevance_note && (
                              <p>{link.relevance_note}</p>
                            )}

                            {link.source?.official_url && (
                              <a
                                href={link.source.official_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open official source ↗
                              </a>
                            )}
                          </article>
                        ))
                      ) : (
                        <p className="admin-knowledge-muted">
                          No source links are attached to this topic.
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}
