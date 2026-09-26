import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useMatter } from "../context/useMatter";
import { supabase } from "../lib/supabaseClient";
import "../styles/evidence.css";

const DEFAULT_CHECKLIST = [
  {
    id: 1,
    title:
      "Messages or written communication",
    description:
      "Emails, WhatsApp messages, SMS messages or letters connected to what happened.",
    complete: false,
  },
  {
    id: 2,
    title:
      "Proof of payment or transaction",
    description:
      "Receipts, bank statements, invoices or payment confirmations.",
    complete: false,
  },
  {
    id: 3,
    title:
      "Agreements or official documents",
    description:
      "Contracts, notices, policies, lease agreements or other official documents.",
    complete: false,
  },
  {
    id: 4,
    title:
      "Photos, screenshots or recordings",
    description:
      "Visual or recorded information that may support your version of events.",
    complete: false,
  },
];

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

const ALLOWED_FILE_TYPES =
  new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

const ALLOWED_FILE_EXTENSIONS =
  new Set([
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "webp",
  ]);

function isAllowedEvidenceFile(
  file
) {
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() ||
    "";

  return (
    ALLOWED_FILE_TYPES.has(
      file.type
    ) &&
    ALLOWED_FILE_EXTENSIONS.has(
      extension
    )
  );
}

function safeFileName(name) {
  return name
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    );
}

function mapDatabaseEvidence(
  item
) {
  return {
    id: item.id,
    name:
      item.file_name,
    size:
      Number(
        item.file_size
      ) || 0,
    fileType:
      item.file_type ||
      "",
    storagePath:
      item.storage_path,
    description:
      item.description ||
      "",
    category:
      item.evidence_type ||
      "Uncategorised",
    uploaded: true,
    uploading: false,
    localFile: null,
  };
}

function createLocalEvidence(
  file
) {
  return {
    id:
      crypto.randomUUID(),
    name: file.name,
    size: file.size,
    fileType:
      file.type ||
      "application/octet-stream",
    storagePath: "",
    description: "",
    category:
      "Uncategorised",
    uploaded: false,
    uploading: false,
    localFile: file,
  };
}

