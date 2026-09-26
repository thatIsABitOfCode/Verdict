import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabaseClient";

import {
  exportCaseSummaryPdf,
} from "../utils/exportCaseSummaryPdf";

import "../styles/caseSummary.css";

function formatDate(value) {
  if (!value) {
    return "Not provided";
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function CaseSummary() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    matterId,
  } = useParams();

  const [
    matter,
    setMatter,
  ] = useState(
    location.state?.matter ||
      null
  );

  const [
    evidence,
    setEvidence,
  ] = useState([]);

  const [
    timeline,
    setTimeline,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    exporting,
    setExporting,
  ] = useState(false);

  const [
    guidance,
    setGuidance,
  ] = useState(null);

  const [
    guidanceLoading,
    setGuidanceLoading,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      setLoading(true);
      setError("");

      try {
        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth
            .getUser();

        if (
          userError ||
          !user
        ) {
          throw new Error(
            "Your session could not be verified."
          );
        }

        const [
          matterResult,
          evidenceResult,
          timelineResult,
        ] =
          await Promise.all([
            supabase
              .from("matters")
              .select("*")
              .eq(
                "id",
                matterId
              )
              .eq(
                "user_id",
                user.id
              )
              .single(),

            supabase
              .from("evidence")
              .select("*")
              .eq(
                "matter_id",
                matterId
              )
              .eq(
                "user_id",
                user.id
              )
              .order(
                "created_at",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "timeline_events"
              )
              .select("*")
              .eq(
                "matter_id",
                matterId
              )
              .eq(
                "user_id",
                user.id
              )
              .order(
                "event_date",
                {
                  ascending:
                    true,
                }
              ),
          ]);

        if (
          matterResult.error
        ) {
          throw matterResult.error;
        }

        if (
          evidenceResult.error
        ) {
          throw evidenceResult.error;
        }

        if (
          timelineResult.error
        ) {
          throw timelineResult.error;
        }

        if (!mounted) {
          return;
        }

        setMatter(
          matterResult.data
        );

        setEvidence(
          evidenceResult.data ||
            []
        );

        setTimeline(
          timelineResult.data ||
            []
        );

        const story =
          matterResult.data
            ?.story?.trim();

        if (story) {
          setGuidanceLoading(
            true
          );

          try {
            const {
              data: {
                session,
              },
              error:
                sessionError,
            } =
              await supabase.auth
                .getSession();

            if (
              sessionError ||
              !session?.access_token
            ) {
              throw new Error(
                "Your session could not be verified."
              );
            }

            const response =
              await fetch(
                "http://localhost:3001/api/legal/search",
                {
                  method: "POST",
                  headers: {
                    "Content-Type":
                      "application/json",
                    Authorization:
                      `Bearer ${session.access_token}`,
                  },
                  body:
                    JSON.stringify({
                      question:
                        story,
                    }),
                }
              );

            const rawText =
              await response.text();

            let result =
              null;

            if (rawText) {
              try {
                result =
                  JSON.parse(
                    rawText
                  );
              } catch {
                throw new Error(
                  "Verdict received an invalid response from the legal service."
                );
              }
            }

            if (!response.ok) {
              throw new Error(
                result?.error ||
                  result?.message ||
                  "Verified legal information could not be loaded."
              );
            }

            if (mounted) {
              setGuidance(
                result
              );
            }
          } catch (
            guidanceError
          ) {
            console.error(
              "Unable to load verified legal context:",
              guidanceError
            );

            if (mounted) {
              setGuidance(
                null
              );
            }
          } finally {
            if (mounted) {
              setGuidanceLoading(
                false
              );
            }
          }
        }
      } catch (
        loadError
      ) {
        console.error(
          "Unable to prepare case summary:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't prepare this summary right now."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      mounted = false;
    };
  }, [matterId]);

  function handleBackToMatter() {
    navigate(
      "/matters/new/overview",
      {
        state: {
          matter,
        },
      }
    );
  }

  function handleExportPdf() {
    if (
      !matter ||
      exporting
    ) {
      return;
    }

    setExporting(true);
    setError("");

    try {
      exportCaseSummaryPdf({
        matter,
        evidence,
        timeline,
        legalMatches:
          verifiedMatches,
        referrals:
          uniqueReferrals,
      });
    } catch (
      exportError
    ) {
      console.error(
        "Unable to export case summary:",
        exportError
      );

      setError(
        "We couldn't export the PDF right now. Please try again."
      );
    } finally {
      setExporting(false);
    }
  }

  const matches =
    Array.isArray(
      guidance?.matches
    )
      ? guidance.matches
      : [];

  const verifiedMatches =
    matches.filter(
      (match) =>
        match &&
        (
          match.topic ||
          match.issue ||
          match.domain
        )
    );

  const referrals =
    verifiedMatches.flatMap(
      (match) => {
        const items =
          Array.isArray(
            match.referrals
          )
            ? match.referrals
            : [];

        return items.map(
          (referral) => ({
            ...referral,
            legalArea:
              match.topic?.name ||
              match.topic?.title ||
              match.issue?.name ||
              match.domain?.name ||
              "Relevant legal area",
          })
        );
      }
    );

  const uniqueReferrals =
    referrals.filter(
      (
        referral,
        index,
        all
      ) => {
        const organisation =
          referral.organisation ||
          referral.referral_organisation ||
          referral.organisation_details ||
          {};

        const key =
          referral.id ||
          organisation.id ||
          organisation.name ||
          referral.organisation_name ||
          referral.title;

        return (
          index ===
          all.findIndex(
            (item) => {
              const itemOrganisation =
                item.organisation ||
                item.referral_organisation ||
                item.organisation_details ||
                {};

              const itemKey =
                item.id ||
                itemOrganisation.id ||
                itemOrganisation.name ||
                item.organisation_name ||
                item.title;

              return (
                itemKey === key
              );
            }
          )
        );
      }
    );

  if (loading) {
    return (
      <main className="case-summary-page">
        <section className="case-summary-shell">
          <p className="case-summary-loading">
            Preparing your
            summary...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="case-summary-page">
      <section className="case-summary-shell">
        <header className="case-summary-header">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            aria-label="Back"
          >
            ←
          </button>

          <span>
            VERDICT
          </span>

          <div />
        </header>

        <section className="case-summary-title">
          <p>
            CASE PREPARATION
          </p>

          <h1>
            Matter Pack
          </h1>

          <span>
            A structured overview
            of the information
            you've added to
            Verdict.
          </span>
        </section>

        {error && (
          <div
            className="case-summary-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {matter && (
          <>
            <section className="case-summary-section">
              <p className="case-summary-label">
                Your account
              </p>

              <article className="case-summary-card">
                <h2>
                  What happened
                </h2>

                <p className="case-summary-story">
                  {matter.story ||
                    "No description provided."}
                </p>
              </article>
            </section>

            <section className="case-summary-section">
              <p className="case-summary-label">
                Matter details
              </p>

              <article className="case-summary-card case-summary-details">
                <div>
                  <span>
                    Incident date
                  </span>

                  <strong>
                    {matter.unsure_date
                      ? "Date uncertain"
                      : formatDate(
                          matter.incident_date
                        )}
                  </strong>
                </div>

                <div>
                  <span>
                    Other party
                  </span>

                  <strong>
                    {matter.involved_name ||
                      matter.involved_type ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>
                    Status
                  </span>

                  <strong>
                    {matter.status ===
                    "closed"
                      ? "Closed"
                      : "In progress"}
                  </strong>
                </div>
              </article>
            </section>

            <section className="case-summary-section">
              <div className="case-summary-section-heading">
                <p className="case-summary-label">
                  Timeline
                </p>

                <span>
                  {
                    timeline.length
                  }{" "}
                  {timeline.length ===
                  1
                    ? "event"
                    : "events"}
                </span>
              </div>

              <article className="case-summary-card">
                {timeline.length >
                0 ? (
                  <div className="case-summary-timeline">
                    {timeline.map(
                      (
                        event
                      ) => (
                        <div
                          key={
                            event.id
                          }
                          className="case-summary-timeline-item"
                        >
                          <div className="case-summary-timeline-dot" />

                          <div>
                            <span>
                              {formatDate(
                                event.event_date
                              )}
                            </span>

                            <h3>
                              {event.title ||
                                "Timeline event"}
                            </h3>

                            {event.description && (
                              <p>
                                {
                                  event.description
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="case-summary-empty">
                    No timeline
                    events have
                    been added.
                  </p>
                )}
              </article>
            </section>

            <section className="case-summary-section">
              <div className="case-summary-section-heading">
                <p className="case-summary-label">
                  Evidence
                </p>

                <span>
                  {
                    evidence.length
                  }{" "}
                  {evidence.length ===
                  1
                    ? "item"
                    : "items"}
                </span>
              </div>

              <article className="case-summary-card">
                {evidence.length >
                0 ? (
                  <div className="case-summary-evidence">
                    {evidence.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={
                            item.id
                          }
                          className="case-summary-evidence-item"
                        >
                          <span>
                            {index +
                              1}
                          </span>

                          <div>
                            <strong>
                              {item.file_name ||
                                item.title ||
                                `Evidence item ${
                                  index +
                                  1
                                }`}
                            </strong>

                            {item.description && (
                              <p>
                                {
                                  item.description
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="case-summary-empty">
                    No evidence has
                    been added.
                  </p>
                )}
              </article>
            </section>

            <section className="case-summary-section">
              <div className="case-summary-section-heading">
                <p className="case-summary-label">
                  Verified legal context
                </p>

                <span>
                  {guidanceLoading
                    ? "Checking"
                    : `${verifiedMatches.length} ${
                        verifiedMatches.length === 1
                          ? "area"
                          : "areas"
                      }`}
                </span>
              </div>

              <article className="case-summary-card">
                {guidanceLoading ? (
                  <p className="case-summary-empty">
                    Checking Verdict's verified legal sources...
                  </p>
                ) : verifiedMatches.length > 0 ? (
                  <div className="case-summary-legal-list">
                    {verifiedMatches.map(
                      (
                        match,
                        index
                      ) => (
                        <div
                          className="case-summary-legal-item"
                          key={
                            match.topic?.id ||
                            match.id ||
                            index
                          }
                        >
                          <span>
                            {index + 1}
                          </span>

                          <div>
                            <strong>
                              {match.topic?.name ||
                                match.topic?.title ||
                                match.issue?.name ||
                                match.domain?.name ||
                                "Relevant legal area"}
                            </strong>

                            {(match.domain?.name ||
                              match.issue?.name) && (
                              <p>
                                {[
                                  match.domain?.name,
                                  match.issue?.name,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="case-summary-empty">
                    No verified legal area has been matched to this matter yet.
                  </p>
                )}
              </article>
            </section>

            <section className="case-summary-section">
              <div className="case-summary-section-heading">
                <p className="case-summary-label">
                  Where to get help
                </p>

                <span>
                  {uniqueReferrals.length}{" "}
                  {uniqueReferrals.length === 1
                    ? "referral"
                    : "referrals"}
                </span>
              </div>

              <article className="case-summary-card">
                {uniqueReferrals.length > 0 ? (
                  <div className="case-summary-referrals">
                    {uniqueReferrals.map(
                      (
                        referral,
                        index
                      ) => {
                        const organisation =
                          referral.organisation ||
                          referral.referral_organisation ||
                          referral.organisation_details ||
                          {};

                        const name =
                          organisation.name ||
                          referral.organisation_name ||
                          referral.title ||
                          "Support organisation";

                        const url =
                          referral.official_url ||
                          organisation.website_url ||
                          organisation.official_url ||
                          organisation.website;

                        return (
                          <div
                            className="case-summary-referral-item"
                            key={
                              referral.id ||
                              organisation.id ||
                              `${name}-${index}`
                            }
                          >
                            <span className="case-summary-referral-area">
                              {referral.legalArea}
                            </span>

                            <strong>
                              {name}
                            </strong>

                            {referral.instructions && (
                              <p>
                                {referral.instructions}
                              </p>
                            )}

                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open official referral →
                              </a>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <p className="case-summary-empty">
                    No verified referral has been added to this summary yet.
                  </p>
                )}
              </article>
            </section>

            <section className="case-summary-section">
              <article className="case-summary-note">
                <strong>
                  About this Matter Pack
                </strong>

                <p>
                  This summary
                  organises
                  information you
                  provided to
                  Verdict. It does
                  not determine
                  whether the
                  information is
                  legally correct,
                  prove a claim,
                  constitute legal
                  advice or replace
                  advice from a
                  qualified legal
                  professional.
                </p>
              </article>
            </section>

            <div className="case-summary-actions">
              <button
                type="button"
                className="case-summary-secondary"
                onClick={
                  handleBackToMatter
                }
              >
                Back to matter
              </button>

              <button
                type="button"
                className="case-summary-primary"
                onClick={
                  handleExportPdf
                }
                disabled={
                  exporting ||
                  !matter
                }
              >
                {exporting
                  ? "Preparing PDF..."
                  : "Export Matter Pack"}
              </button>
            </div>
          </>
        )}

        {!matter &&
          !error && (
            <div
              className="case-summary-error"
              role="alert"
            >
              This matter could
              not be found.
            </div>
          )}
      </section>
    </main>
  );
}

export default CaseSummary;