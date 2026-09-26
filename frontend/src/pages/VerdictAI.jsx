import {

  useEffect,

  useMemo,

  useRef,

  useState,

} from "react";

import {

  useNavigate,

} from "react-router-dom";

import AppHeader from "../components/AppHeader";

import SideMenu from "../components/SideMenu";

import {

  useVerdictAI,

} from "../context/VerdictAIContext";

import "../styles/verdictAI.css";

const SECTION_TITLES =

  new Set([

    "WHAT VERDICT FOUND",

    "WHAT THIS MEANS",

    "POSSIBLE NEXT STEPS",

    "WHERE YOU MAY BE ABLE TO GET HELP",

    "SOURCES USED",

    "IMPORTANT",

  ]);

function isUrl(value) {

  return /^https?:\/\/\S+$/i.test(

    value.trim()

  );

}

function renderInlineText(

  text,

  keyPrefix

) {

  const urlPattern =

    /(https?:\/\/[^\s]+)/g;

  const parts =

    text.split(urlPattern);

  return parts.map(

    (part, index) => {

      if (

        /^https?:\/\/[^\s]+$/i.test(

          part

        )

      ) {

        return (

          <a

            key={`${keyPrefix}-link-${index}`}

            href={part}

            target="_blank"

            rel="noreferrer"

            className="verdict-ai-inline-link"

          >

            Open official source

          </a>

        );

      }

      return (

        <span

          key={`${keyPrefix}-text-${index}`}

        >

          {part}

        </span>

      );

    }

  );

}

function parseAssistantMessage(

  text

) {

  const rawLines =

    text

      .split("\n")

      .map((line) =>

        line.trimEnd()

      );

  const blocks = [];

  let currentSection = null;

  let paragraphBuffer = [];

  function flushParagraphs() {

    if (

      !paragraphBuffer.length

    ) {

      return;

    }

    const content =

      paragraphBuffer

        .join(" ")

        .trim();

    if (content) {

      blocks.push({

        type: "paragraph",

        section:

          currentSection,

        content,

      });

    }

    paragraphBuffer = [];

  }

  rawLines.forEach(

    (rawLine) => {

      const line =

        rawLine.trim();

      if (!line) {

        flushParagraphs();

        return;

      }

      if (

        SECTION_TITLES.has(

          line

        )

      ) {

        flushParagraphs();

        currentSection = line;

        blocks.push({

          type: "heading",

          content: line,

        });

        return;

      }

      if (

        /^\d+\.\s/.test(

          line

        )

      ) {

        flushParagraphs();

        blocks.push({

          type: "numbered",

          section:

            currentSection,

          content:

            line.replace(

              /^\d+\.\s*/,

              ""

            ),

          number:

            line.match(

              /^(\d+)\./

            )?.[1],

        });

        return;

      }

      if (

        /^•\s/.test(line)

      ) {

        flushParagraphs();

        blocks.push({

          type: "bullet",

          section:

            currentSection,

          content:

            line.replace(

              /^•\s*/,

              ""

            ),

        });

        return;

      }

      if (

        isUrl(line)

      ) {

        flushParagraphs();

        blocks.push({

          type: "url",

          section:

            currentSection,

          content: line,

        });

        return;

      }

      if (

        line.startsWith(

          "Official link:"

        )

      ) {

        flushParagraphs();

        const url =

          line.replace(

            "Official link:",

            ""

          )

          .trim();

        blocks.push({

          type: "official-link",

          section:

            currentSection,

          content: url,

        });

        return;

      }

      if (

        line.startsWith(

          "Phone:"

        )

      ) {

        flushParagraphs();

        blocks.push({

          type: "detail",

          section:

            currentSection,

          label: "Phone",

          content:

            line.replace(

              "Phone:",

              ""

            )

            .trim(),

        });

        return;

      }

      if (

        line.startsWith(

          "Email:"

        )

      ) {

        flushParagraphs();

        blocks.push({

          type: "detail",

          section:

            currentSection,

          label: "Email",

          content:

            line.replace(

              "Email:",

              ""

            )

            .trim(),

        });

        return;

      }

      paragraphBuffer.push(

        line

      );

    }

  );

  flushParagraphs();

  return blocks;

}

