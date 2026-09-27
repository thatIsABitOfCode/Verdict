import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import { useMatter } from "../context/useMatter";
import { deleteMatterAndRelatedData } from "../utils/deleteMatter";
import "../styles/myMatters.css";

function formatStatus(status) {
  if (status === "closed") {
    return "Closed";
  }

  return "In progress";
}

function formatUpdated(dateValue) {
  if (!dateValue) {
    return "Updated recently";
  }

  const updatedDate =
    new Date(dateValue);

  const today =
    new Date();

  const isToday =
    updatedDate.toDateString() ===
    today.toDateString();

  if (isToday) {
    return "Updated today";
  }

  return `Updated ${updatedDate.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  )}`;
}

function buildTitle(matter) {
  if (matter.title?.trim()) {
    return matter.title.trim();
  }

  const party =
    matter.involved_type;

  if (party) {
    return `${party} matter`;
  }

  return "Legal matter";
}

function buildCategory(matter) {
  switch (matter.involved_type) {
    case "Landlord":
      return "Housing";

    case "Employer":
      return "Employment";

    case "Government body":
      return "Public services";

    case "Company":
      return "Consumer";

    case "Person":
      return "Personal dispute";

    default:
      return "Legal matter";
  }
}

function buildNextStep() {
  return "Review your matter";
}

