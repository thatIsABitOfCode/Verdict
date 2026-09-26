import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function formatDuration(ms) {
  const value = Number(ms || 0);

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${value}ms`;
}

function formatProviderName(name) {
  if (!name) return "Unknown";

  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function AdminAIHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHealth = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) {
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

        if (sessionError) {
          throw sessionError;
        }

        const accessToken = session?.access_token;

        if (!accessToken) {
          throw new Error(
            "Your admin session is not available."
          );
        }

        const response = await fetch(
          `${API_URL}/api/admin/ai-health`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const body = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            body?.error ||
              "Unable to load AI & Product Health."
          );
        }

        setData(body);
      } catch (loadError) {
        console.error(
          "Admin AI health load error:",
          loadError
        );

        setError(
          loadError?.message ||
            "Unable to load AI & Product Health."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const configuredProviders = useMemo(
    () =>
      (data?.providers || []).filter(
        (provider) => provider.configured
      ),
    [data]
  );

  const overallReady =
    Number(
      data?.overall?.configuredProviders || 0
    ) > 0;

  if (loading) {
    return (
      <main className="admin-ai-health-page">
        <div className="admin-page-head">
          <div>
            <p className="admin-eyebrow">
              Verdict operations
            </p>

            <h1>AI & Product Health</h1>

            <p className="admin-page-description">
              Loading Verdict AI configuration…
            </p>
          </div>
        </div>

        <section className="admin-panel">
          <div className="admin-empty-state">
            <p>
              Checking server-side AI configuration.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-ai-health-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">
            Verdict operations
          </p>

          <h1>AI & Product Health</h1>

          <p className="admin-page-description">
            Safe operational visibility into
            Verdict&apos;s configured AI routing and
            product safeguards.
          </p>
        </div>

        <button
          type="button"
          className="admin-secondary-button"
          onClick={() =>
            loadHealth({ refresh: true })
          }
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing…"
            : "Refresh"}
        </button>
      </div>

      {error ? (
        <div
          className="admin-error-notice"
          role="alert"
        >
          <strong>
            Unable to load AI health.
          </strong>

          <span>{error}</span>
        </div>
      ) : null}

      {!error && data ? (
        <>
          <div className="admin-info-notice">
            <strong>
              Configuration health, not provider
              uptime.
            </strong>

            <span>
              This page reads Verdict&apos;s
              server-side AI configuration. It does
              not make billable test requests or
              expose API keys.
            </span>
          </div>

          <section className="admin-ai-health-stats">
            <article className="admin-stat-card">
              <span className="admin-stat-label">
                AI routing
              </span>

              <strong>
                {overallReady
                  ? "Configured"
                  : "Unavailable"}
              </strong>

              <small>
                {formatNumber(
                  data.overall
                    ?.configuredProviders
                )}{" "}
                of{" "}
                {formatNumber(
                  data.overall?.totalProviders
                )}{" "}
                providers configured
              </small>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-label">
                Fallback strategy
              </span>

              <strong>Ordered</strong>

              <small>
                {data.routing?.providerOrder
                  ?.map(formatProviderName)
                  .join(" → ") || "—"}
              </small>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-label">
                Provider timeout
              </span>

              <strong>
                {formatDuration(
                  data.routing?.timeoutMs
                )}
              </strong>

              <small>
                Per provider attempt
              </small>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-label">
                Verified-data fallback
              </span>

              <strong>
                {data.routing
                  ?.deterministicVerifiedDataFallback
                  ? "Enabled"
                  : "Not reported"}
              </strong>

              <small>
                Preserves grounded legal behavior
              </small>
            </article>
          </section>

          <section className="admin-panel admin-ai-provider-panel">
            <div className="admin-panel-head">
              <div>
                <p className="admin-eyebrow">
                  Provider routing
                </p>

                <h2>
                  Configured AI providers
                </h2>

                <p>
                  Verdict tries configured providers
                  in priority order and can fall
                  through when a provider is
                  unavailable.
                </p>
              </div>

              <span className="admin-count-pill">
                {configuredProviders.length}{" "}
                configured
              </span>
            </div>

            <div className="admin-ai-provider-grid">
              {(data.providers || []).map(
                (provider) => (
                  <article
                    className="admin-ai-provider-card"
                    key={provider.name}
                  >
                    <div className="admin-ai-provider-card-head">
                      <div>
                        <span className="admin-ai-provider-priority">
                          Priority{" "}
                          {provider.priority}
                        </span>

                        <h3>
                          {provider.label ||
                            formatProviderName(
                              provider.name
                            )}
                        </h3>
                      </div>

                      <span
                        className={`admin-status-badge ${
                          provider.configured
                            ? "is-success"
                            : "is-muted"
                        }`}
                      >
                        {provider.configured
                          ? "Configured"
                          : "Not configured"}
                      </span>
                    </div>

                    <dl className="admin-ai-provider-details">
                      <div>
                        <dt>Provider</dt>
                        <dd>
                          {provider.name}
                        </dd>
                      </div>

                      <div>
                        <dt>Model</dt>

                        <dd className="admin-mono">
                          {provider.model ||
                            "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          Routing status
                        </dt>

                        <dd>
                          {provider.configured
                            ? "Eligible for routing"
                            : "Skipped when routing"}
                        </dd>
                      </div>
                    </dl>
                  </article>
                )
              )}
            </div>
          </section>

          <div className="admin-ai-health-columns">
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <p className="admin-eyebrow">
                    Grounding
                  </p>

                  <h2>
                    Product safeguards
                  </h2>
                </div>
              </div>

              <div className="admin-ai-check-list">
                <div className="admin-ai-check-row">
                  <span
                    className={`admin-ai-check-icon ${
                      data.safeguards
                        ?.legalGroundingRequired
                        ? "is-success"
                        : ""
                    }`}
                  >
                    {data.safeguards
                      ?.legalGroundingRequired
                      ? "✓"
                      : "—"}
                  </span>

                  <div>
                    <strong>
                      Legal grounding required
                    </strong>

                    <p>
                      AI provider availability does
                      not replace Verdict&apos;s
                      verified legal-data
                      requirements.
                    </p>
                  </div>
                </div>

                <div className="admin-ai-check-row">
                  <span
                    className={`admin-ai-check-icon ${
                      data.safeguards
                        ?.providerAvailabilityDoesNotOverrideVerification
                        ? "is-success"
                        : ""
                    }`}
                  >
                    {data.safeguards
                      ?.providerAvailabilityDoesNotOverrideVerification
                      ? "✓"
                      : "—"}
                  </span>

                  <div>
                    <strong>
                      Verification boundary
                      preserved
                    </strong>

                    <p>
                      A working AI provider does not
                      make unverified legal material
                      eligible for grounded answers.
                    </p>
                  </div>
                </div>

                <div className="admin-ai-check-row">
                  <span
                    className={`admin-ai-check-icon ${
                      data.safeguards
                        ?.secretsExposed === false
                        ? "is-success"
                        : ""
                    }`}
                  >
                    {data.safeguards
                      ?.secretsExposed === false
                      ? "✓"
                      : "—"}
                  </span>

                  <div>
                    <strong>
                      Secrets protected
                    </strong>

                    <p>
                      This admin endpoint reports
                      configuration state without
                      returning provider API keys.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <p className="admin-eyebrow">
                    Runtime configuration
                  </p>

                  <h2>
                    Routing limits
                  </h2>
                </div>
              </div>

              <dl className="admin-ai-runtime-list">
                <div>
                  <dt>Strategy</dt>
                  <dd>
                    Ordered fallback
                  </dd>
                </div>

                <div>
                  <dt>Timeout</dt>

                  <dd>
                    {formatDuration(
                      data.routing
                        ?.timeoutMs
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Groq safe input
                    threshold
                  </dt>

                  <dd>
                    {formatNumber(
                      data.routing
                        ?.groqSafeInputChars
                    )}{" "}
                    characters
                  </dd>
                </div>

                <div>
                  <dt>Generated</dt>

                  <dd>
                    {formatDateTime(
                      data.generatedAt
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="admin-panel admin-ai-limitations-panel">
            <div className="admin-panel-head">
              <div>
                <p className="admin-eyebrow">
                  Observability boundary
                </p>

                <h2>
                  What Verdict does not currently
                  measure
                </h2>

                <p>
                  These metrics are intentionally
                  not displayed as live health
                  because the current backend does
                  not persist them.
                </p>
              </div>
            </div>

            <div className="admin-ai-limitations-grid">
              <div>
                <strong>
                  Live provider uptime
                </strong>

                <span>
                  No active probe is performed by
                  this endpoint.
                </span>
              </div>

              <div>
                <strong>
                  Request volume
                </strong>

                <span>
                  Persistent AI request metrics are
                  not available.
                </span>
              </div>

              <div>
                <strong>
                  Success rate
                </strong>

                <span>
                  Provider success/failure history
                  is not persisted.
                </span>
              </div>

              <div>
                <strong>Latency</strong>

                <span>
                  Historical response-time metrics
                  are not persisted.
                </span>
              </div>

              <div>
                <strong>
                  Current cooldown state
                </strong>

                <span>
                  Router cooldown state is currently
                  private to the AI service.
                </span>
              </div>
            </div>

            <p className="admin-ai-health-note">
              {data.note}
            </p>
          </section>
        </>
      ) : null}
    </main>
  );
}