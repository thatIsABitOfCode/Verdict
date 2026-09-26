import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

import AppHeader from "../components/AppHeader";
import SideMenu from "../components/SideMenu";

import {
  useMatter,
} from "../context/useMatter";

import {
  supabase,
} from "../lib/supabaseClient";

import "../styles/home.css";

function mapDatabaseMatter(row) {
  return {
    id: row.id,
    story:
      row.story || "",
    date:
      row.incident_date || "",
    unsureDate:
      Boolean(
        row.unsure_date
      ),
    involvedType:
      row.involved_type || "",
    involvedName:
      row.involved_name || "",
    status:
      row.status ||
      "in_progress",
    files: [],
    timeline: [],
    updatedAt:
      row.updated_at ||
      row.created_at ||
      null,
  };
}

function Home() {
  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    story,
    setStory,
  ] = useState("");

  const [
    selectedFiles,
    setSelectedFiles,
  ] = useState([]);

  const [
    latestMatter,
    setLatestMatter,
  ] = useState(null);

  const [
    nextAction,
    setNextAction,
  ] = useState(null);

  const [
    upcomingEvent,
    setUpcomingEvent,
  ] = useState(null);

  const [
    mattersLoading,
    setMattersLoading,
  ] = useState(true);

  const fileInputRef =
    useRef(null);

  const navigate =
    useNavigate();

  const {
    setMatter,
  } = useMatter();

  useEffect(() => {
    let mounted = true;

    async function loadLatestMatter() {
      setMattersLoading(true);

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

        const {
          data:
            latestMatterRow,
          error:
            matterError,
        } =
          await supabase
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
              "user_id",
              user.id
            )
            .order(
              "updated_at",
              {
                ascending: false,
              }
            )
            .limit(1)
            .maybeSingle();

        if (matterError) {
          throw matterError;
        }

        const today =
          new Date()
            .toISOString()
            .slice(0, 10);

        const {
          data:
            calendarRows,
          error:
            calendarError,
        } =
          await supabase
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
                notes
              `
            )
            .eq(
              "user_id",
              user.id
            )
            .gte(
              "event_date",
              today
            )
            .order(
              "event_date",
              {
                ascending: true,
              }
            )
            .order(
              "event_time",
              {
                ascending: true,
                nullsFirst: false,
              }
            )
            .limit(1);

        if (calendarError) {
          throw calendarError;
        }

        if (!mounted) {
          return;
        }

        const mappedMatter =
          latestMatterRow
            ? mapDatabaseMatter(
                latestMatterRow
              )
            : null;

        setLatestMatter(
          mappedMatter
        );

        setUpcomingEvent(
          calendarRows?.[0] ||
            null
        );

        if (
          latestMatterRow?.id
        ) {
          sessionStorage.setItem(
            "verdictCurrentMatterId",
            latestMatterRow.id
          );

          try {
            const response =
              await fetch(
                "http://localhost:3001/api/journey/sync",
                {
                  method:
                    "POST",

                  headers: {
                    "Content-Type":
                      "application/json",

                    Authorization:
                      `Bearer ${session.access_token}`,
                  },

                  body:
                    JSON.stringify({
                      matterId:
                        latestMatterRow.id,
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
                result =
                  null;
              }
            }

            if (
              response.ok &&
              mounted
            ) {
              setNextAction(
                result?.nextAction ||
                  null
              );
            } else if (
              mounted
            ) {
              setNextAction(
                null
              );
            }
          } catch (
            journeyError
          ) {
            console.error(
              "Unable to load journey:",
              journeyError
            );

            if (mounted) {
              setNextAction(
                null
              );
            }
          }
        } else {
          setNextAction(null);
        }
      } catch (error) {
        console.error(
          "Unable to load home:",
          error
        );

        if (mounted) {
          setLatestMatter(
            null
          );

          setNextAction(
            null
          );

          setUpcomingEvent(
            null
          );
        }
      } finally {
        if (mounted) {
          setMattersLoading(
            false
          );
        }
      }
    }

    loadLatestMatter();

    return () => {
      mounted = false;
    };
  }, []);

  function buildMatter(
    files = selectedFiles
  ) {
    return {
      story:
        story.trim(),
      date: "",
      unsureDate: false,
      involvedType: "",
      involvedName: "",
      files,
      timeline: [],
    };
  }

  function startMatter() {
    const newMatter =
      buildMatter();

    setMatter(
      newMatter
    );

    navigate(
      "/matters/new",
      {
        state: {
          matter:
            newMatter,
        },
      }
    );
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFiles(
    event
  ) {
    const newFiles =
      Array.from(
        event.target.files ||
          []
      );

    if (
      newFiles.length === 0
    ) {
      return;
    }

    const updatedFiles = [
      ...selectedFiles,
      ...newFiles,
    ];

    setSelectedFiles(
      updatedFiles
    );

    const newMatter =
      buildMatter(
        updatedFiles
      );

    setMatter(
      newMatter
    );

    navigate(
      "/matters/new",
      {
        state: {
          matter:
            newMatter,
        },
      }
    );

    event.target.value = "";
  }

  function openLatestMatter() {
    if (
      !latestMatter?.id
    ) {
      navigate(
        "/matters"
      );
      return;
    }

    setMatter(
      latestMatter
    );

    sessionStorage.setItem(
      "verdictCurrentMatterId",
      latestMatter.id
    );

    navigate(
      "/matters/new/overview",
      {
        state: {
          matter:
            latestMatter,
        },
      }
    );
  }

  function getMatterTitle() {
    if (
      latestMatter
        ?.involvedType
    ) {
      return `${latestMatter.involvedType} matter`;
    }

    return "Your latest matter";
  }

  function getMatterPreview() {
    const value =
      latestMatter
        ?.story?.trim();

    if (!value) {
      return "Continue working on this matter.";
    }

    if (
      value.length <= 90
    ) {
      return value;
    }

    return `${value.slice(
      0,
      87
    )}...`;
  }

  function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

  return (
    <main className="home-page">
      <SideMenu
        open={menuOpen}
        onClose={() =>
          setMenuOpen(false)
        }
      />

      <div className="home-shell">
        <AppHeader
          onMenuOpen={() =>
            setMenuOpen(
              (current) =>
                !current
            )
          }
          onNotifications={() =>
            navigate(
              "/notifications"
            )
          }
        />

        <section className="home-greeting">
  <p>
    {getGreeting()}
  </p>

  <h1>
    What do you
    need help with?
  </h1>
</section>

        <section className="story-card">
          <div className="story-card-top">
            <span className="story-label">
              Tell Verdict
              what happened
            </span>

            <span className="story-status">
              Private
            </span>
          </div>

          <textarea
            value={story}
            onChange={(
              event
            ) =>
              setStory(
                event.target
                  .value
              )
            }
            placeholder="Describe your situation in your own words..."
            rows="5"
          />

          <input
            ref={
              fileInputRef
            }
            type="file"
            multiple
            hidden
            onChange={
              handleFiles
            }
          />

          {selectedFiles.length >
            0 && (
            <p className="story-file-status">
              {
                selectedFiles.length
              }{" "}
              {selectedFiles.length ===
              1
                ? "file selected"
                : "files selected"}
            </p>
          )}

          <div className="story-actions">
            <button
              type="button"
              className="story-secondary"
              onClick={
                openFilePicker
              }
            >
              <span>
                ＋
              </span>
              Add file
            </button>

            <button
              type="button"
              className="story-primary"
              onClick={
                startMatter
              }
            >
              Start matter
              <span>
                →
              </span>
            </button>
          </div>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <h2>
              Your matters
            </h2>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/matters"
                )
              }
            >
              View all
            </button>
          </div>

          {mattersLoading ? (
            <article className="matter-preview-card">
              <p>
                Loading your
                latest matter...
              </p>
            </article>
          ) : latestMatter ? (
            <article className="matter-preview-card">
              <div className="matter-preview-top">
                <span className="matter-category">
                  {latestMatter.involvedType ||
                    "Matter"}
                </span>

                <span className="matter-status">
                  {latestMatter.status ===
                  "closed"
                    ? "Closed"
                    : "In progress"}
                </span>
              </div>

              <h3>
                {getMatterTitle()}
              </h3>

              <p>
                {getMatterPreview()}
              </p>

              <div className="matter-footer">
                <span>
                  {nextAction
                    ? `Next: ${nextAction.title}`
                    : "No outstanding steps"}
                </span>

                <button
                  type="button"
                  onClick={
                    openLatestMatter
                  }
                >
                  Continue →
                </button>
              </div>
            </article>
          ) : (
            <article className="matter-preview-card">
              <div className="matter-preview-top">
                <span className="matter-category">
                  Matter
                </span>

                <span className="matter-status">
                  None yet
                </span>
              </div>

              <h3>
                No saved matters
              </h3>

              <p>
                Start a matter
                above, or open My
                Matters to review
                saved matters.
              </p>

              <div className="matter-footer">
                <span>
                  Verdict
                </span>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/matters"
                    )
                  }
                >
                  My Matters →
                </button>
              </div>
            </article>
          )}
        </section>

        <section className="home-section upcoming-section">
          <div className="section-heading">
            <h2>
              Upcoming
            </h2>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/calendar"
                )
              }
            >
              Calendar
            </button>
          </div>

          {upcomingEvent ? (
            <article className="upcoming-card">
              <div className="date-box">
                <span>
                  {new Date(
                    `${upcomingEvent.event_date}T00:00:00`
                  ).getDate()}
                </span>

                <small>
                  {new Date(
                    `${upcomingEvent.event_date}T00:00:00`
                  )
                    .toLocaleString(
                      "en-ZA",
                      {
                        month:
                          "short",
                      }
                    )
                    .toUpperCase()}
                </small>
              </div>

              <div className="upcoming-copy">
                <h3>
                  {
                    upcomingEvent.title
                  }
                </h3>

                <p>
                  {upcomingEvent.event_type ||
                    "Reminder"}

                  {upcomingEvent.event_time
                    ? ` · ${upcomingEvent.event_time.slice(
                        0,
                        5
                      )}`
                    : ""}
                </p>
              </div>

              <button
                className="upcoming-arrow"
                type="button"
                onClick={() =>
                  navigate(
                    "/calendar"
                  )
                }
                aria-label="Open calendar"
              >
                →
              </button>
            </article>
          ) : (
            <article className="upcoming-card">
              <div className="date-box">
                <span>
                  ✓
                </span>

                <small>
                  CLEAR
                </small>
              </div>

              <div className="upcoming-copy">
                <h3>
                  Nothing upcoming
                </h3>

                <p>
                  Add reminders,
                  appointments or
                  follow-ups to your
                  calendar.
                </p>
              </div>

              <button
                className="upcoming-arrow"
                type="button"
                onClick={() =>
                  navigate(
                    "/calendar"
                  )
                }
                aria-label="Open calendar"
              >
                →
              </button>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}

export default Home;