function AssistantReply({

  text,

}) {

  const blocks =

    useMemo(

      () =>

        parseAssistantMessage(

          text

        ),

      [text]

    );

  return (

    <div className="verdict-ai-rich-response">

      {blocks.map(

        (block, index) => {

          const key =

            `${block.type}-${index}`;

          if (

            block.type ===

            "heading"

          ) {

            return (

              <h3

                key={key}

                className="verdict-ai-response-heading"

              >

                {block.content}

              </h3>

            );

          }

          if (

            block.type ===

            "numbered"

          ) {

            return (

              <div

                key={key}

                className="verdict-ai-response-step"

              >

                <div className="verdict-ai-response-step-number">

                  {

                    block.number

                  }

                </div>

                <p>

                  {renderInlineText(

                    block.content,

                    key

                  )}

                </p>

              </div>

            );

          }

          if (

            block.type ===

            "bullet"

          ) {

            return (

              <div

                key={key}

                className="verdict-ai-response-bullet"

              >

                <span

                  aria-hidden="true"

                  className="verdict-ai-response-bullet-dot"

                >

                  •

                </span>

                <p>

                  {renderInlineText(

                    block.content,

                    key

                  )}

                </p>

              </div>

            );

          }

          if (

            block.type ===

            "url"

          ) {

            return (

              <a

                key={key}

                href={

                  block.content

                }

                target="_blank"

                rel="noreferrer"

                className="verdict-ai-source-link"

              >

                Open official source

                <span>

                  ↗

                </span>

              </a>

            );

          }

          if (

            block.type ===

            "official-link"

          ) {

            return (

              <a

                key={key}

                href={

                  block.content

                }

                target="_blank"

                rel="noreferrer"

                className="verdict-ai-referral-link"

              >

                Visit official website

                <span>

                  ↗

                </span>

              </a>

            );

          }

          if (

            block.type ===

            "detail"

          ) {

            return (

              <p

                key={key}

                className="verdict-ai-response-detail"

              >

                <strong>

                  {

                    block.label

                  }:

                </strong>{" "}

                {

                  block.content

                }

              </p>

            );

          }

          return (

            <p

              key={key}

              className={`verdict-ai-response-paragraph ${

                block.section ===

                "IMPORTANT"

                  ? "verdict-ai-response-important"

                  : ""

              }`}

            >

              {renderInlineText(

                block.content,

                key

              )}

            </p>

          );

        }

      )}

    </div>

  );

}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function VerdictAI() {

  const navigate =

    useNavigate();

  const [

    menuOpen,

    setMenuOpen,

  ] = useState(false);

  const [

    message,

    setMessage,

  ] = useState("");

  const [

    attachment,

    setAttachment,

  ] = useState(null);

  const [

    attachmentError,

    setAttachmentError,

  ] = useState("");

  const [
    attachmentPreview,
    setAttachmentPreview,
  ] = useState("");

  const [
    sentAttachmentPreviews,
    setSentAttachmentPreviews,
  ] = useState({});

  const {

    conversation,

    loading,

    sendQuestion,

  } = useVerdictAI();

  const conversationEndRef =

    useRef(null);

  const fileInputRef =

    useRef(null);

  useEffect(() => {

    conversationEndRef.current

      ?.scrollIntoView({

        behavior: "smooth",

      });

  }, [

    conversation,

    loading,

  ]);

  function clearAttachment() {
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }
    setAttachment(null);
    setAttachmentPreview("");
    setAttachmentError("");
  }

  function setSelectedFile(file) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setAttachmentError("Please choose a file smaller than 10 MB.");
      return;
    }
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }
    setAttachmentError("");
    setAttachment(file);
    setAttachmentPreview(
      isImageFile(file) ? URL.createObjectURL(file) : ""
    );
  }

  function chooseAttachment() {
    if (!loading) fileInputRef.current?.click();
  }

  function handleAttachment(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setSelectedFile(file);
  }

  function handlePaste(event) {
    if (loading) return;
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find(
      (item) => item.kind === "file" && item.type.startsWith("image/")
    );
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    const extension =
      file.type === "image/png" ? "png" :
      file.type === "image/jpeg" ? "jpg" :
      file.type === "image/webp" ? "webp" :
      file.type === "image/gif" ? "gif" : "image";
    setSelectedFile(
      new File([file], `Pasted image.${extension}`, {
        type: file.type,
      })
    );
  }

  async function sendMessage(event) {
    event.preventDefault();
    const cleanMessage = message.trim();
    if ((!cleanMessage && !attachment) || loading) return;

    const currentAttachment = attachment;

    if (currentAttachment && isImageFile(currentAttachment)) {
      try {
        const dataUrl = await fileToDataUrl(currentAttachment);
        setSentAttachmentPreviews((current) => ({
          ...current,
          [currentAttachment.name]: dataUrl,
        }));
      } catch (error) {
        console.error("Could not create image preview:", error);
      }
    }

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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if ((message.trim() || attachment) && !loading) {
        sendMessage(event);
      }
    }
  }

