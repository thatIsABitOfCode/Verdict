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

import "../styles/notifications.css";

function formatMatterTitle(
  matter
) {
  if (
    matter?.title?.trim()
  ) {
    return matter.title.trim();
  }

  if (
    matter?.involved_type
  ) {
    return `${matter.involved_type} matter`;
  }

  return "Legal matter";
}

function formatNotificationTime(
  dateValue
) {
  if (!dateValue) {
    return "";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const now =
    new Date();

  const todayKey =
    `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    )}-${String(
      now.getDate()
    ).padStart(
      2,
      "0"
    )}`;

  const dateKey =
    `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    )}-${String(
      date.getDate()
    ).padStart(
      2,
      "0"
    )}`;

  const time =
    new Intl
      .DateTimeFormat(
        "en-ZA",
        {
          hour:
            "2-digit",
          minute:
            "2-digit",
        }
      )
      .format(date);

  if (
    dateKey ===
    todayKey
  ) {
    return `Today · ${time}`;
  }

  return new Intl
    .DateTimeFormat(
      "en-ZA",
      {
        day:
          "numeric",
        month:
          "short",
        hour:
          "2-digit",
        minute:
          "2-digit",
      }
    )
    .format(date);
}

function calendarDateTime(
  eventDate,
  eventTime
) {
  if (!eventDate) {
    return null;
  }

  const time =
    eventTime
      ? eventTime.slice(
          0,
          5
        )
      : "09:00";

  const value =
    new Date(
      `${eventDate}T${time}:00`
    );

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return null;
  }

  return value;
}

