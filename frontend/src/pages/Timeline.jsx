import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useMatter } from "../context/useMatter";
import { supabase } from "../lib/supabaseClient";
import "../styles/timeline.css";

function createIncidentEvent(
  matter
) {
  if (!matter?.date) {
    return null;
  }

  return {
    id: `incident-${matter.id || "current"}`,
    date: matter.date,
    type: "Incident",
    title: "Matter began",
    description:
      matter.story ||
      "Initial matter event.",
    derived: true,
  };
}

function mapDatabaseEvent(
  event
) {
  return {
    id: event.id,
    date:
      event.event_date ||
      "",
    time:
      event.event_time ||
      "",
    type:
      event.event_type ||
      "Other",
    title:
      event.title ||
      "",
    description:
      event.description ||
      "",
    derived: false,
  };
}

function inferSuggestedType(
  evidenceType
) {
  const value =
    String(
      evidenceType || ""
    ).toLowerCase();

  if (
    value.includes("message") ||
    value.includes("communication")
  ) {
    return "Message";
  }

  if (
    value.includes("financial")
  ) {
    return "Payment";
  }

  if (
    value.includes("agreement") ||
    value.includes("contract") ||
    value.includes("official") ||
    value.includes("document")
  ) {
    return "Document";
  }

  return "Other";
}