return (

    <main className="verdict-ai-page">

      <section className="verdict-ai-shell">

        <AppHeader

          onMenuOpen={() =>

            setMenuOpen(true)

          }

          onNotifications={() =>

            navigate(

              "/notifications"

            )

          }

        />

        <SideMenu

          open={menuOpen}

          onClose={() =>

            setMenuOpen(false)

          }

        />

        <section className="verdict-ai-full-chat">

          <header className="verdict-ai-full-header">

            <div className="verdict-ai-full-mark">

              V

            </div>

            <div>

              <h1>

                Verdict AI

              </h1>

              <p>

                Legal preparation

                assistant

              </p>

            </div>

          </header>

          <div className="verdict-ai-full-conversation">

            {conversation.length ===

            0 ? (

              <div className="verdict-ai-simple-empty">

                <div>

                  V

                </div>

                <h2>

                  How can I help?

                </h2>

                <p>

                  Ask Verdict AI

                  about a legal

                  situation and it

                  will check the

                  verified guidance

                  available in

                  Verdict.

                </p>

              </div>

            ) : (

              conversation.map(

                (item) => (

                  <article

                    key={

                      item.id

                    }

                    className={`verdict-ai-bubble ${item.role}`}

                  >

                    <span className="verdict-ai-message-author">

                      {item.role ===

                      "user"

                        ? "You"

                        : "Verdict AI"}

                    </span>

                    {item.role ===

                    "assistant" ? (

                      <AssistantReply

                        text={

                          item.text

                        }

                      />

                    ) : (

                      <p className="verdict-ai-user-message">

                        {

                          item.text

                        }

                      </p>

                    )}

                    {item.attachmentName &&
                      sentAttachmentPreviews[item.attachmentName] && (
                        <img
                          src={sentAttachmentPreviews[item.attachmentName]}
                          alt={item.attachmentName}
                          style={{
                            display: "block",
                            width: "100%",
                            maxWidth: "320px",
                            maxHeight: "260px",
                            objectFit: "contain",
                            borderRadius: "12px",
                            marginTop: "10px",
                            marginBottom: "8px",
                          }}
                        />
                      )}

                    {item.attachmentName && (

                      <small className="verdict-ai-message-attachment">

                        📎 {item.attachmentName}

                      </small>

                    )}

                  </article>

                )

              )

            )}

            {loading && (

              <article className="verdict-ai-bubble assistant verdict-ai-loading-bubble">

                <span className="verdict-ai-message-author">

                  Verdict AI

                </span>

                <div className="verdict-ai-checking">

                  <span className="verdict-ai-checking-dot" />

                  <span className="verdict-ai-checking-dot" />

                  <span className="verdict-ai-checking-dot" />

                  <p>

                    Checking verified

                    guidance...

                  </p>

                </div>

              </article>

            )}

            <div

              ref={

                conversationEndRef

              }

            />

          </div>

          <div className="verdict-ai-full-bottom">

            {attachment && (
              <div style={{ marginBottom: "12px" }}>
                {attachmentPreview && (
                  <div
                    style={{
                      maxWidth: "320px",
                      maxHeight: "220px",
                      overflow: "hidden",
                      borderRadius: "16px",
                      border: "1px solid rgba(0, 0, 0, 0.12)",
                      background: "#f6f5f0",
                      marginBottom: "8px",
                    }}
                  >
                    <img
                      src={attachmentPreview}
                      alt="Selected attachment preview"
                      style={{
                        display: "block",
                        width: "100%",
                        maxHeight: "220px",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}

                <div className="verdict-ai-attachment-chip">
                  <span>📎 {attachment.name}</span>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    disabled={loading}
                    aria-label="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {attachmentError && (

              <p className="verdict-ai-attachment-error">

                {attachmentError}

              </p>

            )}

            <form

              className="verdict-ai-simple-composer verdict-ai-full-composer"

              onSubmit={

                sendMessage

              }

            >

              <input

                ref={fileInputRef}

                type="file"

                hidden

                accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx"

                onChange={handleAttachment}

              />

              <button

                type="button"

                className="verdict-ai-attach-button"

                onClick={chooseAttachment}

                disabled={loading}

                aria-label="Attach file or image"

                title="Attach file or image"

              >

                📎

              </button>



              <textarea

                value={

                  message

                }

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

                  (!message.trim() &&

                    !attachment) ||

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
                color: "#556365",
                opacity: 1,
                lineHeight: 1.5,
              }}
            >

              Only upload documents you are comfortable using for this matter.

              Verdict uses attachments only to help explain relevant information

              and guidance.

            </p>

            <div className="verdict-ai-full-disclaimer">

              <strong>

                Verdict AI is a legal

                preparation tool.

              </strong>

              <p>

                It does not act as

                your lawyer,

                represent you or

                guarantee an

                outcome. Important

                legal rights,

                procedures and

                deadlines should be

                checked against

                reliable official

                sources or a

                qualified legal

                professional.

              </p>

            </div>

          </div>

        </section>

      </section>

    </main>

  );

}

export default VerdictAI;