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
  useMatter,
} from "../context/useMatter";
import {
  supabase,
} from "../lib/supabaseClient";
import {
  deleteMatterAndRelatedData,
} from "../utils/deleteMatter";

import "../styles/matterOverview.css";

function mapDatabaseMatter(
  row,
  currentMatter = {}
) {
  return {
    ...currentMatter,
    id: row.id,
    story: row.story || "",
    date: row.incident_date || "",
    unsureDate:
      Boolean(row.unsure_date),
    involvedType:
      row.involved_type || "",
    involvedName:
      row.involved_name || "",
    status:
      row.status || "in_progress",
    files:
      Array.isArray(
        currentMatter.files
      )
        ? currentMatter.files
        : [],
    timeline:
      Array.isArray(
        currentMatter.timeline
      )
        ? currentMatter.timeline
        : [],
  };
}

function MatterOverview() {
  const navigate =
    useNavigate();

  const location =
    useLocation();
  const { matterId: routeMatterId } = useParams();

  const {
    matter: savedMatter,
    setMatter,
  } = useMatter();

    const routeMatter =
    location.state?.matter?.id &&
    (!routeMatterId ||
      String(location.state.matter.id) === String(routeMatterId))
      ? location.state.matter
      : null;

  const matter =
    routeMatter ||
    (routeMatterId && String(savedMatter?.id) !== String(routeMatterId)
      ? { id: routeMatterId }
      : savedMatter);

  const [
    loading,
    setLoading,
  ] = useState(
    Boolean(matter?.id)
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    evidenceCount,
    setEvidenceCount,
  ] = useState(
    Array.isArray(matter?.files)
      ? matter.files.length
      : 0
  );

  const [
    timelineCount,
    setTimelineCount,
  ] = useState(
    Array.isArray(
      matter?.timeline
    )
      ? matter.timeline.length
      : 0
  );

  const [
    journey,
    setJourney,
  ] = useState(null);

  const [
    updatingAction,
    setUpdatingAction,
  ] = useState(false);

  const [
    journeyActionError,
    setJourneyActionError,
  ] = useState("");

  const [
    deletingMatter,
    setDeletingMatter,
  ] = useState(false);

  const [
    managementError,
    setManagementError,
  ] = useState("");

  const [
    consistencyCheck,
    setConsistencyCheck,
  ] = useState({
    loading: false,
    issues: [],
    checked: false,
    error: "",
  });

  useEffect(() => {
    if (
      routeMatter?.id &&
      routeMatter.id !==
        savedMatter?.id
    ) {
      setMatter(routeMatter);
    }
  }, [
    routeMatter,
    savedMatter?.id,
    setMatter,
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadMatter() {
      if (!matter?.id) {
        if (mounted) {
          setLoading(false);
        }

        return;
      }

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
              .select(
                `
                  id,
                  story,
                  incident_date,
                  unsure_date,
                  involved_type,
                  involved_name,
                  status,
                  created_at,
                  updated_at
                `
              )
              .eq(
                "id",
                matter.id
              )
              .eq(
                "user_id",
                user.id
              )
              .single(),

            supabase
              .from("evidence")
              .select(
                "id",
                {
                  count:
                    "exact",
                  head: true,
                }
              )
              .eq(
                "matter_id",
                matter.id
              )
              .eq(
                "user_id",
                user.id
              ),

            supabase
              .from(
                "timeline_events"
              )
              .select(
                "id",
                {
                  count:
                    "exact",
                  head: true,
                }
              )
              .eq(
                "matter_id",
                matter.id
              )
              .eq(
                "user_id",
                user.id
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
          (currentMatter) =>
            mapDatabaseMatter(
                            matterResult.data,
              String(currentMatter?.id) === String(matterResult.data.id)
                ? currentMatter
                : {}
            )
        );

        setEvidenceCount(
          evidenceResult.count || 0
        );

        setTimelineCount(
          timelineResult.count || 0
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load matter overview:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load this matter right now. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadMatter();

    return () => {
      mounted = false;
    };
  }, [
    matter?.id,
    setMatter,
  ]);

  useEffect(() => {
    let mounted = true;

    async function syncJourney() {
      if (!matter?.id) {
        return;
      }

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
            `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/journey/sync`,
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
                  matterId:
                    matter.id,
                }),
            }
          );

        const rawText =
          await response.text();

        let result = null;

        if (rawText) {
          try {
            result =
              JSON.parse(
                rawText
              );
          } catch {
            throw new Error(
              "Verdict received an invalid Journey response."
            );
          }
        }

        if (!response.ok) {
          throw new Error(
            result?.error ||
              "Journey sync failed."
          );
        }

        if (!mounted) {
          return;
        }

        console.log(
          "VERDICT JOURNEY:",
          result
        );

        console.table(
  (result?.actions || []).map(
    (action) => ({
      title: action.title,
      status: action.status,
      action_type:
        action.action_type,
      source_type:
        action.source_type,
    })
  )
);

        setJourney(result);
      } catch (
        journeyError
      ) {
        console.error(
          "Unable to synchronise matter journey:",
          journeyError
        );
      }
    }

    syncJourney();

    return () => {
      mounted = false;
    };
  }, [matter?.id]);


  useEffect(() => {
    let mounted = true;

    async function runConsistencyCheck() {
      if (!matter?.id) {
        return;
      }

      if (mounted) {
        setConsistencyCheck({
          loading: true,
          issues: [],
          checked: false,
          error: "",
        });
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Your session could not be verified."
          );
        }

        const [
          evidenceResult,
          timelineResult,
        ] = await Promise.all([
          supabase
            .from("evidence")
            .select(
              `
                id,
                file_name,
                evidence_type,
                description
              `
            )
            .eq(
              "matter_id",
              matter.id
            )
            .eq(
              "user_id",
              user.id
            ),

          supabase
            .from("timeline_events")
            .select(
              `
                id,
                title,
                event_date,
                event_time,
                description,
                event_type
              `
            )
            .eq(
              "matter_id",
              matter.id
            )
            .eq(
              "user_id",
              user.id
            ),
        ]);

        if (evidenceResult.error) {
          throw evidenceResult.error;
        }

        if (timelineResult.error) {
          throw timelineResult.error;
        }

        const issues = [];

        const normaliseDate = (value) => {
          const raw =
            String(value || "").trim();

          if (!raw) {
            return "";
          }

          const iso =
            raw.match(
              /\b(20\d{2})-(\d{2})-(\d{2})\b/
            );

          if (iso) {
            return iso[0];
          }

          const months = {
            january: "01",
            february: "02",
            march: "03",
            april: "04",
            may: "05",
            june: "06",
            july: "07",
            august: "08",
            september: "09",
            october: "10",
            november: "11",
            december: "12",
          };

          const written =
            raw.match(
              /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i
            );

          if (!written) {
            return "";
          }

          return `${written[3]}-${months[written[2].toLowerCase()]}-${String(Number(written[1])).padStart(2, "0")}`;
        };

        const evidenceItems =
          Array.isArray(
            evidenceResult.data
          )
            ? evidenceResult.data
            : [];

        const timelineItems =
          Array.isArray(
            timelineResult.data
          )
            ? timelineResult.data
            : [];

        /*
         * Only flag explicit, reviewable inconsistencies.
         * Verdict never decides which version is correct.
         */
        if (
          matter?.date &&
          matter?.unsureDate
        ) {
          issues.push({
            id: "matter-date-status",
            title:
              "Matter date needs clarification",
            detail:
              "A specific incident date is recorded while the date is also marked as uncertain. Review the matter details and keep the version that accurately reflects what you know.",
            destination: "matter",
          });
        }

        const storyDate =
          normaliseDate(
            matter?.story
          );

        if (
          matter?.date &&
          storyDate &&
          matter.date !== storyDate
        ) {
          issues.push({
            id: "story-matter-date",
            title:
              "Two different dates are recorded",
            detail:
              `The matter date is ${matter.date}, while the description contains ${storyDate}. Verdict cannot determine which date is correct.`,
            destination: "matter",
          });
        }

        timelineItems.forEach(
          (event) => {
            const textDate =
              normaliseDate(
                `${event.title || ""} ${event.description || ""}`
              );

            if (
              event.event_date &&
              textDate &&
              event.event_date !==
                textDate
            ) {
              issues.push({
                id:
                  `timeline-${event.id}`,
                title:
                  "Timeline date may need review",
                detail:
                  `"${event.title || "Timeline event"}" is saved for ${event.event_date}, but its written details contain ${textDate}. Check the event before relying on either date.`,
                destination:
                  "timeline",
              });
            }
          }
        );

        evidenceItems.forEach(
          (item) => {
            const evidenceDate =
              normaliseDate(
                item.description
              );

            if (!evidenceDate) {
              return;
            }

            const relatedEvents =
              timelineItems.filter(
                (event) => {
                  const evidenceText =
                    `${item.file_name || ""} ${item.description || ""}`.toLowerCase();

                  const eventText =
                    `${event.title || ""} ${event.description || ""}`.toLowerCase();

                  const meaningfulWords =
                    evidenceText
                      .split(
                        /[^a-z0-9]+/
                      )
                      .filter(
                        (word) =>
                          word.length >= 5
                      );

                  return meaningfulWords.some(
                    (word) =>
                      eventText.includes(
                        word
                      )
                  );
                }
              );

            relatedEvents.forEach(
              (event) => {
                if (
                  event.event_date &&
                  event.event_date !==
                    evidenceDate
                ) {
                  issues.push({
                    id:
                      `evidence-${item.id}-timeline-${event.id}`,
                    title:
                      "Evidence and timeline dates may differ",
                    detail:
                      `"${item.file_name || "Evidence"}" mentions ${evidenceDate}, while a potentially related timeline event "${event.title || "Event"}" is recorded for ${event.event_date}. Review both records. Verdict is not deciding which one is correct.`,
                    destination:
                      "evidence",
                  });
                }
              }
            );
          }
        );

        const uniqueIssues =
          issues.filter(
            (issue, index, all) =>
              all.findIndex(
                (candidate) =>
                  candidate.title ===
                    issue.title &&
                  candidate.detail ===
                    issue.detail
              ) === index
          );

        if (!mounted) {
          return;
        }

        setConsistencyCheck({
          loading: false,
          issues:
            uniqueIssues.slice(
              0,
              6
            ),
          checked: true,
          error: "",
        });
      } catch (checkError) {
        console.error(
          "Unable to run consistency check:",
          checkError
        );

        if (mounted) {
          setConsistencyCheck({
            loading: false,
            issues: [],
            checked: true,
            error:
              "Verdict couldn't complete the consistency check right now.",
          });
        }
      }
    }

    runConsistencyCheck();

    return () => {
      mounted = false;
    };
  }, [
    matter?.id,
    matter?.story,
    matter?.date,
    matter?.unsureDate,
    evidenceCount,
    timelineCount,
  ]);

  const otherParty =
    matter?.involvedName ||
    matter?.involvedType ||
    "Other party";

  const statusLabel =
    matter?.status ===
    "closed"
      ? "Closed"
      : "In progress";

  function editCurrentMatter() {
    if (!matter?.id || deletingMatter) {
      return;
    }

    navigate(
      `/matters/${encodeURIComponent(matter.id)}/edit`,
      {
        state: {
          matter,
        },
      }
    );
  }

  async function deleteCurrentMatter() {
    if (!matter?.id || deletingMatter) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this matter?\n\nThis will permanently delete the matter and its linked evidence records, timeline events, journey actions, issue tags and reminders. This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setManagementError("");
    setDeletingMatter(true);

    try {
      await deleteMatterAndRelatedData(matter.id);

      const currentMatterId = sessionStorage.getItem(
        "verdictCurrentMatterId"
      );

      if (currentMatterId === String(matter.id)) {
        sessionStorage.removeItem("verdictCurrentMatterId");
      }

      setMatter({});

      navigate("/matters", {
        replace: true,
      });
    } catch (deleteError) {
      console.error("Unable to delete matter:", deleteError);

      setManagementError(
        deleteError?.message ||
          "We couldn't delete this matter right now. Please try again."
      );
    } finally {
      setDeletingMatter(false);
    }
  }

  function goToEvidence() {
    navigate(
      "/matters/new/evidence",
      {
        state: {
          matter,
        },
      }
    );
  }

  function goToTimeline() {
    navigate(
      "/matters/new/timeline",
      {
        state: {
          matter,
        },
      }
    );
  }

  function goToGuidance() {
    const currentMatterId =
      matter?.id ||
      sessionStorage.getItem(
        "verdictCurrentMatterId"
      );

    if (currentMatterId) {
      sessionStorage.setItem(
        "verdictCurrentMatterId",
        currentMatterId
      );

      navigate(
        `/matters/new/guidance?matterId=${encodeURIComponent(
          currentMatterId
        )}`,
        {
          state: {
            matter,
          },
        }
      );

      return;
    }

    navigate(
      "/matters/new/guidance",
      {
        state: {
          matter,
        },
      }
    );
  }

  function goToCaseSummary() {
    navigate(
      `/matters/${matter.id}/summary`,
      {
        state: {
          matter,
        },
      }
    );
  }

  function reviewConsistencyIssue(
    destination
  ) {
    if (destination === "timeline") {
      goToTimeline();
      return;
    }

    if (destination === "evidence") {
      goToEvidence();
      return;
    }

    editCurrentMatter();
  }

  /*
   * Matter Health Check measures preparation completeness only.
   * It is NOT a legal-strength, merits or chance-of-success score.
   */
  const preparationChecks = [
    {
      key: "story",
      label: "Matter described",
      complete:
        Boolean(
          matter?.story?.trim()
        ),
      actionLabel: "Edit matter",
      action: editCurrentMatter,
    },
    {
      key: "party",
      label: "Other party recorded",
      complete:
        Boolean(
          matter?.involvedType ||
          matter?.involvedName
        ),
      actionLabel: "Add details",
      action: editCurrentMatter,
    },
    {
      key: "date",
      label: "Date information recorded",
      complete:
        Boolean(
          matter?.date ||
          matter?.unsureDate
        ),
      actionLabel: "Add date",
      action: editCurrentMatter,
    },
    {
      key: "evidence",
      label: "Supporting material added",
      complete:
        evidenceCount > 0,
      actionLabel: "Add evidence",
      action: goToEvidence,
    },
    {
      key: "timeline",
      label: "Timeline started",
      complete:
        timelineCount > 0,
      actionLabel: "Build timeline",
      action: goToTimeline,
    },
  ];

  const completedPreparationChecks =
    preparationChecks.filter(
      (item) => item.complete
    ).length;

  const preparationPercent =
    Math.round(
      (
        completedPreparationChecks /
        preparationChecks.length
      ) * 100
    );

  const nextPreparationGap =
    preparationChecks.find(
      (item) => !item.complete
    ) || null;

  const nextAction =
    journey?.nextAction || null;

  function getNextActionDestination(
    action
  ) {
    const title =
      action?.title
        ?.toLowerCase() || "";

    const sourceType =
      action?.source_type
        ?.toLowerCase() || "";

    if (
      sourceType === "evidence" ||
      title.includes("evidence")
    ) {
      return {
        label: "Open evidence",
        action: goToEvidence,
      };
    }

    if (
      sourceType === "timeline" ||
      title.includes("timeline")
    ) {
      return {
        label: "Open timeline",
        action: goToTimeline,
      };
    }

    if (
      sourceType === "case_summary" ||
      title.includes("case summary") ||
      title.includes("summary")
    ) {
      return {
        label: "Prepare summary",
        action: goToCaseSummary,
      };
    }

    return {
      label: "View guidance",
      action: goToGuidance,
    };
  }

  const nextActionDestination =
    getNextActionDestination(
      nextAction
    );

  const nextActionLabel =
    nextAction?.action_type ===
    "verified"
      ? "Verified next step"
      : "Recommended";

  async function updateJourneyAction(
    status
  ) {
    if (
      !nextAction?.id ||
      updatingAction
    ) {
      return;
    }

    setUpdatingAction(true);
    setJourneyActionError("");

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
          `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/journey/actions/${encodeURIComponent(
            nextAction.id
          )}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                status,
              }),
          }
        );

      const rawText =
        await response.text();

      let result = null;

      if (rawText) {
        try {
          result =
            JSON.parse(
              rawText
            );
        } catch {
          throw new Error(
            "Verdict received an invalid Journey response."
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to update this step."
        );
      }

      setJourney(
        (currentJourney) => ({
          ...(currentJourney ||
            {}),

          actions:
            result?.actions ||
            currentJourney?.actions ||
            [],

          nextAction:
            result?.nextAction ||
            null,
        })
      );
    } catch (
      actionError
    ) {
      console.error(
        "Unable to update journey action:",
        actionError
      );

      setJourneyActionError(
        actionError?.message ||
          "We couldn't update this step right now."
      );
    } finally {
      setUpdatingAction(false);
    }
  }

  function handleCardKeyDown(
    event,
    action
  ) {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      action();
    }
  }

  if (
    !matter?.id &&
    !matter?.story
  ) {
    return (
      <main className="matter-overview-page">
        <section className="matter-overview-shell">
          <header className="overview-header">
            <button
              type="button"
              className="overview-back"
              onClick={() =>
                navigate(
                  "/matters"
                )
              }
              aria-label="Back to My Matters"
            >
              ←
            </button>

            <span className="overview-wordmark">
              VERDICT
            </span>

            <span
              className="overview-more"
              aria-hidden="true"
            />
          </header>

          <section className="overview-title-section">
            <div className="overview-status-row">
              <span className="matter-type">
                Matter
              </span>
            </div>

            <h1>
              No matter selected
            </h1>

            <p className="overview-subtitle">
              Open one of your
              matters or start a
              new one.
            </p>
          </section>

          <section className="overview-section">
            <article className="empty-evidence-card">
              <div>
                <h3>
                  Choose a matter
                </h3>

                <p>
                  Your saved
                  matters are
                  available in My
                  Matters.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/matters"
                  )
                }
              >
                My Matters
              </button>
            </article>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="matter-overview-page">
      <section className="matter-overview-shell">
        <header className="overview-header">
          <button
            type="button"
            className="overview-back"
            onClick={() =>
              navigate(
                "/matters"
              )
            }
            aria-label="Back to My Matters"
          >
            ←
          </button>

          <span className="overview-wordmark">
            VERDICT
          </span>

          <span
            className="overview-more"
            aria-hidden="true"
          />
        </header>

        <section className="overview-title-section">
          <div className="overview-status-row">
            <span className="matter-type">
              {matter?.involvedType ||
                "Matter"}
            </span>

            <span className="matter-progress-status">
              {statusLabel}
            </span>
          </div>

          <h1>
            Your matter
          </h1>

          <p className="overview-subtitle">
            We've organised the
            information you
            provided.
          </p>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              onClick={
                editCurrentMatter
              }
              disabled={
                loading ||
                deletingMatter
              }
              style={{
                background: "transparent",
                color: "inherit",
                border: "1px solid currentColor",
                borderRadius: "10px",
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Edit matter
            </button>

            <button
              type="button"
              onClick={
                deleteCurrentMatter
              }
              disabled={
                loading ||
                deletingMatter
              }
              style={{
                background: "transparent",
                color: "#8f2d2d",
                border: "1px solid #c98f8f",
                borderRadius: "10px",
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              {deletingMatter
                ? "Deleting..."
                : "Delete matter"}
            </button>
          </div>
        </section>

        {managementError && (
          <div
            className="auth-error"
            role="alert"
          >
            {managementError}
          </div>
        )}

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <nav
          className="matter-tabs"
          aria-label="Matter sections"
        >
          <button
            type="button"
            className="active"
            aria-current="page"
          >
            Overview
          </button>

          <button
            type="button"
            onClick={
              goToEvidence
            }
            disabled={loading}
          >
            Evidence
          </button>

          <button
            type="button"
            onClick={
              goToTimeline
            }
            disabled={loading}
          >
            Timeline
          </button>
        </nav>

        <section className="overview-section">
          <p className="section-label">
            What you told us
          </p>

          <article className="summary-card">
            <p>
              {loading
                ? "Loading your matter..."
                : matter?.story ||
                  "No matter information available."}
            </p>

            {!loading && (
              <div className="summary-meta">
                {matter?.date && (
                  <span>
                    Date:{" "}
                    {matter.date}
                  </span>
                )}

                {matter?.unsureDate &&
                  !matter?.date && (
                    <span>
                      Date:
                      uncertain
                    </span>
                  )}

                <span>
                  Other party:{" "}
                  {otherParty}
                </span>
              </div>
            )}
          </article>
        </section>

        <section className="overview-section">
          <p className="section-label">
            Matter health check
          </p>

          <article
            className="guidance-card"
            style={{
              display: "block",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "12px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  {loading
                    ? "Checking preparation..."
                    : `${preparationPercent}% prepared`}
                </h3>

                <p
                  style={{
                    marginTop: "6px",
                  }}
                >
                  Preparation completeness only.
                  This is not a prediction of your
                  legal outcome or chance of success.
                </p>
              </div>

              {!loading && (
                <strong
                  aria-label={`${completedPreparationChecks} of ${preparationChecks.length} preparation items complete`}
                >
                  {completedPreparationChecks}/
                  {preparationChecks.length}
                </strong>
              )}
            </div>

            {!loading && (
              <>
                <div
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={
                    preparationPercent
                  }
                  aria-label="Matter preparation completeness"
                  style={{
                    width: "100%",
                    height: "8px",
                    borderRadius: "999px",
                    background:
                      "rgba(127, 127, 127, 0.18)",
                    overflow: "hidden",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      width:
                        `${preparationPercent}%`,
                      height: "100%",
                      background:
                        "currentColor",
                      borderRadius: "999px",
                      transition:
                        "width 180ms ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "9px",
                  }}
                >
                  {preparationChecks.map(
                    (item) => (
                      <div
                        key={item.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            "space-between",
                          gap: "12px",
                        }}
                      >
                        <span>
                          {item.complete
                            ? "✓"
                            : "○"}{" "}
                          {item.label}
                        </span>

                        {!item.complete && (
                          <button
                            type="button"
                            onClick={
                              item.action
                            }
                            disabled={
                              loading
                            }
                            style={{
                              background:
                                "transparent",
                              border:
                                "none",
                              padding: 0,
                              textDecoration:
                                "underline",
                              cursor:
                                "pointer",
                              color:
                                "inherit",
                            }}
                          >
                            {item.actionLabel}
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "14px",
                    borderTop:
                      "1px solid rgba(127, 127, 127, 0.2)",
                  }}
                >
                  <strong>
                    {nextPreparationGap
                      ? "Preparation gap"
                      : "Core preparation complete"}
                  </strong>

                  <p
                    style={{
                      marginBottom: 0,
                    }}
                  >
                    {nextPreparationGap
                      ? `Next: ${nextPreparationGap.label}.`
                      : "You've completed Verdict's core organisational preparation checks. Continue reviewing verified guidance and any journey steps that apply."}
                  </p>
                </div>
              </>
            )}
          </article>
        </section>

        <section className="overview-section">
          <p className="section-label">
            Consistency check
          </p>

          <article
            className="guidance-card"
            style={{
              display: "block",
            }}
          >
            <div>
              <h3>
                {consistencyCheck.loading
                  ? "Checking your records..."
                  : consistencyCheck.issues.length > 0
                    ? `${consistencyCheck.issues.length} item${consistencyCheck.issues.length === 1 ? "" : "s"} to review`
                    : "No clear inconsistencies found"}
              </h3>

              <p>
                Verdict compares explicit
                dates and recorded details
                across your matter,
                evidence descriptions and
                timeline. It flags possible
                differences for you to
                review, but it does not
                decide which version is
                correct.
              </p>
            </div>

            {!consistencyCheck.loading &&
              consistencyCheck.issues.length >
                0 && (
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    marginTop: "16px",
                  }}
                >
                  {consistencyCheck.issues.map(
                    (issue) => (
                      <div
                        key={issue.id}
                        style={{
                          padding:
                            "14px",
                          border:
                            "1px solid rgba(127, 127, 127, 0.22)",
                          borderRadius:
                            "12px",
                        }}
                      >
                        <strong>
                          {issue.title}
                        </strong>

                        <p
                          style={{
                            marginBottom:
                              "10px",
                          }}
                        >
                          {issue.detail}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            reviewConsistencyIssue(
                              issue.destination
                            )
                          }
                          style={{
                            background:
                              "transparent",
                            border: "none",
                            padding: 0,
                            color:
                              "inherit",
                            textDecoration:
                              "underline",
                            cursor:
                              "pointer",
                          }}
                        >
                          Review record →
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

            {!consistencyCheck.loading &&
              consistencyCheck.checked &&
              consistencyCheck.issues.length ===
                0 &&
              !consistencyCheck.error && (
                <p
                  style={{
                    marginTop: "14px",
                    marginBottom: 0,
                  }}
                >
                  This does not prove that
                  every detail is accurate.
                  It only means Verdict did
                  not find an obvious
                  conflict in the recorded
                  information it checked.
                </p>
              )}

            {consistencyCheck.error && (
              <p
                className="auth-error"
                role="alert"
                style={{
                  marginTop: "14px",
                }}
              >
                {consistencyCheck.error}
              </p>
            )}
          </article>
        </section>

        <section className="overview-section">
          <p className="section-label">
            Your next step
          </p>

          <article className="next-step-card">
            <div className="next-step-number">
              {nextAction ? "1" : "✓"}
            </div>

            <div className="next-step-content">
              <span className="recommended-label">
                {nextAction
                  ? nextActionLabel
                  : loading
                    ? "Checking"
                    : "Up to date"}
              </span>

              <h2>
                {nextAction?.title ||
                  (loading
                    ? "Checking your next step..."
                    : "No outstanding journey steps")}
              </h2>

              <p>
                {nextAction?.description ||
                  (loading
                    ? "Verdict is reviewing the progress of this matter."
                    : "You've completed or dismissed the current journey steps for this matter. Verdict will add new steps when the matter progresses.")}
              </p>

              {nextAction && (
                <>
                  <button
                    type="button"
                    onClick={
                      nextActionDestination.action
                    }
                    disabled={
                      loading ||
                      updatingAction
                    }
                  >
                    {nextActionDestination.label}
                    <span>
                      →
                    </span>
                  </button>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "12px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updateJourneyAction(
                          "completed"
                        )
                      }
                      disabled={
                        updatingAction
                      }
                    >
                      {updatingAction
                        ? "Updating..."
                        : "Mark complete"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateJourneyAction(
                          "dismissed"
                        )
                      }
                      disabled={
                        updatingAction
                      }
                      style={{
                        background:
                          "transparent",
                        color: "inherit",
                        border:
                          "1px solid currentColor",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>

                  {journeyActionError && (
                    <p
                      className="auth-error"
                      role="alert"
                      style={{
                        marginTop: "10px",
                      }}
                    >
                      {journeyActionError}
                    </p>
                  )}
                </>
              )}
            </div>
          </article>
        </section>

        <section className="overview-section">
          <div className="section-heading-row">
            <p className="section-label">
              Evidence
            </p>

            <button
              type="button"
              onClick={
                goToEvidence
              }
              disabled={loading}
            >
              View all
            </button>
          </div>

          {evidenceCount > 0 ? (
            <article
              className="evidence-summary-card"
              onClick={
                goToEvidence
              }
              onKeyDown={(
                event
              ) =>
                handleCardKeyDown(
                  event,
                  goToEvidence
                )
              }
              role="button"
              tabIndex={0}
              aria-label="Open evidence"
            >
              <div className="evidence-count">
                {evidenceCount}
              </div>

              <div>
                <h3>
                  {evidenceCount ===
                  1
                    ? "1 item added"
                    : `${evidenceCount} items added`}
                </h3>

                <p>
                  Documents and
                  files attached
                  to this matter.
                </p>
              </div>

              <span>
                →
              </span>
            </article>
          ) : (
            <article className="empty-evidence-card">
              <div>
                <h3>
                  No evidence
                  added yet
                </h3>

                <p>
                  You can add
                  documents,
                  screenshots,
                  photographs or
                  other
                  supporting
                  material.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  goToEvidence
                }
                disabled={loading}
              >
                + Add evidence
              </button>
            </article>
          )}
        </section>

        <section className="overview-section">
          <div className="section-heading-row">
            <p className="section-label">
              Timeline
            </p>

            <button
              type="button"
              onClick={
                goToTimeline
              }
              disabled={loading}
            >
              View timeline
            </button>
          </div>

          {timelineCount > 0 ? (
            <article
              className="evidence-summary-card"
              onClick={
                goToTimeline
              }
              onKeyDown={(
                event
              ) =>
                handleCardKeyDown(
                  event,
                  goToTimeline
                )
              }
              role="button"
              tabIndex={0}
              aria-label="Open timeline"
            >
              <div className="evidence-count">
                {timelineCount}
              </div>

              <div>
                <h3>
                  {timelineCount ===
                  1
                    ? "1 event recorded"
                    : `${timelineCount} events recorded`}
                </h3>

                <p>
                  Important dates
                  and events
                  connected to
                  this matter.
                </p>
              </div>

              <span>
                →
              </span>
            </article>
          ) : (
            <article className="empty-evidence-card">
              <div>
                <h3>
                  No timeline
                  events yet
                </h3>

                <p>
                  Add important
                  dates, messages,
                  payments,
                  notices or
                  deadlines.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  goToTimeline
                }
                disabled={loading}
              >
                + Add event
              </button>
            </article>
          )}
        </section>

        <section className="overview-section">
          <p className="section-label">
            Verdict guidance
          </p>

          <article className="guidance-card">
            <div className="guidance-mark">
              V
            </div>

            <div>
              <h3>
                Understanding
                your matter
              </h3>

              <p>
                Verdict will use
                the information
                you provide to
                identify possible
                legal issues,
                relevant
                information and
                practical next
                steps.
              </p>

              <button
                type="button"
                onClick={
                  goToGuidance
                }
                disabled={loading}
              >
                See what may
                apply →
              </button>
            </div>
          </article>
        </section>

        <section className="overview-section">
  <p className="section-label">
    Case preparation
  </p>

  <article className="guidance-card">
    <div className="guidance-mark">
      V
    </div>

    <div>
      <h3>
        Prepare case summary
      </h3>

      <p>
        Bring your story,
        evidence and timeline
        together into a clear
        summary you can review
        or share when seeking
        legal help.
      </p>

      <button
        type="button"
        onClick={
          goToCaseSummary
        }
        disabled={loading}
      >
        Prepare summary →
      </button>
    </div>
  </article>
</section>
  
        <div className="overview-disclaimer">
          Verdict provides legal
          information and
          organisational
          support. It does not
          replace a qualified
          legal professional.
        </div>
      </section>
    </main>
  );
}

export default MatterOverview;