function Evidence() {
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

  const [
    initialPendingFiles,
  ] = useState(() =>
    Array.isArray(
      incomingMatter?.files
    )
      ? incomingMatter.files
          .filter(
            (item) =>
              item instanceof
              File
          )
          .map(
            createLocalEvidence
          )
      : []
  );

  const [
    files,
    setFiles,
  ] = useState(
    initialPendingFiles
  );

  const [
    checklist,
    setChecklist,
  ] = useState(() =>
    DEFAULT_CHECKLIST.map(
      (item) => ({
        ...item,
      })
    )
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    uploading,
    setUploading,
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
    integrityByEvidenceId,
    setIntegrityByEvidenceId,
  ] = useState({});

  const [
    integrityBusyId,
    setIntegrityBusyId,
  ] = useState("");

  const pendingProcessed =
    useRef(false);

  const matter = {
    ...incomingMatter,
    files,
  };

  useEffect(() => {
    updateMatter({
      files,
    });
  }, [
    files,
    updateMatter,
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadEvidence() {
      if (
        !incomingMatter?.id
      ) {
        if (mounted) {
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
            evidenceError,
        } =
          await supabase
            .from("evidence")
            .select(
              `
                id,
                file_name,
                storage_path,
                file_type,
                file_size,
                description,
                evidence_type,
                created_at
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
              "created_at",
              {
                ascending:
                  true,
              }
            );

        if (evidenceError) {
          throw evidenceError;
        }

        if (!mounted) {
          return;
        }

        const savedFiles =
          Array.isArray(data)
            ? data.map(
                mapDatabaseEvidence
              )
            : [];

        const {
          data: integrityRows,
          error: integrityLoadError,
        } = await supabase
          .from("evidence_integrity")
          .select(`
            evidence_id,
            hash_algorithm,
            signature_algorithm,
            integrity_status,
            protected_at,
            last_verified_at
          `)
          .eq("matter_id", incomingMatter.id)
          .eq("user_id", user.id);

        if (!integrityLoadError) {
          const nextIntegrity = {};

          for (const row of integrityRows || []) {
            nextIntegrity[row.evidence_id] = {
              evidenceId: row.evidence_id,
              hashAlgorithm: row.hash_algorithm,
              signatureAlgorithm: row.signature_algorithm,
              status: row.integrity_status,
              protectedAt: row.protected_at,
              lastVerifiedAt: row.last_verified_at,
            };
          }

          setIntegrityByEvidenceId(nextIntegrity);
        } else {
          console.warn(
            "Unable to load evidence integrity status:",
            integrityLoadError
          );
        }

        setFiles(
          (current) => [
            ...savedFiles,
            ...current.filter(
              (item) =>
                !item.uploaded
            ),
          ]
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load evidence:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load your evidence right now. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadEvidence();

    return () => {
      mounted = false;
    };
  }, [
    incomingMatter?.id,
  ]);

  const uploadOneFile =
    useCallback(
      async (
        evidenceItem
      ) => {
    if (
      !evidenceItem
        ?.localFile ||
      !incomingMatter?.id
    ) {
      return null;
    }

    const file =
      evidenceItem.localFile;

    if (
      !isAllowedEvidenceFile(
        file
      )
    ) {
      throw new Error(
        `${file.name} is not a supported file type. Use PDF, JPG, JPEG, PNG or WEBP.`
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      throw new Error(
        `${file.name} is larger than the 10 MB upload limit.`
      );
    }

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

    const cleanName =
      safeFileName(
        file.name
      );

    const storagePath =
      `${user.id}/` +
      `${incomingMatter.id}/` +
      `${crypto.randomUUID()}-${cleanName}`;

    setFiles(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            evidenceItem.id
              ? {
                  ...item,
                  uploading:
                    true,
                }
              : item
        )
    );

    const {
      error:
        storageError,
    } =
      await supabase.storage
        .from("evidence")
        .upload(
          storagePath,
          file,
          {
            cacheControl:
              "3600",
            upsert: false,
            contentType:
              file.type ||
              undefined,
          }
        );

    if (storageError) {
      throw storageError;
    }

    const {
      data:
        createdEvidence,
      error:
        databaseError,
    } =
      await supabase
        .from("evidence")
        .insert({
          user_id:
            user.id,
          matter_id:
            incomingMatter.id,
          file_name:
            file.name,
          storage_path:
            storagePath,
          file_type:
            file.type ||
            null,
          file_size:
            file.size,
          description:
            evidenceItem
              .description
              ?.trim() ||
            null,
          evidence_type:
            evidenceItem
              .category ||
            "Uncategorised",
        })
        .select(
          `
            id,
            file_name,
            storage_path,
            file_type,
            file_size,
            description,
            evidence_type,
            created_at
          `
        )
        .single();

    if (databaseError) {
      await supabase.storage
        .from("evidence")
        .remove([
          storagePath,
        ]);

      throw databaseError;
    }

    return {
      oldId:
        evidenceItem.id,
      newItem:
        mapDatabaseEvidence(
          createdEvidence
        ),
    };
      },
      [
        incomingMatter?.id,
      ]
    );

  const uploadFiles =
    useCallback(
      async (
        evidenceItems
      ) => {
    if (
      !evidenceItems.length
    ) {
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");

    let successCount = 0;

    try {
      for (
        const evidenceItem
        of evidenceItems
      ) {
        try {
          const result =
            await uploadOneFile(
              evidenceItem
            );

          if (!result) {
            continue;
          }

          successCount += 1;

          setFiles(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  result.oldId
                    ? result.newItem
                    : item
              )
          );
        } catch (
          uploadError
        ) {
          console.error(
            "Unable to upload evidence:",
            uploadError
          );

          setFiles(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  evidenceItem.id
                    ? {
                        ...item,
                        uploading:
                          false,
                      }
                    : item
              )
          );

          setError(
            uploadError
              ?.message ||
              "One or more files could not be uploaded."
          );
        }
      }

      if (
        successCount > 0
      ) {
        setNotice(
          successCount === 1
            ? "Evidence uploaded securely."
            : `${successCount} files uploaded securely.`
        );
      }
    } finally {
      setUploading(false);
    }
      },
      [
        uploadOneFile,
      ]
    );

  useEffect(() => {
    if (
      loading ||
      pendingProcessed.current ||
      initialPendingFiles.length ===
        0
    ) {
      return;
    }

    pendingProcessed.current =
      true;

    const timeoutId =
      window.setTimeout(() => {
        uploadFiles(
          initialPendingFiles
        );
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    loading,
    initialPendingFiles,
    uploadFiles,
  ]);

  async function handleFiles(
    event
  ) {
    const selectedFiles =
      Array.from(
        event.target.files ||
          []
      );

    event.target.value = "";

    if (
      selectedFiles.length ===
      0
    ) {
      return;
    }

    if (
      !incomingMatter?.id
    ) {
      setError(
        "Save this matter before adding evidence."
      );
      return;
    }

    const unsupported =
      selectedFiles.find(
        (file) =>
          !isAllowedEvidenceFile(
            file
          )
      );

    if (unsupported) {
      setError(
        `${unsupported.name} is not supported. Upload PDF, JPG, JPEG, PNG or WEBP files only.`
      );
      return;
    }

    const oversized =
      selectedFiles.find(
        (file) =>
          file.size >
          MAX_FILE_SIZE
      );

    if (oversized) {
      setError(
        `${oversized.name} is larger than the 10 MB upload limit.`
      );
      return;
    }

    const newFiles =
      selectedFiles.map(
        createLocalEvidence
      );

    setFiles(
      (current) => [
        ...current,
        ...newFiles,
      ]
    );

    await uploadFiles(
      newFiles
    );
  }

  async function removeFile(
    index
  ) {
    const item =
      files[index];

    if (
      !item ||
      item.uploading
    ) {
      return;
    }

    setError("");
    setNotice("");

    if (
      !item.uploaded
    ) {
      setFiles(
        (current) =>
          current.filter(
            (
              _,
              fileIndex
            ) =>
              fileIndex !==
              index
          )
      );

      return;
    }

    try {
      const {
        error:
          storageError,
      } =
        await supabase.storage
          .from("evidence")
          .remove([
            item.storagePath,
          ]);

      if (storageError) {
        throw storageError;
      }

      const {
        error:
          databaseError,
      } =
        await supabase
          .from("evidence")
          .delete()
          .eq(
            "id",
            item.id
          )
          .eq(
            "matter_id",
            incomingMatter.id
          );

      if (databaseError) {
        throw databaseError;
      }

      setFiles(
        (current) =>
          current.filter(
            (
              _,
              fileIndex
            ) =>
              fileIndex !==
              index
          )
      );

      setNotice(
        "Evidence removed."
      );
    } catch (
      deleteError
    ) {
      console.error(
        "Unable to remove evidence:",
        deleteError
      );

      setError(
        "We couldn't remove this evidence right now. Please try again."
      );
    }
  }

  function updateFileLocal(
    index,
    field,
    value
  ) {
    setFiles(
      (current) =>
        current.map(
          (
            item,
            fileIndex
          ) =>
            fileIndex ===
            index
              ? {
                  ...item,
                  [field]:
                    value,
                }
              : item
        )
    );
  }

  async function updateFile(
    index,
    field,
    value
  ) {
    const item =
      files[index];

    updateFileLocal(
      index,
      field,
      value
    );

    if (
      !item?.uploaded
    ) {
      return;
    }

    const databaseField =
      field === "category"
        ? "evidence_type"
        : "description";

    const {
      error:
        updateError,
    } =
      await supabase
        .from("evidence")
        .update({
          [databaseField]:
            value.trim()
              ? value
              : null,
        })
        .eq(
          "id",
          item.id
        )
        .eq(
          "matter_id",
          incomingMatter.id
        );

    if (updateError) {
      console.error(
        "Unable to update evidence:",
        updateError
      );

      setError(
        "One of your evidence changes could not be saved."
      );
    }
  }

  async function getIntegrityAccessToken() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (
      sessionError ||
      !session?.access_token
    ) {
      throw new Error(
        "Your session could not be verified. Please sign in again."
      );
    }

    return session.access_token;
  }

  async function protectIntegrity(item) {
    if (!item?.uploaded || !item?.id) {
      return;
    }

    setIntegrityBusyId(item.id);
    setError("");
    setNotice("");

    try {
      const accessToken =
        await getIntegrityAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/api/evidence-integrity/protect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            evidenceId: item.id,
          }),
        }
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Evidence integrity protection failed."
        );
      }

      setIntegrityByEvidenceId(
        (current) => ({
          ...current,
          [item.id]: payload.integrity,
        })
      );

      setNotice(
        payload.alreadyProtected
          ? "This evidence already has quantum-safe integrity protection."
          : "Evidence integrity protected with SHA-256 and ML-DSA-65."
      );
    } catch (integrityError) {
      console.error(
        "Unable to protect evidence integrity:",
        integrityError
      );

      setError(
        integrityError?.message ||
          "We couldn't protect this evidence right now."
      );
    } finally {
      setIntegrityBusyId("");
    }
  }

  async function verifyIntegrity(item) {
    if (!item?.uploaded || !item?.id) {
      return;
    }

    setIntegrityBusyId(item.id);
    setError("");
    setNotice("");

    try {
      const accessToken =
        await getIntegrityAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/api/evidence-integrity/${encodeURIComponent(
          item.id
        )}/verify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Evidence integrity verification failed."
        );
      }

      setIntegrityByEvidenceId(
        (current) => ({
          ...current,
          [item.id]: payload.integrity,
        })
      );

      if (payload.verified) {
        setNotice(payload.message);
      } else {
        setError(payload.message);
      }
    } catch (integrityError) {
      console.error(
        "Unable to verify evidence integrity:",
        integrityError
      );

      setError(
        integrityError?.message ||
          "We couldn't verify this evidence right now."
      );
    } finally {
      setIntegrityBusyId("");
    }
  }

  function toggleChecklist(
    id
  ) {
    setChecklist(
      (current) =>
        current.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  complete:
                    !item.complete,
                }
              : item
        )
    );
  }

  const completedChecklist =
    checklist.filter(
      (item) =>
        item.complete
    ).length;

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

  return (
    <main className="evidence-page">
      <section className="evidence-shell">
        <header className="evidence-header">
          <button
            type="button"
            className="evidence-back"
            onClick={
              goToOverview
            }
            aria-label="Back to matter overview"
          >
            ←
          </button>

          <span className="evidence-wordmark">
            VERDICT
          </span>

          <span
            className="evidence-more"
            aria-hidden="true"
          />
        </header>

        <section className="evidence-title-section">
          <span className="evidence-eyebrow">
            Your matter
          </span>

          <h1>
            Evidence
          </h1>

          <p>
            Keep the
            information that
            supports your matter
            organised in one
            place.
          </p>
        </section>

        <nav
          className="evidence-tabs"
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
            className="active"
            aria-current="page"
          >
            Evidence
          </button>

          <button
            type="button"
            onClick={
              goToTimeline
            }
          >
            Timeline
          </button>
        </nav>

        <section className="evidence-section">
          <div className="evidence-section-heading">
            <div>
              <span className="section-label">
                Evidence
                checklist
              </span>

              <h2>
                What could help
                support your
                matter?
              </h2>
            </div>

            <span className="checklist-count">
              {
                completedChecklist
              }
              /{checklist.length}
            </span>
          </div>

          <div className="evidence-checklist">
            {checklist.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    item.complete
                      ? "checklist-item complete"
                      : "checklist-item"
                  }
                  onClick={() =>
                    toggleChecklist(
                      item.id
                    )
                  }
                >
                  <div className="check-circle">
                    {item.complete
                      ? "✓"
                      : ""}
                  </div>

                  <div>
                    <strong>
                      {
                        item.title
                      }
                    </strong>

                    <p>
                      {
                        item.description
                      }
                    </p>
                  </div>
                </button>
              )
            )}
          </div>

          <p className="checklist-note">
            You don't need every
            item. This is only a
            guide to help you
            think about useful
            supporting
            information.
          </p>
        </section>

        <section className="evidence-section">
          <div className="evidence-section-heading">
            <div>
              <span className="section-label">
                Your evidence
              </span>

              <h2>
                Files you've
                added
              </h2>
            </div>

            <span className="file-total">
              {files.length}
            </span>
          </div>

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
              className="checklist-note"
              role="status"
            >
              {notice}
            </p>
          )}

          <label className="evidence-upload-box">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              multiple
              hidden
              disabled={
                loading ||
                uploading
              }
              onChange={
                handleFiles
              }
            />

            <div className="evidence-upload-icon">
              +
            </div>

            <div>
              <strong>
                {uploading
                  ? "Uploading..."
                  : "Add evidence"}
              </strong>

              <p>
                PDF documents,
                screenshots and
                photos. JPG, JPEG,
                PNG and WEBP are
                supported. Maximum
                10 MB per file.
              </p>
            </div>

            <span>
              {uploading
                ? "Please wait"
                : "Choose files"}
            </span>
          </label>

          {loading ? (
            <div className="evidence-empty-state">
              <div className="empty-evidence-icon">
                V
              </div>

              <h3>
                Loading evidence
              </h3>

              <p>
                Verdict is
                securely
                retrieving the
                evidence linked
                to this matter.
              </p>
            </div>
          ) : files.length ===
            0 ? (
            <div className="evidence-empty-state">
              <div className="empty-evidence-icon">
                +
              </div>

              <h3>
                No evidence added
                yet
              </h3>

              <p>
                That's okay. You
                can continue
                building your
                matter and add
                evidence whenever
                you have it.
              </p>
            </div>
          ) : (
            <div className="evidence-file-list">
              {files.map(
                (
                  item,
                  index
                ) => {
                  const fileName =
                    item.name ||
                    "File";

                  const fileSize =
                    item.size ||
                    0;

                  return (
                    <article
                      className="evidence-file-card"
                      key={
                        item.id
                      }
                    >
                      <div className="evidence-file-top">
                        <div className="file-mark">
                          {item.uploading
                            ? "…"
                            : "✓"}
                        </div>

                        <div className="file-information">
                          <strong>
                            {
                              fileName
                            }
                          </strong>

                          <span>
                            {(
                              fileSize /
                              1024 /
                              1024
                            ).toFixed(
                              2
                            )}{" "}
                            MB
                            {item.uploading
                              ? " · Uploading"
                              : item.uploaded
                                ? " · Saved"
                                : " · Pending"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="remove-file-button"
                          disabled={
                            item.uploading
                          }
                          onClick={() =>
                            removeFile(
                              index
                            )
                          }
                          aria-label={`Remove ${fileName}`}
                        >
                          ×
                        </button>
                      </div>

                      {item.uploaded && (() => {
                        const integrity =
                          integrityByEvidenceId[item.id];
                        const busy =
                          integrityBusyId === item.id;
                        const isVerified =
                          integrity?.status === "verified";
                        const isChanged =
                          integrity?.status === "changed";

                        return (
                          <div
                            className={`evidence-integrity-panel ${
                              isVerified
                                ? "is-verified"
                                : isChanged
                                  ? "is-changed"
                                  : integrity
                                    ? "is-protected"
                                    : ""
                            }`}
                          >
                            <div className="evidence-integrity-copy">
                              <strong>
                                {isVerified
                                  ? "Integrity verified"
                                  : isChanged
                                    ? "Integrity changed"
                                    : integrity
                                      ? "Quantum-safe integrity protected"
                                      : "Quantum-safe evidence integrity"}
                              </strong>

                              <span>
                                {integrity
                                  ? `${integrity.hashAlgorithm || "SHA-256"} fingerprint · ${integrity.signatureAlgorithm || "ML-DSA-65"} signature`
                                  : "Create a SHA-256 fingerprint and protect it with an ML-DSA-65 post-quantum signature."}
                              </span>

                              {integrity?.lastVerifiedAt && (
                                <small>
                                  Last verified {new Date(
                                    integrity.lastVerifiedAt
                                  ).toLocaleString()}
                                </small>
                              )}
                            </div>

                            <button
                              type="button"
                              className="evidence-integrity-button"
                              disabled={busy}
                              onClick={() =>
                                integrity
                                  ? verifyIntegrity(item)
                                  : protectIntegrity(item)
                              }
                            >
                              {busy
                                ? "Checking…"
                                : integrity
                                  ? "Verify integrity"
                                  : "Protect integrity"}
                            </button>
                          </div>
                        );
                      })()}

                      <label className="evidence-category">
                        <span>
                          Type of
                          evidence
                        </span>

                        <select
                          value={
                            item.category ||
                            "Uncategorised"
                          }
                          disabled={
                            item.uploading
                          }
                          onChange={(
                            event
                          ) =>
                            updateFile(
                              index,
                              "category",
                              event
                                .target
                                .value
                            )
                          }
                        >
                          <option>
                            Uncategorised
                          </option>

                          <option>
                            Message or
                            communication
                          </option>

                          <option>
                            Financial
                            document
                          </option>

                          <option>
                            Agreement or
                            contract
                          </option>

                          <option>
                            Photograph
                          </option>

                          <option>
                            Screenshot
                          </option>

                          <option>
                            Official
                            document
                          </option>

                          <option>
                            Other
                          </option>
                        </select>
                      </label>

                      <label className="evidence-description">
                        <span>
                          What does this
                          help show?
                        </span>

                        <textarea
                          rows="3"
                          value={
                            item.description ||
                            ""
                          }
                          disabled={
                            item.uploading
                          }
                          onChange={(
                            event
                          ) =>
                            updateFile(
                              index,
                              "description",
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="For example: This bank statement shows that I paid the deposit on 3 March."
                        />
                      </label>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section className="evidence-section">
          <article className="evidence-guidance-card">
            <span className="guidance-icon">
              i
            </span>

            <div>
              <h3>
                Keep the
                original
              </h3>

              <p>
                Where possible,
                keep the original
                version of
                important
                evidence. Avoid
                changing
                screenshots,
                photographs or
                documents that
                may later need to
                be verified.
              </p>
            </div>
          </article>
        </section>

        <div className="evidence-bottom-action">
          <button
            type="button"
            disabled={
              uploading
            }
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

export default Evidence;