function MyMatters() {
  const navigate =
    useNavigate();

  const {
    setMatter: saveMatter,
  } = useMatter();

  const [
    activeFilter,
    setActiveFilter,
  ] = useState("All");

  const [
    matters,
    setMatters,
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
    deletingMatterId,
    setDeletingMatterId,
  ] = useState(null);

  const [
    pendingDeleteMatter,
    setPendingDeleteMatter,
  ] = useState(null);

  const [
    managementError,
    setManagementError,
  ] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadMatters() {
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
            mattersError,
        } =
          await supabase
            .from("matters")
            .select(
              `
                id,
                title,
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
                ascending:
                  false,
              }
            );

        if (mattersError) {
          throw mattersError;
        }

        if (!mounted) {
          return;
        }

        setMatters(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load matters:",
          loadError
        );

        if (!mounted) {
          return;
        }

        setError(
          "We couldn't load your matters right now. Please try again."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadMatters();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredMatters =
    useMemo(() => {
      if (
        activeFilter === "All"
      ) {
        return matters;
      }

      return matters.filter(
        (matter) =>
          formatStatus(
            matter.status
          ) === activeFilter
      );
    }, [
      matters,
      activeFilter,
    ]);

  function buildMatterData(databaseMatter) {
    return {
      id: databaseMatter.id,
      story: databaseMatter.story || "",
      date: databaseMatter.incident_date || "",
      unsureDate: Boolean(databaseMatter.unsure_date),
      involvedType: databaseMatter.involved_type || "",
      involvedName: databaseMatter.involved_name || "",
      files: [],
      timeline: [],
      status: databaseMatter.status,
      createdAt: databaseMatter.created_at,
      updatedAt: databaseMatter.updated_at,
    };
  }

  function editMatter(databaseMatter) {
    const matterData = buildMatterData(databaseMatter);

    saveMatter(matterData);

    navigate(
      `/matters/${encodeURIComponent(databaseMatter.id)}/edit`,
      {
        state: {
          matter: matterData,
        },
      }
    );
  }

  function requestDeleteMatter(databaseMatter) {
    if (deletingMatterId) {
      return;
    }

    setManagementError("");
    setPendingDeleteMatter(databaseMatter);
  }

  function closeDeleteModal() {
    if (deletingMatterId) {
      return;
    }

    setPendingDeleteMatter(null);
  }

  async function confirmDeleteMatter() {
    if (
      !pendingDeleteMatter?.id ||
      deletingMatterId
    ) {
      return;
    }

    const databaseMatter =
      pendingDeleteMatter;

    setManagementError("");
    setDeletingMatterId(databaseMatter.id);

    try {
      await deleteMatterAndRelatedData(databaseMatter.id);

      setMatters((currentMatters) =>
        currentMatters.filter(
          (currentMatter) =>
            currentMatter.id !== databaseMatter.id
        )
      );

      const currentMatterId =
        sessionStorage.getItem(
          "verdictCurrentMatterId"
        );

      if (
        currentMatterId ===
        String(databaseMatter.id)
      ) {
        sessionStorage.removeItem(
          "verdictCurrentMatterId"
        );
      }

      setPendingDeleteMatter(null);
    } catch (deleteError) {
      console.error(
        "Unable to delete matter:",
        deleteError
      );

      setManagementError(
        deleteError?.message ||
          "We couldn't delete this matter right now. Please try again."
      );
    } finally {
      setDeletingMatterId(null);
    }
  }

  function openMatter(
    databaseMatter
  ) {
    const matterData =
      buildMatterData(
        databaseMatter
      );

    saveMatter(
      matterData
    );

    navigate(
     `/matters/${encodeURIComponent(databaseMatter.id)}`,
      {
        state: {
          matter:
            matterData,
        },
      }
    );
  }

  return (
    <main className="my-matters-page">
      <section className="my-matters-shell">
        <header className="my-matters-header">
          <button
            type="button"
            className="my-matters-back"
            onClick={() =>
              navigate("/home")
            }
            aria-label="Go back home"
          >
            ←
          </button>

          <span className="my-matters-wordmark">
            VERDICT
          </span>

          <button
            type="button"
            className="new-matter-small"
            onClick={() =>
              navigate(
                "/matters/new"
              )
            }
            aria-label="Start new matter"
          >
            +
          </button>
        </header>

        <section className="my-matters-title">
          <span className="my-matters-eyebrow">
            Your matters
          </span>

          <h1>
            My Matters
          </h1>

          <p>
            Keep track of your
            legal matters and
            continue where you
            left off.
          </p>
        </section>

        <section className="matters-toolbar">
          <div className="matter-filter-group">
            {[
              "All",
              "In progress",
              "Closed",
            ].map(
              (filter) => (
                <button
                  key={filter}
                  type="button"
                  className={
                    activeFilter ===
                    filter
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveFilter(
                      filter
                    )
                  }
                >
                  {filter}
                </button>
              )
            )}
          </div>
        </section>

        {managementError && (
          <div
            className="auth-error"
            role="alert"
            style={{ marginBottom: "16px" }}
          >
            {managementError}
          </div>
        )}

        {loading ? (
          <section className="no-matters-state">
            <div className="no-matters-icon">
              V
            </div>

            <h2>
              Loading your
              matters...
            </h2>

            <p>
              Verdict is securely
              retrieving your
              saved matters.
            </p>
          </section>
        ) : error ? (
          <section className="no-matters-state">
            <div className="no-matters-icon">
              !
            </div>

            <h2>
              Couldn't load
              matters
            </h2>

            <p>
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                window.location
                  .reload()
              }
            >
              Try again
              <span>→</span>
            </button>
          </section>
        ) : filteredMatters.length ===
          0 ? (
          <section className="no-matters-state">
            <div className="no-matters-icon">
              +
            </div>

            <h2>
              {activeFilter ===
              "Closed"
                ? "No closed matters"
                : activeFilter ===
                    "In progress"
                  ? "No matters in progress"
                  : "No matters yet"}
            </h2>

            <p>
              {activeFilter ===
              "Closed"
                ? "Your closed matters will appear here."
                : activeFilter ===
                    "In progress"
                  ? "Your active matters will appear here."
                  : "Start by telling Verdict what happened."}
            </p>

            {activeFilter !==
              "Closed" && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/matters/new"
                  )
                }
              >
                Start a matter
                <span>→</span>
              </button>
            )}
          </section>
        ) : (
          <section className="matters-list">
            {filteredMatters.map(
              (matter) => (
                <article
                  className="matter-list-card"
                  key={
                    matter.id
                  }
                >
                  <div className="matter-list-top">
                    <span className="matter-list-category">
                      {buildCategory(
                        matter
                      )}
                    </span>

                    <span className="matter-list-status">
                      {formatStatus(
                        matter.status
                      )}
                    </span>
                  </div>

                  <h2>
                    {buildTitle(
                      matter
                    )}
                  </h2>

                  <p className="matter-list-next">
                    Next step:{" "}
                    {buildNextStep()}
                  </p>

                  <div className="matter-list-footer">
                    <span>
                      {formatUpdated(
                        matter.updated_at
                      )}
                    </span>

                    <div className="matter-list-actions">
                      <button
                        type="button"
                        className="matter-action-edit"
                        onClick={() =>
                          editMatter(matter)
                        }
                        disabled={Boolean(
                          deletingMatterId
                        )}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="matter-action-delete"
                        onClick={() =>
                          requestDeleteMatter(
                            matter
                          )
                        }
                        disabled={Boolean(
                          deletingMatterId
                        )}
                      >
                        {deletingMatterId ===
                        matter.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>

                      <button
                        type="button"
                        className="matter-action-continue"
                        onClick={() =>
                          openMatter(
                            matter
                          )
                        }
                        disabled={Boolean(
                          deletingMatterId
                        )}
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                </article>
              )
            )}
          </section>
        )}

        <button
          type="button"
          className="new-matter-button"
          onClick={() =>
            navigate(
              "/matters/new"
            )
          }
        >
          Start new matter
          <span>＋</span>
        </button>
      </section>

      {pendingDeleteMatter && (
        <div
          className="matter-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDeleteModal();
            }
          }}
        >
          <section
            className="matter-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="matter-delete-title"
            aria-describedby="matter-delete-description"
          >
            <div className="matter-delete-icon">
              !
            </div>

            <div className="matter-delete-copy">
              <span className="matter-delete-eyebrow">
                Delete matter
              </span>

              <h2 id="matter-delete-title">
                Delete{" "}
                “{buildTitle(
                  pendingDeleteMatter
                )}”?
              </h2>

              <p id="matter-delete-description">
                This will permanently
                delete this matter and
                its linked evidence,
                timeline events,
                journey actions,
                issue tags and
                reminders.
              </p>

              <strong>
                This cannot be undone.
              </strong>
            </div>

            <div className="matter-delete-modal-actions">
              <button
                type="button"
                className="matter-delete-cancel"
                onClick={
                  closeDeleteModal
                }
                disabled={Boolean(
                  deletingMatterId
                )}
              >
                Cancel
              </button>

              <button
                type="button"
                className="matter-delete-confirm"
                onClick={
                  confirmDeleteMatter
                }
                disabled={Boolean(
                  deletingMatterId
                )}
              >
                {deletingMatterId ===
                pendingDeleteMatter.id
                  ? "Deleting..."
                  : "Delete matter"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default MyMatters;