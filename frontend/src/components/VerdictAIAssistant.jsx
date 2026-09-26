import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useVerdictAI,
} from "../context/VerdictAIContext";

import "../styles/verdictAI.css";

const HIDDEN_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/terms/full",
  "/privacy",
  "/verdict-ai",
]);

const MAX_ATTACHMENT_SIZE =
  10 * 1024 * 1024;

function isImageFile(file) {
  return Boolean(
    file?.type?.startsWith("image/")
  );
}

function VerdictAIAssistant() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    conversation,
    loading,
    sendQuestion,
  } = useVerdictAI();

  const [open, setOpen] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    attachment,
    setAttachment,
  ] = useState(null);

  const [
    attachmentPreview,
    setAttachmentPreview,
  ] = useState("");

  const [
    attachmentError,
    setAttachmentError,
  ] = useState("");

  const conversationEndRef =
    useRef(null);

  const fileInputRef =
    useRef(null);

  const hidden =
    HIDDEN_PATHS.has(
      location.pathname
    );

  useEffect(() => {
    if (hidden) {
      setOpen(false);
    }
  }, [hidden]);

  useEffect(() => {
    if (open) {
      conversationEndRef.current
        ?.scrollIntoView({
          behavior: "smooth",
        });
    }
  }, [
    conversation,
    loading,
    open,
  ]);

  useEffect(() => {
    return () => {
      if (attachmentPreview) {
        URL.revokeObjectURL(
          attachmentPreview
        );
      }
    };
  }, [attachmentPreview]);

  function clearAttachment() {
    if (attachmentPreview) {
      URL.revokeObjectURL(
        attachmentPreview
      );
    }

    setAttachment(null);
    setAttachmentPreview("");
    setAttachmentError("");
  }

  function setSelectedFile(file) {
    if (!file) {
      return;
    }

    if (
      file.size >
      MAX_ATTACHMENT_SIZE
    ) {
      setAttachmentError(
        "Please choose a file smaller than 10 MB."
      );
      return;
    }

    if (attachmentPreview) {
      URL.revokeObjectURL(
        attachmentPreview
      );
    }

    setAttachmentError("");
    setAttachment(file);

    if (isImageFile(file)) {
      setAttachmentPreview(
        URL.createObjectURL(file)
      );
    } else {
      setAttachmentPreview("");
    }
  }

  function chooseAttachment() {
    if (!loading) {
      fileInputRef.current?.click();
    }
  }

  function handleAttachment(event) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    setSelectedFile(file);
  }

  function handlePaste(event) {
    if (loading) {
      return;
    }

    const items =
      Array.from(
        event.clipboardData?.items ||
          []
      );

    const imageItem =
      items.find(
        (item) =>
          item.kind === "file" &&
          item.type.startsWith(
            "image/"
          )
      );

    if (!imageItem) {
      return;
    }

    const file =
      imageItem.getAsFile();

    if (!file) {
      return;
    }

    event.preventDefault();

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type ===
            "image/jpeg"
          ? "jpg"
          : file.type ===
              "image/webp"
            ? "webp"
            : "image";

    const pastedFile =
      new File(
        [file],
        `pasted-image-${Date.now()}.${extension}`,
        {
          type: file.type,
        }
      );

    setSelectedFile(
      pastedFile
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanMessage =
      message.trim();

    if (
      (!cleanMessage &&
        !attachment) ||
      loading
    ) {
      return;
    }

    const currentAttachment =
      attachment;

    setMessage("");
    setAttachment(null);
    setAttachmentPreview("");
    setAttachmentError("");

    await sendQuestion(
      cleanMessage ||
        "Please review the attached file and explain what may be relevant.",
      currentAttachment
    );
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        (
          message.trim() ||
          attachment
        ) &&
        !loading
      ) {
        handleSubmit(event);
      }
    }
  }

  if (hidden) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="verdict-ai-floating-button"
        aria-label="Open Verdict AI"
        onClick={() =>
          setOpen(true)
        }
      >
        V
      </button>

      {open && (
        <div
          className="verdict-ai-panel-backdrop"
          onClick={() =>
            setOpen(false)
          }
        />
      )}

      <aside
        className={`verdict-ai-side-panel ${
          open ? "open" : ""
        }`}
        aria-hidden={!open}
      >
        <header className="verdict-ai-panel-header">
          <div>
            <span>
              Verdict AI
            </span>

            <small>
              Legal preparation
              assistant
            </small>
          </div>

          <button
            type="button"
            aria-label="Close Verdict AI"
            onClick={() =>
              setOpen(false)
            }
          >
            ×
          </button>
        </header>

        <div className="verdict-ai-panel-conversation">
          {conversation.length ===
          0 ? (
            <div className="verdict-ai-simple-empty">
              <div>V</div>

              <h3>
                How can I help?
              </h3>

              <p>
                Ask a
                legal-preparation
                question or attach
                a document or
                image.
              </p>
            </div>
          ) : (
            conversation.map(
              (item) => (
                <article
                  key={item.id}
                  className={`verdict-ai-bubble ${item.role}`}
                >
                  <span>
                    {item.role ===
                    "user"
                      ? "You"
                      : "Verdict AI"}
                  </span>

                  <p>
                    {item.text}
                  </p>

                  {item.attachmentName && (
                    <small className="verdict-ai-message-attachment">
                      📎{" "}
                      {
                        item.attachmentName
                      }
                    </small>
                  )}
                </article>
              )
            )
          )}

          {loading && (
            <article className="verdict-ai-bubble assistant">
              <span>
                Verdict AI
              </span>

              <p>
                Checking verified
                guidance...
              </p>
            </article>
          )}

          <div
            ref={
              conversationEndRef
            }
          />
        </div>

        <div className="verdict-ai-panel-bottom">

          {attachment && (
            <div
              style={{
                marginBottom: "10px",
              }}
            >
              {attachmentPreview && (
                <div
                  style={{
                    position:
                      "relative",
                    width: "100%",
                    maxHeight:
                      "180px",
                    overflow:
                      "hidden",
                    borderRadius:
                      "14px",
                    marginBottom:
                      "8px",
                    border:
                      "1px solid rgba(0,0,0,0.12)",
                    background:
                      "#f6f5f0",
                  }}
                >
                  <img
                    src={
                      attachmentPreview
                    }
                    alt="Selected attachment preview"
                    style={{
                      display:
                        "block",
                      width: "100%",
                      maxHeight:
                        "180px",
                      objectFit:
                        "contain",
                    }}
                  />
                </div>
              )}

              <div className="verdict-ai-attachment-chip">
                <span>
                  📎{" "}
                  {
                    attachment.name
                  }
                </span>

                <button
                  type="button"
                  onClick={
                    clearAttachment
                  }
                  disabled={
                    loading
                  }
                  aria-label="Remove attachment"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {attachmentError && (
            <p className="verdict-ai-attachment-error">
              {
                attachmentError
              }
            </p>
          )}

          <form
            className="verdict-ai-simple-composer"
            onSubmit={
              handleSubmit
            }
          >
            <input
              ref={
                fileInputRef
              }
              type="file"
              hidden
              accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx"
              onChange={
                handleAttachment
              }
            />

            <button
              type="button"
              className="verdict-ai-attach-button"
              onClick={
                chooseAttachment
              }
              disabled={
                loading
              }
              aria-label="Attach file or image"
              title="Attach file or image"
            >
              📎
            </button>

            <textarea
              value={message}
              onChange={(
                event
              ) =>
                setMessage(
                  event.target
                    .value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              onPaste={
                handlePaste
              }
              placeholder="Ask Verdict AI... Paste an image with Ctrl+V"
              rows="2"
              disabled={
                loading
              }
            />

            <button
              type="submit"
              disabled={
                (
                  !message.trim() &&
                  !attachment
                ) ||
                loading
              }
              aria-label="Send message"
            >
              →
            </button>
          </form>

          <p
            className="verdict-ai-upload-note"
            style={{
              color:
                "#556365",
              opacity: 1,
              lineHeight: 1.5,
            }}
          >
            Only upload documents
            you are comfortable
            using for this matter.
            Verdict uses
            attachments only to
            help explain relevant
            information and
            guidance.
          </p>

          <button
            type="button"
            className="verdict-ai-open-full"
            onClick={() => {
              setOpen(false);

              navigate(
                "/verdict-ai"
              );
            }}
          >
            Open full chat
          </button>

          <div className="verdict-ai-mini-disclaimer">
            <strong>
              Verdict AI is a
              legal preparation
              tool.
            </strong>

            <p>
              It does not act as
              your lawyer,
              represent you or
              guarantee an
              outcome. Important
              legal rights,
              procedures and
              deadlines should
              be checked against
              reliable official
              sources or a
              qualified legal
              professional.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

export default VerdictAIAssistant;