function extractExplicitDate(
  text
) {
  const value =
    String(text || "");

  const iso =
    value.match(
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
    value.match(
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i
    );

  if (!written) {
    return "";
  }

  const day =
    String(
      Number(written[1])
    ).padStart(2, "0");

  const month =
    months[
      written[2].toLowerCase()
    ];

  return `${written[3]}-${month}-${day}`;
}

function Timeline() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    matter: savedMatter,
    updateMatter,
  } = useMatter();

  const incomingMatter =
    location.state?.matter?.id
      ? location.state.matter
      : savedMatter;

  const evidenceSuggestion =
    location.state
      ?.evidenceSuggestion ||
    null;

  const [events, setEvents] =
    useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    newEvent,
    setNewEvent,
  ] = useState({
    date: "",
    type: "Other",
    title: "",
    description: "",
  });

  useEffect(() => {
    if (!evidenceSuggestion) {
      return;
    }

    const description =
      String(
        evidenceSuggestion
          .description ||
        ""
      ).trim();

    const fileName =
      String(
        evidenceSuggestion
          .fileName ||
        "Evidence"
      ).trim();

    const suggestedDate =
      extractExplicitDate(
        description
      );

    setNewEvent({
      date: suggestedDate,
      type:
        inferSuggestedType(
          evidenceSuggestion
            .evidenceType
        ),
      title:
        description ||
        `Event supported by ${fileName}`,
      description:
        `Suggested from evidence: ${fileName}`,
    });

    setShowForm(true);

    setNotice(
      suggestedDate
        ? "Verdict prepared a timeline suggestion from this evidence. Review every field before adding it."
        : "Verdict prepared a timeline suggestion from this evidence. No reliable date was found, so add or confirm the date before saving."
    );
  }, [
    evidenceSuggestion,
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadTimeline() {
      if (
        !incomingMatter?.id
      ) {
        if (mounted) {
          setEvents([]);
          setLoading(false);
          setError(
            "This matter has not been saved yet."
          );
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

        const {
          data,
          error:
            timelineError,
        } =
          await supabase
            .from(
              "timeline_events"
            )
            .select(
              `
                id,
                title,
                event_date,
                event_time,
                description,
                event_type,
                created_at,
                updated_at
              `
            )
            .eq(
              "matter_id",
              incomingMatter.id
            )
            .eq(
              "user_id",
              user.id
            )
            .order(
              "event_date",
              {
                ascending: true,
              }
            )
            .order(
              "created_at",
              {
                ascending: true,
              }
            );

        if (timelineError) {
          throw timelineError;
        }

        if (!mounted) {
          return;
        }

        const savedEvents =
          Array.isArray(data)
            ? data.map(
                mapDatabaseEvent
              )
            : [];

        setEvents(savedEvents);

        setShowForm(
          savedEvents.length === 0 &&
            !incomingMatter.date
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load timeline:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load this timeline right now. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTimeline();

    return () => {
      mounted = false;
    };
  }, [
    incomingMatter?.id,
    incomingMatter?.date,
  ]);

  const displayedEvents =
    useMemo(() => {
      const incident =
        createIncidentEvent(
          incomingMatter
        );

      const allEvents =
        incident
          ? [
              incident,
              ...events,
            ]
          : [...events];

      return allEvents.sort(
        (a, b) => {
          const first =
            new Date(
              `${a.date}T00:00:00`
            ).getTime();

          const second =
            new Date(
              `${b.date}T00:00:00`
            ).getTime();

          return first - second;
        }
      );
    }, [
      events,
      incomingMatter,
    ]);

  useEffect(() => {
    updateMatter({
      timeline:
        displayedEvents,
    });
  }, [
    displayedEvents,
    updateMatter,
  ]);

  const matter = {
    ...incomingMatter,
    timeline:
      displayedEvents,
  };

  function updateNewEvent(
    field,
    value
  ) {
    setNewEvent(
      (current) => ({
        ...current,
        [field]: value,
      })
    );

    setError("");
  }

  async function addEvent(
    event
  ) {
    event.preventDefault();

    if (
      !newEvent.date ||
      !newEvent.title.trim() ||
      saving
    ) {
      return;
    }

    if (!incomingMatter?.id) {
      setError(
        "Save this matter before adding timeline events."
      );
      return;
    }

    setSaving(true);
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

      const {
        data:
          createdEvent,
        error:
          insertError,
      } =
        await supabase
          .from(
            "timeline_events"
          )
          .insert({
            user_id: user.id,
            matter_id:
              incomingMatter.id,
            title:
              newEvent.title.trim(),
            event_date:
              newEvent.date,
            description:
              newEvent.description
                .trim() ||
              null,
            event_type:
              newEvent.type,
          })
          .select(
            `
              id,
              title,
              event_date,
              event_time,
              description,
              event_type,
              created_at,
              updated_at
            `
          )
          .single();

      if (insertError) {
        throw insertError;
      }

      const mappedEvent =
        mapDatabaseEvent(
          createdEvent
        );

      setEvents(
        (current) => [
          ...current,
          mappedEvent,
        ]
      );

      setNewEvent({
        date: "",
        type: "Other",
        title: "",
        description: "",
      });

      setShowForm(false);
      setNotice(
        evidenceSuggestion
          ? "Reviewed suggestion added to your timeline."
          : "Timeline event added."
      );
    } catch (
      saveError
    ) {
      console.error(
        "Unable to save timeline event:",
        saveError
      );

      setError(
        "We couldn't save this event. Your matter has not been changed, so please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(
    id
  ) {
    if (
      saving ||
      String(id).startsWith(
        "incident-"
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const {
        error:
          deleteError,
      } =
        await supabase
          .from(
            "timeline_events"
          )
          .delete()
          .eq("id", id)
          .eq(
            "matter_id",
            incomingMatter.id
          );

      if (deleteError) {
        throw deleteError;
      }

      setEvents(
        (current) =>
          current.filter(
            (item) =>
              item.id !== id
          )
      );
    } catch (
      deleteError
    ) {
      console.error(
        "Unable to delete timeline event:",
        deleteError
      );

      setError(
        "We couldn't delete this event. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function formatDate(
    dateString
  ) {
    if (!dateString) {
      return "";
    }

    const date =
      new Date(
        `${dateString}T00:00:00`
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return dateString;
    }

    return new Intl
      .DateTimeFormat(
        "en-ZA",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      )
      .format(date);
  }

  function goToOverview() {
    navigate(
      "/matters/new/overview",
      {
        state: {
          matter,
        },
      }
    );
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

  return (
    <main className="timeline-page">
      <section className="timeline-shell">
        <header className="timeline-header">
          <button
            type="button"
            className="timeline-back"
            onClick={
              goToOverview
            }
            aria-label="Back to matter overview"
          >
            ←
          </button>

          <span className="timeline-wordmark">
            VERDICT
          </span>

          <span
            className="timeline-more"
            aria-hidden="true"
          />
        </header>

        <section className="timeline-title-section">
          <span className="timeline-eyebrow">
            Your matter
          </span>

          <h1>
            Timeline
          </h1>

          <p>
            Keep important
            events,
            conversations and
            deadlines in the
            order they happened.
          </p>
        </section>

        <nav
          className="timeline-tabs"
          aria-label="Matter sections"
        >
          <button
            type="button"
            onClick={
              goToOverview
            }
          >
            Overview
          </button>

          <button
            type="button"
            onClick={
              goToEvidence
            }
          >
            Evidence
          </button>

          <button
            type="button"
            className="active"
            aria-current="page"
          >
            Timeline
          </button>
        </nav>

        <section className="timeline-actions">
          <div>
            <span className="section-label">
              Matter history
            </span>

            <h2>
              {loading
                ? "Loading..."
                : displayedEvents.length ===
                    0
                  ? "No events yet"
                  : `${
                      displayedEvents.length
                    } ${
                      displayedEvents.length ===
                      1
                        ? "event"
                        : "events"
                    }`}
            </h2>
          </div>

          <button
            type="button"
            className="add-event-button"
            disabled={
              loading ||
              saving
            }
            onClick={() =>
              setShowForm(
                (current) =>
                  !current
              )
            }
          >
            {showForm
              ? "Cancel"
              : "+ Add event"}
          </button>
        </section>

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {notice && (
          <p
            className="timeline-suggestion-notice"
            role="status"
          >
            {notice}
          </p>
        )}

        {showForm && (
          <form
            className="timeline-form"
            onSubmit={addEvent}
          >
            <div className="timeline-form-heading">
              <span>
                {evidenceSuggestion
                  ? "Review evidence suggestion"
                  : evidenceSuggestion
                  ? "Confirm and add"
                  : "Add to timeline"}
              </span>

              <p>
                {evidenceSuggestion
                  ? "Verdict has only pre-filled this form. Confirm or change the details before saving."
                  : "Add one important event at a time."}
              </p>
            </div>

            <label>
              <span>
                Date
              </span>

              <input
                type="date"
                value={
                  newEvent.date
                }
                disabled={saving}
                onChange={(
                  event
                ) =>
                  updateNewEvent(
                    "date",
                    event.target
                      .value
                  )
                }
                required
              />
            </label>

            <label>
              <span>
                Event type
              </span>

              <select
                value={
                  newEvent.type
                }
                disabled={saving}
                onChange={(
                  event
                ) =>
                  updateNewEvent(
                    "type",
                    event.target
                      .value
                  )
                }
              >
                <option>
                  Incident
                </option>

                <option>
                  Message
                </option>

                <option>
                  Payment
                </option>

                <option>
                  Notice
                </option>

                <option>
                  Meeting
                </option>

                <option>
                  Call
                </option>

                <option>
                  Document
                </option>

                <option>
                  Filing
                </option>

                <option>
                  Deadline
                </option>

                <option>
                  Other
                </option>
              </select>
            </label>

            <label>
              <span>
                What happened?
              </span>

              <input
                type="text"
                value={
                  newEvent.title
                }
                disabled={saving}
                onChange={(
                  event
                ) =>
                  updateNewEvent(
                    "title",
                    event.target
                      .value
                  )
                }
                placeholder="For example: Landlord said the deposit would be returned"
                required
              />
            </label>

            <label>
              <span>
                More detail{" "}
                <small>
                  (optional)
                </small>
              </span>

              <textarea
                rows="4"
                value={
                  newEvent.description
                }
                disabled={saving}
                onChange={(
                  event
                ) =>
                  updateNewEvent(
                    "description",
                    event.target
                      .value
                  )
                }
                placeholder="Add any useful details you want to remember."
              />
            </label>

            <button
              type="submit"
              className="save-event-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Add to timeline"}

              {!saving && (
                <span>→</span>
              )}
            </button>
          </form>
        )}

        {!loading &&
        displayedEvents.length ===
          0 ? (
          <section className="timeline-empty">
            <div className="timeline-empty-mark">
              +
            </div>

            <h3>
              Start building your
              timeline
            </h3>

            <p>
              Add important dates
              such as payments,
              notices, messages,
              meetings or
              deadlines.
            </p>

            {!showForm && (
              <button
                type="button"
                onClick={() =>
                  setShowForm(
                    true
                  )
                }
              >
                Add first event
              </button>
            )}
          </section>
        ) : (
          !loading && (
            <section className="timeline-list">
              {displayedEvents.map(
                (
                  item,
                  index
                ) => (
                  <article
                    className="timeline-item"
                    key={
                      item.id
                    }
                  >
                    <div className="timeline-rail">
                      <span className="timeline-dot" />

                      {index !==
                        displayedEvents.length -
                          1 && (
                        <span className="timeline-line" />
                      )}
                    </div>

                    <div className="timeline-content">
                      <div className="timeline-item-top">
                        <div>
                          <span className="timeline-date">
                            {formatDate(
                              item.date
                            )}
                          </span>

                          <span className="timeline-type">
                            {
                              item.type
                            }
                          </span>
                        </div>

                        {!item.derived && (
                          <button
                            type="button"
                            className="delete-event-button"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              removeEvent(
                                item.id
                              )
                            }
                            aria-label={`Delete ${item.title}`}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <h3>
                        {
                          item.title
                        }
                      </h3>

                      {item.description && (
                        <p>
                          {
                            item.description
                          }
                        </p>
                      )}
                    </div>
                  </article>
                )
              )}
            </section>
          )
        )}

        <article className="timeline-tip">
          <span>
            i
          </span>

          <div>
            <h3>
              Why the timeline
              matters
            </h3>

            <p>
              Dates can help make
              your matter easier
              to understand and
              may be important
              when checking
              notices, limitation
              periods or other
              deadlines.
            </p>
          </div>
        </article>

        <div className="timeline-bottom-action">
          <button
            type="button"
            onClick={
              goToOverview
            }
          >
            Done
            <span>→</span>
          </button>
        </div>
      </section>
    </main>
  );
}

export default Timeline;