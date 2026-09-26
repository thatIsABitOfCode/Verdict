import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMatter } from "../context/useMatter";
import { supabase } from "../lib/supabaseClient";
import "../styles/startMatter.css";

const PARTY_TYPES = [
  "Person",
  "Employer",
  "Landlord",
  "Company",
  "Government body",
  "Other",
];

function StartMatter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { matterId } = useParams();

  const isEditMode = Boolean(matterId);
  const totalSteps = isEditMode ? 3 : 4;

  const {
    setMatter: saveMatter,
  } = useMatter();

  const [step, setStep] =
    useState(1);

  const [loading, setLoading] =
    useState(false);

  const [initialLoading, setInitialLoading] =
    useState(isEditMode);

  const [error, setError] =
    useState("");

  const [matter, setMatter] =
    useState({
      id: null,
      story: "",
      date: "",
      unsureDate: false,
      involvedType: "",
      involvedName: "",
      files: [],
      timeline: [],
      status: "in_progress",
      createdAt: null,
      updatedAt: null,
    });

  useEffect(() => {
    let mounted = true;

    async function loadMatterForEditing() {
      if (!isEditMode) {
        setInitialLoading(false);
        return;
      }

      setInitialLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Your session could not be verified. Please sign in again."
          );
        }

        const routeMatter = location.state?.matter;

        if (
          routeMatter?.id &&
          String(routeMatter.id) === String(matterId)
        ) {
          setMatter((current) => ({
            ...current,
            ...routeMatter,
            id: routeMatter.id,
            files: Array.isArray(routeMatter.files)
              ? routeMatter.files
              : [],
            timeline: Array.isArray(routeMatter.timeline)
              ? routeMatter.timeline
              : [],
          }));
        }

        const { data: row, error: matterError } = await supabase
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
          .eq("id", matterId)
          .eq("user_id", user.id)
          .single();

        if (matterError) {
          throw matterError;
        }

        if (!mounted) {
          return;
        }

        setMatter({
          id: row.id,
          story: row.story || "",
          date: row.incident_date || "",
          unsureDate: Boolean(row.unsure_date),
          involvedType: row.involved_type || "",
          involvedName: row.involved_name || "",
          files: [],
          timeline: [],
          status: row.status || "in_progress",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch (loadError) {
        console.error(
          "Unable to load matter for editing:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load this matter for editing. Please return to My Matters and try again."
          );
        }
      } finally {
        if (mounted) {
          setInitialLoading(false);
        }
      }
    }

    loadMatterForEditing();

    return () => {
      mounted = false;
    };
  }, [
    isEditMode,
    matterId,
    location.state,
  ]);

  function updateMatter(
    field,
    value
  ) {
    setMatter((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  async function nextStep() {
    if (step < totalSteps) {
      setStep(
        (current) =>
          current + 1
      );

      window.scrollTo(0, 0);
      return;
    }

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const {
        data: {
          user,
        },
        error: userError,
      } =
        await supabase.auth
          .getUser();

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "Your session could not be verified. Please sign in again."
        );
      }

      const payload = {
        story: matter.story.trim(),
        incident_date: matter.unsureDate
          ? null
          : matter.date || null,
        unsure_date: matter.unsureDate,
        involved_type: matter.involvedType,
        involved_name:
          matter.involvedName.trim() || null,
      };

      let savedRow = null;

      if (isEditMode) {
        const { data: updatedMatter, error: matterError } =
          await supabase
            .from("matters")
            .update({
              ...payload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", matterId)
            .eq("user_id", user.id)
            .select()
            .single();

        if (matterError) {
          throw matterError;
        }

        savedRow = updatedMatter;
      } else {
        const { data: createdMatter, error: matterError } =
          await supabase
            .from("matters")
            .insert({
              user_id: user.id,
              ...payload,
              status: "in_progress",
            })
            .select()
            .single();

        if (matterError) {
          throw matterError;
        }

        savedRow = createdMatter;
      }

      if (!savedRow) {
        throw new Error(
          isEditMode
            ? "Verdict could not update the matter."
            : "Verdict could not create the matter."
        );
      }

      const savedMatter = {
        id: savedRow.id,
        story: savedRow.story,
        date: savedRow.incident_date || "",
        unsureDate: Boolean(savedRow.unsure_date),
        involvedType: savedRow.involved_type || "",
        involvedName: savedRow.involved_name || "",
        files: isEditMode ? [] : matter.files,
        timeline: [],
        status: savedRow.status || matter.status || "in_progress",
        createdAt: savedRow.created_at || matter.createdAt,
        updatedAt: savedRow.updated_at || new Date().toISOString(),
      };

      saveMatter(savedMatter);

      navigate(
        "/matters/new/overview",
        {
          state: {
            matter:
              savedMatter,
          },
        }
      );
    } catch (
      creationError
    ) {
      console.error(
        "Unable to create matter:",
        creationError
      );

      const message =
        creationError
          ?.message
          ?.toLowerCase() ||
        "";

      if (
        message.includes(
          "session"
        )
      ) {
        setError(
          "Your session has expired. Please sign in again."
        );
      } else if (
        message.includes(
          "network"
        ) ||
        message.includes(
          "fetch"
        )
      ) {
        setError(
          "Verdict could not connect right now. Check your internet connection and try again."
        );
      } else {
        setError(
          isEditMode
            ? "We couldn't save your changes. Your information is still on this screen, so you can try again."
            : "We couldn't create your matter. Your information is still on this screen, so you can try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function previousStep() {
    if (loading) {
      return;
    }

    if (step === 1) {
      if (isEditMode) {
        navigate("/matters");
      } else {
        navigate("/home");
      }
      return;
    }

    setStep(
      (current) =>
        current - 1
    );

    window.scrollTo(0, 0);
  }

  function handleFiles(event) {
    const selectedFiles =
      Array.from(
        event.target.files ||
          []
      );

    if (
      selectedFiles.length ===
      0
    ) {
      return;
    }

    updateMatter(
      "files",
      [
        ...matter.files,
        ...selectedFiles,
      ]
    );

    /*
      Reset the input so selecting
      the same file again later
      still triggers onChange.
    */
    event.target.value = "";
  }

  const canContinue =
    step === 1
      ? matter.story
          .trim()
          .length >= 10
      : step === 2
        ? matter.unsureDate ||
          Boolean(matter.date)
        : step === 3
          ? Boolean(
              matter.involvedType
            )
          : true;

  if (initialLoading) {
    return (
      <main className="start-matter-page">
        <section className="start-matter-shell">
          <div
            className="matter-step"
            style={{ paddingTop: "48px" }}
          >
            <div className="step-heading">
              <span className="step-eyebrow">
                Your matter
              </span>

              <h1>Loading matter...</h1>

              <p>
                Verdict is retrieving your saved information.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="start-matter-page">
      <section className="start-matter-shell">
        <header className="matter-header">
          <button
            type="button"
            className="matter-back"
            onClick={previousStep}
            disabled={loading}
            aria-label="Go back"
          >
            ←
          </button>

          <span className="matter-wordmark">
            VERDICT
          </span>

          <button
            type="button"
            className="matter-close"
            onClick={() =>
              navigate(
                isEditMode
                  ? "/matters"
                  : "/home"
              )
            }
            disabled={loading}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="matter-progress">
          <div className="progress-copy">
            <span>
              Step {step} of{" "}
              {totalSteps}
            </span>

            <span>
              {Math.round(
                (step /
                  totalSteps) *
                  100
              )}
              %
            </span>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${
                  (step /
                    totalSteps) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        <section className="matter-step">
          {step === 1 && (
            <>
              <div className="step-heading">
                <span className="step-eyebrow">
                  Your situation
                </span>

                <h1>
                  {isEditMode
                    ? "Update what happened"
                    : "What happened?"}
                </h1>

                <p>
                  Tell us in your
                  own words. You
                  don't need to
                  know the legal
                  terms.
                </p>
              </div>

              <div className="story-input-card">
                <textarea
                  value={
                    matter.story
                  }
                  onChange={(
                    event
                  ) =>
                    updateMatter(
                      "story",
                      event.target
                        .value
                    )
                  }
                  placeholder="For example: I moved out of my apartment three weeks ago and my landlord still hasn't returned my deposit..."
                  autoFocus
                  disabled={loading}
                />

                <div className="story-input-footer">
                  <span>
                    {
                      matter.story
                        .length
                    }{" "}
                    characters
                  </span>

                  <span className="private-note">
                    Private
                  </span>
                </div>
              </div>

              <div className="matter-tip">
                <span>i</span>

                <p>
                  Include the
                  important events
                  you remember. You
                  can add more
                  information later.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="step-heading">
                <span className="step-eyebrow">
                  Timing
                </span>

                <h1>
                  When did this
                  happen?
                </h1>

                <p>
                  An approximate
                  date is okay.
                  Verdict can help
                  organise
                  additional dates
                  later.
                </p>
              </div>

              <label className="date-field">
                <span>
                  Date
                </span>

                <input
                  type="date"
                  value={
                    matter.date
                  }
                  disabled={
                    matter.unsureDate ||
                    loading
                  }
                  onChange={(
                    event
                  ) =>
                    updateMatter(
                      "date",
                      event.target
                        .value
                    )
                  }
                />
              </label>

              <label className="unsure-option">
                <input
                  type="checkbox"
                  checked={
                    matter.unsureDate
                  }
                  disabled={loading}
                  onChange={(
                    event
                  ) => {
                    const checked =
                      event.target
                        .checked;

                    setMatter(
                      (current) => ({
                        ...current,
                        unsureDate:
                          checked,
                        date:
                          checked
                            ? ""
                            : current.date,
                      })
                    );

                    setError("");
                  }}
                />

                <div>
                  <strong>
                    I'm not sure of
                    the date
                  </strong>

                  <p>
                    You can add or
                    correct it
                    later.
                  </p>
                </div>
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <div className="step-heading">
                <span className="step-eyebrow">
                  People involved
                </span>

                <h1>
                  Who is involved?
                </h1>

                <p>
                  Choose the option
                  that best
                  describes the
                  other party.
                </p>
              </div>

              <div className="party-options">
                {PARTY_TYPES.map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={
                        loading
                      }
                      className={
                        matter.involvedType ===
                        type
                          ? "party-option selected"
                          : "party-option"
                      }
                      onClick={() =>
                        updateMatter(
                          "involvedType",
                          type
                        )
                      }
                    >
                      <span>
                        {type}
                      </span>

                      <span className="selection-circle">
                        {matter.involvedType ===
                        type
                          ? "✓"
                          : ""}
                      </span>
                    </button>
                  )
                )}
              </div>

              {matter.involvedType && (
                <label className="party-name-field">
                  <span>
                    Name{" "}
                    <small>
                      (optional)
                    </small>
                  </span>

                  <input
                    type="text"
                    value={
                      matter.involvedName
                    }
                    disabled={
                      loading
                    }
                    onChange={(
                      event
                    ) =>
                      updateMatter(
                        "involvedName",
                        event.target
                          .value
                      )
                    }
                    placeholder={
                      matter.involvedType ===
                      "Government body"
                        ? "Department or organisation"
                        : "Name"
                    }
                  />
                </label>
              )}
            </>
          )}

          {!isEditMode &&
            step === 4 && (
            <>
              <div className="step-heading">
                <span className="step-eyebrow">
                  Supporting
                  information
                </span>

                <h1>
                  Do you have
                  anything to add?
                </h1>

                <p>
                  Add documents,
                  screenshots or
                  photos you
                  already have.
                  You can also do
                  this later.
                </p>
              </div>

              <label className="upload-area">
                <input
                  type="file"
                  multiple
                  hidden
                  disabled={loading}
                  onChange={
                    handleFiles
                  }
                />

                <div className="upload-icon">
                  +
                </div>

                <strong>
                  Add evidence
                </strong>

                <p>
                  Documents,
                  screenshots or
                  photos
                </p>

                <span>
                  Choose files
                </span>
              </label>

              {matter.files.length >
                0 && (
                <div className="selected-files">
                  <div className="selected-files-heading">
                    <span>
                      Added
                    </span>

                    <span>
                      {
                        matter.files
                          .length
                      }{" "}
                      {matter.files
                        .length === 1
                        ? "file"
                        : "files"}
                    </span>
                  </div>

                  {matter.files.map(
                    (
                      file,
                      index
                    ) => (
                      <div
                        className="selected-file"
                        key={`${file.name}-${index}`}
                      >
                        <div className="file-icon">
                          ✓
                        </div>

                        <div>
                          <strong>
                            {
                              file.name
                            }
                          </strong>

                          <span>
                            {(
                              file.size /
                              1024 /
                              1024
                            ).toFixed(
                              2
                            )}{" "}
                            MB
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="privacy-reminder">
                <strong>
                  Before uploading
                </strong>

                <p>
                  Only add
                  information
                  you're authorised
                  to possess and
                  share.
                </p>
              </div>
            </>
          )}
        </section>

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <footer className="matter-navigation">
          <button
            type="button"
            className="matter-previous"
            onClick={previousStep}
            disabled={loading}
          >
            ← Back
          </button>

          <button
            type="button"
            className="matter-continue"
            disabled={
              !canContinue ||
              loading
            }
            onClick={nextStep}
          >
            {loading
              ? isEditMode
                ? "Saving..."
                : "Creating..."
              : step === totalSteps
                ? isEditMode
                  ? "Save changes"
                  : "Create matter"
                : "Continue"}

            {!loading && (
              <span>→</span>
            )}
          </button>
        </footer>
      </section>
    </main>
  );
}

export default StartMatter;