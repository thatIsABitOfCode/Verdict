import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabaseClient";

import "../styles/calendar.css";

function formatDateKey(date) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLongDate(
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
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    )
    .format(date);
}

function formatMatterTitle(
  matter
) {
  if (
    matter.title?.trim()
  ) {
    return matter.title.trim();
  }

  if (
    matter.involved_type
  ) {
    return `${matter.involved_type} matter`;
  }

  return "Legal matter";
}

function mapCalendarEvent(
  item,
  matters
) {
  const linkedMatter =
    matters.find(
      (matter) =>
        matter.id ===
        item.matter_id
    );

  return {
    id: item.id,
    title:
      item.title || "",
    date:
      item.event_date || "",
    time:
      item.event_time
        ? item.event_time.slice(
            0,
            5
          )
        : "",
    type:
      item.event_type ||
      "Reminder",
    matterId:
      item.matter_id || "",
    matter:
      linkedMatter
        ? formatMatterTitle(
            linkedMatter
          )
        : "",
    notes:
      item.notes || "",
  };
}

function mapJourneyReminder(
  item,
  matters
) {
  const scheduledDate =
    new Date(
      item.scheduled_for
    );

  const linkedMatter =
    matters.find(
      (matter) =>
        matter.id ===
        item.matter_id
    );

  return {
    id:
      `journey-${item.id}`,
    reminderId:
      item.id,
    title:
      item.title ||
      "Verdict reminder",
    date:
      Number.isNaN(
        scheduledDate.getTime()
      )
        ? ""
        : formatDateKey(
            scheduledDate
          ),
    time:
      Number.isNaN(
        scheduledDate.getTime()
      )
        ? ""
        : `${String(
            scheduledDate.getHours()
          ).padStart(
            2,
            "0"
          )}:${String(
            scheduledDate.getMinutes()
          ).padStart(
            2,
            "0"
          )}`,
    type:
      "Verdict reminder",
    matterId:
      item.matter_id ||
      "",
    matter:
      linkedMatter
        ? formatMatterTitle(
            linkedMatter
          )
        : "",
    notes:
      item.message || "",
    source:
      "journey",
    status:
      item.status ||
      "scheduled",
  };
}