function Notifications() {
  const navigate =
    useNavigate();

  const [
    filter,
    setFilter,
  ] = useState("All");

  const [
    notifications,
    setNotifications,
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
    permission,
    setPermission,
  ] = useState(
    typeof Notification !==
      "undefined"
      ? Notification.permission
      : "unsupported"
  );

  const filters = [
    "All",
    "Unread",
    "Matter",
    "Reminder",
  ];

  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
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

        const today =
          new Date();

        const todayKey =
          `${today.getFullYear()}-${String(
            today.getMonth() + 1
          ).padStart(
            2,
            "0"
          )}-${String(
            today.getDate()
          ).padStart(
            2,
            "0"
          )}`;

        const [
          mattersResult,
          remindersResult,
          calendarResult,
        ] =
          await Promise.all([
            supabase
              .from("matters")
              .select(
                `
                  id,
                  title,
                  involved_type,
                  status
                `
              )
              .eq(
                "user_id",
                user.id
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
                  created_at
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
                  created_at
                `
              )
              .eq(
                "user_id",
                user.id
              )
              .gte(
                "event_date",
                todayKey
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
          mattersResult.error
        ) {
          throw mattersResult.error;
        }

        if (
          remindersResult.error
        ) {
          throw remindersResult.error;
        }

        if (
          calendarResult.error
        ) {
          throw calendarResult.error;
        }

        const matters =
          Array.isArray(
            mattersResult.data
          )
            ? mattersResult.data
            : [];

        const reminderRows =
          Array.isArray(
            remindersResult.data
          )
            ? remindersResult.data
            : [];

        const calendarRows =
          Array.isArray(
            calendarResult.data
          )
            ? calendarResult.data
            : [];

        const readIds =
          JSON.parse(
            localStorage.getItem(
              "verdictReadNotifications"
            ) || "[]"
          );

        const dismissedIds =
          JSON.parse(
            localStorage.getItem(
              "verdictDismissedNotifications"
            ) || "[]"
          );

        const journeyItems =
          reminderRows.map(
            (item) => {
              const matter =
                matters.find(
                  (entry) =>
                    entry.id ===
                    item.matter_id
                );

              const id =
                `journey-${item.id}`;

              return {
                id,
                sourceId:
                  item.id,
                source:
                  "journey",
                type:
                  "Matter",
                title:
                  item.title ||
                  "Matter reminder",
                message:
                  item.message ||
                  "Verdict has a reminder for this matter.",
                time:
                  formatNotificationTime(
                    item.scheduled_for
                  ),
                notifyAt:
                  item.scheduled_for,
                unread:
                  !readIds.includes(
                    id
                  ),
                matterId:
                  item.matter_id ||
                  "",
                matterTitle:
                  matter
                    ? formatMatterTitle(
                        matter
                      )
                    : "",
                status:
                  item.status ||
                  "scheduled",
              };
            }
          );

        const calendarItems =
          calendarRows.map(
            (item) => {
              const matter =
                matters.find(
                  (entry) =>
                    entry.id ===
                    item.matter_id
                );

              const dateTime =
                calendarDateTime(
                  item.event_date,
                  item.event_time
                );

              const id =
                `calendar-${item.id}`;

              return {
                id,
                sourceId:
                  item.id,
                source:
                  "calendar",
                type:
                  "Reminder",
                title:
                  item.title ||
                  "Calendar reminder",
                message:
                  item.notes ||
                  (
                    matter
                      ? `Linked to ${formatMatterTitle(
                          matter
                        )}.`
                      : `${
                          item.event_type ||
                          "Calendar item"
                        } scheduled in Verdict.`
                  ),
                time:
                  dateTime
                    ? formatNotificationTime(
                        dateTime
                      )
                    : item.event_date,
                notifyAt:
                  dateTime
                    ? dateTime.toISOString()
                    : null,
                unread:
                  !readIds.includes(
                    id
                  ),
                matterId:
                  item.matter_id ||
                  "",
                matterTitle:
                  matter
                    ? formatMatterTitle(
                        matter
                      )
                    : "",
                status:
                  "scheduled",
              };
            }
          );

        const combined = [
          ...journeyItems,
          ...calendarItems,
        ]
          .filter(
            (item) =>
              !dismissedIds.includes(
                item.id
              )
          )
          .sort(
            (a, b) => {
              const aTime =
                a.notifyAt
                  ? new Date(
                      a.notifyAt
                    ).getTime()
                  : Number.MAX_SAFE_INTEGER;

              const bTime =
                b.notifyAt
                  ? new Date(
                      b.notifyAt
                    ).getTime()
                  : Number.MAX_SAFE_INTEGER;

              return (
                aTime -
                bTime
              );
            }
          );

        if (mounted) {
          setNotifications(
            combined
          );
        }
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load notifications:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load your notifications right now."
          );
        }
      } finally {
        if (mounted) {
          setLoading(
            false
          );
        }
      }
    }

    loadNotifications();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      typeof Notification ===
        "undefined" ||
      Notification.permission !==
        "granted" ||
      notifications.length === 0
    ) {
      return;
    }

    /*
     * Check immediately and then every 30 seconds while this
     * page is open. This fixes the old behaviour where a future
     * reminder was checked only when the notifications array changed.
     */
    function showDueNotifications() {
      const alreadySent =
        JSON.parse(
          localStorage.getItem(
            "verdictBrowserNotificationsSent"
          ) || "[]"
        );

      const sentSet =
        new Set(alreadySent);

      const now = Date.now();
      let changed = false;

      notifications.forEach(
        (item) => {
          if (
            !item.notifyAt ||
            sentSet.has(item.id)
          ) {
            return;
          }

          const dueAt =
            new Date(
              item.notifyAt
            ).getTime();

          if (
            Number.isNaN(dueAt) ||
            dueAt > now
          ) {
            return;
          }

          try {
            const browserNotification =
              new Notification(
                item.title,
                {
                  body:
                    item.message,
                  tag:
                    item.id,
                }
              );

            browserNotification.onclick =
              () => {
                window.focus();

                if (item.matterId) {
                  sessionStorage.setItem(
                    "verdictCurrentMatterId",
                    item.matterId
                  );

                  navigate(
                    "/matters/new/overview",
                    {
                      state: {
                        matter: {
                          id:
                            item.matterId,
                        },
                      },
                    }
                  );
                } else {
                  navigate(
                    "/calendar"
                  );
                }

                browserNotification.close();
              };

            sentSet.add(item.id);
            changed = true;
          } catch (
            notificationError
          ) {
            console.error(
              "Browser notification failed:",
              notificationError
            );
          }
        }
      );

      if (changed) {
        localStorage.setItem(
          "verdictBrowserNotificationsSent",
          JSON.stringify(
            [...sentSet]
          )
        );
      }
    }

    showDueNotifications();

    const timerId =
      window.setInterval(
        showDueNotifications,
        30000
      );

    return () => {
      window.clearInterval(
        timerId
      );
    };
  }, [
    notifications,
    navigate,
  ]);

  const visibleNotifications =
    useMemo(() => {
      if (
        filter === "All"
      ) {
        return notifications;
      }

      if (
        filter === "Unread"
      ) {
        return notifications.filter(
          (item) =>
            item.unread
        );
      }

      return notifications.filter(
        (item) =>
          item.type ===
          filter
      );
    }, [
      filter,
      notifications,
    ]);

  const unreadCount =
    notifications.filter(
      (item) =>
        item.unread
    ).length;

  function persistReadIds(
    items
  ) {
    localStorage.setItem(
      "verdictReadNotifications",
      JSON.stringify(
        items
      )
    );
  }

  function markRead(
    id
  ) {
    setNotifications(
      (current) => {
        const next =
          current.map(
            (item) =>
              item.id === id
                ? {
                    ...item,
                    unread:
                      false,
                  }
                : item
          );

        const readIds =
          next
            .filter(
              (item) =>
                !item.unread
            )
            .map(
              (item) =>
                item.id
            );

        persistReadIds(
          readIds
        );

        return next;
      }
    );
  }

  function markAllRead() {
    setNotifications(
      (current) => {
        const next =
          current.map(
            (item) => ({
              ...item,
              unread:
                false,
            })
          );

        persistReadIds(
          next.map(
            (item) =>
              item.id
          )
        );

        return next;
      }
    );
  }

  function removeNotification(
    id
  ) {
    setNotifications(
      (current) =>
        current.filter(
          (item) =>
            item.id !== id
        )
    );

    const dismissedIds =
      JSON.parse(
        localStorage.getItem(
          "verdictDismissedNotifications"
        ) || "[]"
      );

    if (
      !dismissedIds.includes(
        id
      )
    ) {
      dismissedIds.push(
        id
      );
    }

    localStorage.setItem(
      "verdictDismissedNotifications",
      JSON.stringify(
        dismissedIds
      )
    );
  }

  async function enableNotifications() {
    setError("");

    if (
      typeof Notification ===
      "undefined"
    ) {
      setPermission(
        "unsupported"
      );

      setError(
        "This browser does not support notifications."
      );

      return;
    }

    try {
      const result =
        await Notification
          .requestPermission();

      setPermission(
        result
      );

      if (
        result === "granted"
      ) {
        new Notification(
          "Verdict notifications enabled",
          {
            body:
              "Verdict can now show due reminders while the app is open.",
            tag:
              "verdict-notifications-enabled",
          }
        );
      }
    } catch (
      permissionError
    ) {
      console.error(
        "Notification permission failed:",
        permissionError
      );

      setError(
        "Verdict couldn't enable browser notifications."
      );
    }
  }

  function openNotification(
    item
  ) {
    markRead(
      item.id
    );

    if (
      item.matterId
    ) {
      sessionStorage.setItem(
        "verdictCurrentMatterId",
        item.matterId
      );

      navigate(
        "/matters/new/overview",
        {
          state: {
            matter: {
              id:
                item.matterId,
            },
          },
        }
      );

      return;
    }

    navigate(
      "/calendar"
    );
  }

  return (
    <main className="notifications-page">
      <section className="notifications-shell">
        <header className="notifications-header">
          <button
            type="button"
            className="notifications-back"
            onClick={() =>
              navigate(
                "/home"
              )
            }
            aria-label="Go back"
          >
            ←
          </button>

          <span className="notifications-wordmark">
            VERDICT
          </span>

          <div className="notifications-header-space" />
        </header>

        <section className="notifications-title">
          <span className="notifications-eyebrow">
            Updates & reminders
          </span>

          <div className="notifications-title-row">
            <div>
              <h1>
                Notifications
              </h1>

              <p>
                Important updates
                about your matters,
                reminders and
                calendar.
              </p>
            </div>

            {unreadCount >
              0 && (
              <span className="notification-count">
                {
                  unreadCount
                }
              </span>
            )}
          </div>
        </section>

        <section className="notifications-toolbar">
          <div className="notification-filters">
            {filters.map(
              (item) => (
                <button
                  type="button"
                  key={
                    item
                  }
                  className={
                    filter ===
                    item
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setFilter(
                      item
                    )
                  }
                >
                  {
                    item
                  }
                </button>
              )
            )}
          </div>

          {unreadCount >
            0 && (
            <button
              type="button"
              className="mark-all-read"
              onClick={
                markAllRead
              }
            >
              Mark all read
            </button>
          )}
        </section>

        {permission !==
          "granted" && (
          <article className="notifications-info">
            <span>
              !
            </span>

            <div>
              <strong>
                Enable device
                notifications
              </strong>

              <p>
                Allow Verdict to
                show reminders
                when they become
                due while the app
                is open.
              </p>

              {permission ===
              "denied" ? (
                <p>
                  Notifications are
                  blocked in your
                  browser settings.
                </p>
              ) : permission ===
                "unsupported" ? (
                <p>
                  This browser does
                  not support web
                  notifications.
                </p>
              ) : (
                <button
                  type="button"
                  className="mark-all-read"
                  onClick={
                    enableNotifications
                  }
                >
                  Enable
                  notifications
                </button>
              )}
            </div>
          </article>
        )}

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {
              error
            }
          </div>
        )}

        {loading ? (
          <section className="notifications-empty">
            <div className="notifications-empty-mark">
              …
            </div>

            <h2>
              Loading
              notifications
            </h2>

            <p>
              Verdict is checking
              your matter and
              calendar reminders.
            </p>
          </section>
        ) : visibleNotifications
            .length >
          0 ? (
          <section className="notification-list">
            {visibleNotifications.map(
              (item) => (
                <article
                  className={`notification-card ${
                    item.unread
                      ? "unread"
                      : ""
                  }`}
                  key={
                    item.id
                  }
                >
                  <div className="notification-indicator">
                    {item.unread && (
                      <span />
                    )}
                  </div>

                  <div className="notification-copy">
                    <div className="notification-meta">
                      <span>
                        {
                          item.type
                        }
                      </span>

                      <span>
                        {
                          item.time
                        }
                      </span>
                    </div>

                    <h2>
                      {
                        item.title
                      }
                    </h2>

                    <p>
                      {
                        item.message
                      }
                    </p>

                    {item.matterTitle && (
                      <p>
                        Matter:{" "}
                        <strong>
                          {
                            item.matterTitle
                          }
                        </strong>
                      </p>
                    )}

                    <div className="notification-actions">
                      <button
                        type="button"
                        onClick={() =>
                          openNotification(
                            item
                          )
                        }
                      >
                        {item.matterId
                          ? "Open matter"
                          : "Open calendar"}
                      </button>

                      {item.unread && (
                        <button
                          type="button"
                          onClick={() =>
                            markRead(
                              item.id
                            )
                          }
                        >
                          Mark as read
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          removeNotification(
                            item.id
                          )
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </article>
              )
            )}
          </section>
        ) : (
          <section className="notifications-empty">
            <div className="notifications-empty-mark">
              ✓
            </div>

            <h2>
              You're all caught
              up
            </h2>

            <p>
              There are no
              notifications in
              this view.
            </p>
          </section>
        )}

        <article className="notifications-info">
          <span>
            i
          </span>

          <div>
            <strong>
              Reminder safety
            </strong>

            <p>
              Verdict reminders
              help you stay
              organised. They do
              not by themselves
              verify court dates,
              filing deadlines,
              limitation periods
              or statutory time
              limits.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Notifications;
