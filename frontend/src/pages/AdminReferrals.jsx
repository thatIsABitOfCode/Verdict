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

function normalise(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AdminReferrals() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrganisationId, setSelectedOrganisationId] =
    useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReferrals() {
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

      const response = await fetch(`${API_URL}/api/admin/referrals`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || "Verdict could not load referrals."
        );
      }

      setData(payload);

      if (
        !selectedOrganisationId &&
        payload.organisations?.length
      ) {
        setSelectedOrganisationId(payload.organisations[0].id);
      }
    } catch (loadError) {
      console.error("Unable to load Verdict referrals:", loadError);
      setError(
        loadError.message ||
          "Verdict could not load referrals right now."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferrals();
  }, []);

  const filteredOrganisations = useMemo(() => {
    const organisations = data?.organisations || [];
    const term = search.trim().toLowerCase();

    return organisations.filter((organisation) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "ready" &&
          organisation.userFacingEligible) ||
        (statusFilter === "attention" &&
          !organisation.userFacingEligible) ||
        (statusFilter === "verified" &&
          organisation.is_verified) ||
        organisation.status === statusFilter;

      const haystack = [
        organisation.name,
        organisation.organisation_type,
        organisation.description,
        organisation.coverage_area,
        organisation.province,
        ...(organisation.services || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [data, search, statusFilter]);

  const selectedOrganisation =
    data?.organisations?.find(
      (organisation) =>
        organisation.id === selectedOrganisationId
    ) ||
    filteredOrganisations[0] ||
    null;

  const summary = data?.summary || {};

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">Referral network</span>
          <h1>Referrals</h1>
          <p>
            Review the verified organisations and legal-topic referral
            routes Verdict can use to connect people with appropriate
            support.
          </p>
        </div>

        <button
          type="button"
          className="admin-user-app-button"
          onClick={loadReferrals}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <article className="admin-card admin-section-card" role="alert">
          <h2>Referrals unavailable</h2>
          <p>{error}</p>
        </article>
      ) : (
        <>
          <div className="admin-stat-grid">
            <article className="admin-card admin-stat-card">
              <span>Organisations</span>
              <strong>
                {loading ? "—" : summary.organisations ?? 0}
              </strong>
              <small>
                {loading
                  ? "Loading…"
                  : `${summary.activeOrganisations ?? 0} active`}
              </small>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Verified</span>
              <strong>
                {loading
                  ? "—"
                  : summary.verifiedOrganisations ?? 0}
              </strong>
              <small>Verified referral organisations</small>
            </article>

            <article className="admin-card admin-stat-card">
              <span>Referral routes</span>
              <strong>{loading ? "—" : summary.routes ?? 0}</strong>
              <small>
                {loading
                  ? "Loading…"
                  : `${summary.activeRoutes ?? 0} active`}
              </small>
            </article>

            <article className="admin-card admin-stat-card">
              <span>User-facing ready</span>
              <strong>
                {loading
                  ? "—"
                  : summary.userFacingReadyRoutes ?? 0}
              </strong>
              <small>
                {loading
                  ? "Loading…"
                  : `${summary.routesNeedingAttention ?? 0} need attention`}
              </small>
            </article>
          </div>

          <div className="admin-knowledge-safety">
            <strong>Referral safety boundary</strong>
            <p>
              This workspace is currently read-only. Verdict only treats
              an organisation as user-facing eligible when it is active
              and verified. A route must also be active before it is
              considered ready.
            </p>
          </div>

          <div className="admin-users-toolbar">
            <label className="admin-users-search">
              <span>Search referrals</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Organisation, service, province or coverage…"
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
                <option value="all">All organisations</option>
                <option value="ready">User-facing eligible</option>
                <option value="attention">Needs attention</option>
                <option value="verified">Verified</option>
                <option value="active">Active</option>
              </select>
            </label>
          </div>

          <div className="admin-referral-workspace">
            <article className="admin-card admin-referral-list">
              <div className="admin-users-card-head">
                <div>
                  <h2>Organisations</h2>
                  <p>
                    {loading
                      ? "Loading organisations…"
                      : `${filteredOrganisations.length} organisation${
                          filteredOrganisations.length === 1 ? "" : "s"
                        } shown`}
                  </p>
                </div>
              </div>

              <div className="admin-referral-org-list">
                {!loading &&
                filteredOrganisations.length === 0 ? (
                  <p className="admin-users-empty">
                    No organisations match the current filters.
                  </p>
                ) : (
                  filteredOrganisations.map((organisation) => (
                    <button
                      key={organisation.id}
                      type="button"
                      className={`admin-referral-org${
                        selectedOrganisation?.id === organisation.id
                          ? " selected"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedOrganisationId(organisation.id)
                      }
                    >
                      <div className="admin-referral-org-head">
                        <strong>{organisation.name}</strong>

                        <span
                          className={`admin-role-pill${
                            organisation.userFacingEligible
                              ? " admin"
                              : ""
                          }`}
                        >
                          {organisation.userFacingEligible
                            ? "Eligible"
                            : "Review"}
                        </span>
                      </div>

                      <span>
                        {normalise(organisation.organisation_type)}
                      </span>

                      <small>
                        {organisation.province ||
                          organisation.coverage_area ||
                          "Coverage not specified"}{" "}
                        · {organisation.counts?.routes ?? 0} route
                        {(organisation.counts?.routes ?? 0) === 1
                          ? ""
                          : "s"}
                      </small>
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="admin-card admin-referral-detail">
              {!selectedOrganisation ? (
                <div className="admin-users-empty">
                  Select an organisation to inspect its referral
                  information.
                </div>
              ) : (
                <>
                  <div className="admin-referral-detail-head">
                    <div>
                      <span className="admin-eyebrow">
                        {normalise(
                          selectedOrganisation.organisation_type
                        )}
                      </span>
                      <h2>{selectedOrganisation.name}</h2>
                      <p>
                        {selectedOrganisation.description ||
                          "No organisation description has been added."}
                      </p>
                    </div>

                    <div className="admin-referral-flags">
                      <span
                        className={`admin-verification-pill${
                          selectedOrganisation.is_verified
                            ? " confirmed"
                            : ""
                        }`}
                      >
                        {selectedOrganisation.is_verified
                          ? "Verified"
                          : "Unverified"}
                      </span>

                      <span
                        className={`admin-role-pill${
                          selectedOrganisation.status === "active"
                            ? " admin"
                            : ""
                        }`}
                      >
                        {normalise(selectedOrganisation.status)}
                      </span>
                    </div>
                  </div>

                  <div className="admin-referral-meta">
                    <div>
                      <span>Coverage</span>
                      <strong>
                        {selectedOrganisation.coverage_area ||
                          "Not specified"}
                      </strong>
                    </div>

                    <div>
                      <span>Province</span>
                      <strong>
                        {selectedOrganisation.province ||
                          "Not specified"}
                      </strong>
                    </div>

                    <div>
                      <span>Last verified</span>
                      <strong>
                        {formatDate(
                          selectedOrganisation.last_verified_at
                        )}
                      </strong>
                    </div>
                  </div>

                  <section className="admin-referral-section">
                    <h3>Services</h3>

                    {selectedOrganisation.services?.length ? (
                      <div className="admin-referral-services">
                        {selectedOrganisation.services.map(
                          (service) => (
                            <span key={service}>{service}</span>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="admin-knowledge-muted">
                        No services are listed.
                      </p>
                    )}
                  </section>

                  <section className="admin-referral-section">
                    <h3>Contact & eligibility</h3>

                    <div className="admin-referral-contact-grid">
                      <div>
                        <span>Phone</span>
                        <strong>
                          {selectedOrganisation.phone ||
                            "Not provided"}
                        </strong>
                      </div>
                      <div>
                        <span>Email</span>
                        <strong>
                          {selectedOrganisation.email ||
                            "Not provided"}
                        </strong>
                      </div>
                    </div>

                    {selectedOrganisation.eligibility_notes && (
                      <div className="admin-referral-note">
                        <strong>Eligibility notes</strong>
                        <p>
                          {selectedOrganisation.eligibility_notes}
                        </p>
                      </div>
                    )}

                    {selectedOrganisation.website_url && (
                      <a
                        className="admin-referral-link"
                        href={selectedOrganisation.website_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open organisation website ↗
                      </a>
                    )}
                  </section>

                  <section className="admin-referral-section">
                    <div className="admin-dashboard-section-head">
                      <div>
                        <h3>Referral routes</h3>
                        <p>
                          Legal topics that can route users to this
                          organisation.
                        </p>
                      </div>
                    </div>

                    <div className="admin-referral-route-list">
                      {selectedOrganisation.routes?.length ? (
                        selectedOrganisation.routes.map((route) => (
                          <article
                            key={route.id}
                            className="admin-referral-route"
                          >
                            <div className="admin-referral-route-head">
                              <div>
                                <strong>{route.title}</strong>
                                <span>
                                  {route.topic?.name ||
                                    "Legal topic unavailable"}{" "}
                                  · {normalise(route.route_type)}
                                </span>
                              </div>

                              <span
                                className={`admin-role-pill${
                                  route.userFacingReady
                                    ? " admin"
                                    : ""
                                }`}
                              >
                                {route.userFacingReady
                                  ? "Ready"
                                  : normalise(route.status)}
                              </span>
                            </div>

                            {route.instructions && (
                              <p>{route.instructions}</p>
                            )}

                            {route.eligibility_notes && (
                              <div className="admin-referral-route-note">
                                <strong>Route eligibility</strong>
                                <span>
                                  {route.eligibility_notes}
                                </span>
                              </div>
                            )}

                            {route.urgency_note && (
                              <div className="admin-referral-route-note urgent">
                                <strong>Urgency</strong>
                                <span>{route.urgency_note}</span>
                              </div>
                            )}

                            {route.official_url && (
                              <a
                                href={route.official_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open official referral route ↗
                              </a>
                            )}
                          </article>
                        ))
                      ) : (
                        <p className="admin-knowledge-muted">
                          No referral routes are linked to this
                          organisation.
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