function Calendar() {
  const navigate =
    useNavigate();

  const today =
    new Date();

  const todayKey =
    formatDateKey(today);

  const [
    currentDate,
    setCurrentDate,
  ] = useState(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    todayKey
  );

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    events,
    setEvents,
  ] = useState([]);

  const [
    matters,
    setMatters,
  ] = useState([]);

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
    newEvent,
    setNewEvent,
  ] = useState({
    title: "",
    date: todayKey,
    time: "",
    type: "Reminder",
    matterId: "",
    notes: "",
  });

  useEffect(() => {
    let mounted = true;

    async function loadCalendar() {
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
          mattersResult,
          eventsResult,
          remindersResult,
        ] =
          await Promise.all([
            supabase
              .from("matters")
              .select(
                `
                  id,
                  title,
                  involved_type,
                  status,
                  created_at
                `
              )
              .eq(
                "user_id",
                user.id
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                }
              ),

            supabase
              .from(
                "calendar_events"
              )
              .select(
                `
                  id,
                  matter_id,
                  title,
                  event_date,
                  event_time,
                  event_type,
                  notes,
                  created_at,
                  updated_at
                `
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

            supabase
              .from(
                "matter_reminders"
              )
              .select(
                `
                  id,
                  matter_id,
                  action_id,
                  title,
                  message,
                  reminder_type,
                  scheduled_for,
                  status,
                  sent_at,
                  created_at,
                  updated_at
                `
              )
              .eq(
                "user_id",
                user.id
              )
              .neq(
                "status",
                "cancelled"
              )
              .order(
                "scheduled_for",
                {
                  ascending:
                    true,
                }
              ),
          ]);

        if (
          mattersResult.error
        ) {
          throw mattersResult.error;
        }

        if (
          eventsResult.error
        ) {
          throw eventsResult.error;
        }

        if (
          remindersResult.error
        ) {
          throw remindersResult.error;
        }

        if (!mounted) {
          return;
        }

        const loadedMatters =
          Array.isArray(
            mattersResult.data
          )
            ? mattersResult.data
            : [];

        const loadedEvents =
          Array.isArray(
            eventsResult.data
          )
            ? eventsResult.data
            : [];

        const loadedReminders =
          Array.isArray(
            remindersResult.data
          )
            ? remindersResult.data
            : [];

        setMatters(
          loadedMatters
        );

        setEvents([
          ...loadedEvents.map(
            (item) =>
              mapCalendarEvent(
                item,
                loadedMatters
              )
          ),

          ...loadedReminders
            .map(
              (item) =>
                mapJourneyReminder(
                  item,
                  loadedMatters
                )
            )
            .filter(
              (item) =>
                Boolean(
                  item.date
                )
            ),
        ]);
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load calendar:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load your calendar right now. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCalendar();

    return () => {
      mounted = false;
    };
  }, []);

  const monthLabel =
    new Intl
      .DateTimeFormat(
        "en-ZA",
        {
          month: "long",
          year: "numeric",
        }
      )
      .format(
        currentDate
      );

  const calendarDays =
    useMemo(() => {
      const year =
        currentDate
          .getFullYear();

      const month =
        currentDate
          .getMonth();

      const firstDay =
        new Date(
          year,
          month,
          1
        );

      const lastDay =
        new Date(
          year,
          month + 1,
          0
        );

      const firstWeekday =
        firstDay.getDay();

      const daysInMonth =
        lastDay.getDate();

      const days = [];

      for (
        let index = 0;
        index <
        firstWeekday;
        index += 1
      ) {
        days.push(null);
      }

      for (
        let day = 1;
        day <=
        daysInMonth;
        day += 1
      ) {
        days.push(
          new Date(
            year,
            month,
            day
          )
        );
      }

      return days;
    }, [currentDate]);

  const selectedEvents =
    useMemo(() => {
      return events
        .filter(
          (item) =>
            item.date ===
            selectedDate
        )
        .sort(
          (a, b) =>
            (
              a.time || ""
            ).localeCompare(
              b.time || ""
            )
        );
    }, [
      events,
      selectedDate,
    ]);

  function previousMonth() {
    setCurrentDate(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() -
            1,
          1
        )
    );
  }

  function nextMonth() {
    setCurrentDate(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() +
            1,
          1
        )
    );
  }

  function selectDate(
    date
  ) {
    if (!date) {
      return;
    }

    const dateKey =
      formatDateKey(
        date
      );

    setSelectedDate(
      dateKey
    );

    setNewEvent(
      (current) => ({
        ...current,
        date: dateKey,
      })
    );
  }

  function openAddEvent() {
    setError("");

    setNewEvent({
      title: "",
      date:
        selectedDate ||
        todayKey,
      time: "",
      type: "Reminder",
      matterId: "",
      notes: "",
    });

    setShowForm(true);
  }

  function closeAddEvent() {
    if (saving) {
      return;
    }

    setShowForm(false);
  }

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
      !newEvent.title.trim() ||
      !newEvent.date ||
      saving
    ) {
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
            "calendar_events"
          )
          .insert({
            user_id:
              user.id,
            matter_id:
              newEvent
                .matterId ||
              null,
            title:
              newEvent
                .title
                .trim(),
            event_date:
              newEvent.date,
            event_time:
              newEvent.time ||
              null,
            event_type:
              newEvent.type,
            notes:
              newEvent.notes
                .trim() ||
              null,
          })
          .select(
            `
              id,
              matter_id,
              title,
              event_date,
              event_time,
              event_type,
              notes,
              created_at,
              updated_at
            `
          )
          .single();

      if (insertError) {
        throw insertError;
      }

      const calendarEvent =
        mapCalendarEvent(
          createdEvent,
          matters
        );

      setEvents(
        (current) => [
          ...current,
          calendarEvent,
        ]
      );

      setSelectedDate(
        newEvent.date
      );

      const eventDate =
        new Date(
          `${newEvent.date}T00:00:00`
        );

      if (
        !Number.isNaN(
          eventDate.getTime()
        )
      ) {
        setCurrentDate(
          new Date(
            eventDate
              .getFullYear(),
            eventDate
              .getMonth(),
            1
          )
        );
      }

      setNewEvent({
        title: "",
        date:
          newEvent.date,
        time: "",
        type: "Reminder",
        matterId: "",
        notes: "",
      });

      setShowForm(false);
    } catch (
      saveError
    ) {
      console.error(
        "Unable to save calendar item:",
        saveError
      );

      setError(
        "We couldn't save this calendar item. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(
    id
  ) {
    if (saving) {
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
            "calendar_events"
          )
          .delete()
          .eq("id", id);

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
        "Unable to delete calendar item:",
        deleteError
      );

      setError(
        "We couldn't delete this calendar item. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function openLinkedMatter(
    matterId
  ) {
    if (!matterId) {
      return;
    }

    const linkedMatter =
      matters.find(
        (matter) =>
          matter.id ===
          matterId
      );

    sessionStorage.setItem(
      "verdictCurrentMatterId",
      matterId
    );

    navigate(
      "/matters/new/overview",
      {
        state: {
          matter:
            linkedMatter || {
              id:
                matterId,
            },
        },
      }
    );
  }

  function hasEventsOnDate(
    dateKey
  ) {
    return events.some(
      (item) =>
        item.date ===
        dateKey
    );
  }

  function eventCountOnDate(
    dateKey
  ) {
    return events.filter(
      (item) =>
        item.date ===
        dateKey
    ).length;
  }

  return (
    <main className="calendar-page">
      <section className="calendar-shell">
        <header className="calendar-header">
          <button
            type="button"
            className="calendar-back"
            onClick={() =>
              navigate("/home")
            }
            aria-label="Back to home"
          >
            ←
          </button>

          <span className="calendar-wordmark">
            VERDICT
          </span>

          <button
            type="button"
            className="calendar-add-header"
            onClick={
              openAddEvent
            }
            disabled={
              loading
            }
            aria-label="Add calendar item"
          >
            +
          </button>
        </header>

        <section className="calendar-title-section">
          <span className="calendar-eyebrow">
            Your schedule
          </span>

          <h1>
            Calendar
          </h1>

          <p>
            Keep important
            reminders,
            appointments and
            dates organised in
            one place.
          </p>
        </section>

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="calendar-month-card">
          <div className="calendar-month-top">
            <button
              type="button"
              onClick={
                previousMonth
              }
              aria-label="Previous month"
            >
              ←
            </button>

            <h2>
              {monthLabel}
            </h2>

            <button
              type="button"
              onClick={
                nextMonth
              }
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div className="calendar-weekdays">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="calendar-grid">
            {calendarDays.map(
              (
                date,
                index
              ) => {
                if (!date) {
                  return (
                    <span
                      key={`empty-${index}`}
                      className="calendar-empty-day"
                      aria-hidden="true"
                    />
                  );
                }

                const dateKey =
                  formatDateKey(
                    date
                  );

                const isToday =
                  dateKey ===
                  todayKey;

                const isSelected =
                  dateKey ===
                  selectedDate;

                const hasEvents =
                  hasEventsOnDate(
                    dateKey
                  );

                const eventCount =
                  eventCountOnDate(
                    dateKey
                  );

                return (
                  <button
                    key={
                      dateKey
                    }
                    type="button"
                    className={[
                      "calendar-day",
                      isToday
                        ? "today"
                        : "",
                      isSelected
                        ? "selected"
                        : "",
                      hasEvents
                        ? "has-events"
                        : "",
                    ]
                      .filter(
                        Boolean
                      )
                      .join(" ")}
                    onClick={() =>
                      selectDate(
                        date
                      )
                    }
                    aria-label={`${formatLongDate(
                      dateKey
                    )}${
                      eventCount >
                      0
                        ? `, ${eventCount} ${
                            eventCount ===
                            1
                              ? "calendar item"
                              : "calendar items"
                          }`
                        : ""
                    }`}
                  >
                    <span>
                      {
                        date.getDate()
                      }
                    </span>

                    {hasEvents && (
                      <span
                        className="calendar-event-dot"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </section>

        <section className="calendar-selected-section">
          <div className="calendar-selected-heading">
            <div>
              <span className="section-label">
                Selected date
              </span>

              <h2>
                {formatLongDate(
                  selectedDate
                )}
              </h2>
            </div>

            <button
              type="button"
              className="calendar-add-button"
              onClick={
                openAddEvent
              }
              disabled={
                loading
              }
            >
              + Add item
            </button>
          </div>

          {loading ? (
            <div className="calendar-empty-state">
              <div className="calendar-empty-icon">
                □
              </div>

              <h3>
                Loading calendar
              </h3>

              <p>
                Verdict is
                securely
                retrieving your
                calendar items.
              </p>
            </div>
          ) : selectedEvents.length ===
            0 ? (
            <div className="calendar-empty-state">
              <div className="calendar-empty-icon">
                □
              </div>

              <h3>
                Nothing scheduled
              </h3>

              <p>
                Add a reminder,
                deadline,
                appointment or
                other important
                date.
              </p>

              <button
                type="button"
                onClick={
                  openAddEvent
                }
              >
                Add calendar item
              </button>
            </div>
          ) : (
            <div className="calendar-event-list">
              {selectedEvents.map(
                (item) => (
                  <article
                    key={
                      item.id
                    }
                    className="calendar-event-card"
                  >
                    <div className="calendar-event-marker">
                      <span />
                    </div>

                    <div className="calendar-event-content">
                      <div className="calendar-event-top">
                        <div>
                          <span className="calendar-event-type">
                            {
                              item.type
                            }
                          </span>

                          <h3>
                            {
                              item.title
                            }
                          </h3>
                        </div>

                        {item.source !==
                        "journey" ? (
                          <button
                            type="button"
                            className="calendar-delete-event"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              deleteEvent(
                                item.id
                              )
                            }
                            aria-label={`Delete ${item.title}`}
                          >
                            ×
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize:
                                "0.72rem",
                              opacity:
                                0.7,
                            }}
                          >
                            {item.status ===
                            "sent"
                              ? "Sent"
                              : "Scheduled"}
                          </span>
                        )}
                      </div>

                      <div className="calendar-event-meta">
                        {item.time && (
                          <span>
                            {
                              item.time
                            }
                          </span>
                        )}

                        {item.matter && (
                          <button
                            type="button"
                            onClick={() =>
                              openLinkedMatter(
                                item.matterId
                              )
                            }
                            style={{
                              border: "0",
                              background:
                                "transparent",
                              padding: "0",
                              font:
                                "inherit",
                              color:
                                "inherit",
                              textDecoration:
                                "underline",
                              cursor:
                                "pointer",
                            }}
                          >
                            {
                              item.matter
                            }
                          </button>
                        )}

                        {item.source ===
                          "journey" && (
                          <span>
                            Journey
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p>
                          {
                            item.notes
                          }
                        </p>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <article className="calendar-safety-note">
          <span>
            i
          </span>

          <div>
            <h3>
              Calendar reminders
              are not legal
              deadline
              verification
            </h3>

            <p>
              Personal calendar
              items and Verdict
              journey reminders help
              you stay organised.
              They do not by
              themselves verify
              court dates,
              limitation periods,
              filing deadlines or
              statutory time
              limits.
            </p>
          </div>
        </article>
      </section>

      {showForm && (
        <div
          className="calendar-modal-overlay"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeAddEvent();
            }
          }}
        >
          <section
            className="calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-form-title"
          >
            <div className="calendar-modal-header">
              <div>
                <span className="section-label">
                  Calendar
                </span>

                <h2 id="calendar-form-title">
                  Add calendar
                  item
                </h2>
              </div>

              <button
                type="button"
                className="calendar-modal-close"
                onClick={
                  closeAddEvent
                }
                disabled={
                  saving
                }
                aria-label="Close calendar form"
              >
                ×
              </button>
            </div>

            <form
              className="calendar-form"
              onSubmit={
                addEvent
              }
            >
              <label>
                <span>
                  Title
                </span>

                <input
                  type="text"
                  value={
                    newEvent.title
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateNewEvent(
                      "title",
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="For example: Follow up with Legal Aid"
                  required
                />
              </label>

              <div className="calendar-form-row">
                <label>
                  <span>
                    Date
                  </span>

                  <input
                    type="date"
                    value={
                      newEvent.date
                    }
                    disabled={
                      saving
                    }
                    onChange={(
                      event
                    ) =>
                      updateNewEvent(
                        "date",
                        event
                          .target
                          .value
                      )
                    }
                    required
                  />
                </label>

                <label>
                  <span>
                    Time{" "}
                    <small>
                      (optional)
                    </small>
                  </span>

                  <input
                    type="time"
                    value={
                      newEvent.time
                    }
                    disabled={
                      saving
                    }
                    onChange={(
                      event
                    ) =>
                      updateNewEvent(
                        "time",
                        event
                          .target
                          .value
                      )
                    }
                  />
                </label>
              </div>

              <label>
                <span>
                  Type
                </span>

                <select
                  value={
                    newEvent.type
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateNewEvent(
                      "type",
                      event
                        .target
                        .value
                    )
                  }
                >
                  <option>
                    Reminder
                  </option>

                  <option>
                    Deadline
                  </option>

                  <option>
                    Appointment
                  </option>

                  <option>
                    Hearing
                  </option>

                  <option>
                    Follow-up
                  </option>

                  <option>
                    Filing
                  </option>

                  <option>
                    Other
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Matter{" "}
                  <small>
                    (optional)
                  </small>
                </span>

                <select
                  value={
                    newEvent.matterId
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateNewEvent(
                      "matterId",
                      event
                        .target
                        .value
                    )
                  }
                >
                  <option value="">
                    No linked
                    matter
                  </option>

                  {matters.map(
                    (matter) => (
                      <option
                        key={
                          matter.id
                        }
                        value={
                          matter.id
                        }
                      >
                        {formatMatterTitle(
                          matter
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  Notes{" "}
                  <small>
                    (optional)
                  </small>
                </span>

                <textarea
                  rows="4"
                  value={
                    newEvent.notes
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateNewEvent(
                      "notes",
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Add anything useful you want to remember."
                />
              </label>

              {error && (
                <div
                  className="auth-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="calendar-form-actions">
                <button
                  type="button"
                  className="calendar-cancel-button"
                  onClick={
                    closeAddEvent
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="calendar-save-button"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Saving..."
                    : "Save item"}

                  {!saving && (
                    <span>
                      →
                    </span>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Calendar;