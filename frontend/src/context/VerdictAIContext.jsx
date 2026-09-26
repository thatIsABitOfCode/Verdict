import {
  createContext,
  useContext,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabaseClient";

const VerdictAIContext =
  createContext(null);

function makeMessage(
  role,
  text,
  attachmentName = ""
) {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    attachmentName,
  };
}

function cleanValue(value) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

function uniqueById(items = []) {
  return [
    ...new Map(
      items
        .filter(Boolean)
        .map((item) => [
          item.id,
          item,
        ])
    ).values(),
  ];
}

/*
 * ---------------------------------------------------------
 * VERIFIED LEGAL SOURCE HELPERS
 * ---------------------------------------------------------
 */

function buildSourceList(
  bestMatch
) {
  const ruleSources =
    (bestMatch.rules || [])
      .map(
        (rule) =>
          rule.source
      )
      .filter(
        (source) =>
          source?.id &&
          source?.title
      );

  const topicSources =
    (bestMatch.sources || [])
      .map(
        (item) =>
          item.source
      )
      .filter(
        (source) =>
          source?.id &&
          source?.title
      );

  return uniqueById([
    ...ruleSources,
    ...topicSources,
  ]).slice(0, 5);
}

function buildRuleSection(
  bestMatch
) {
  const rules =
    (bestMatch.rules || [])
      .filter(
        (rule) =>
          cleanValue(
            rule.plain_language_text
          )
      )
      .slice(0, 5);

  if (!rules.length) {
    return "";
  }

  return rules
    .map(
      (rule) =>
        `• ${cleanValue(
          rule.plain_language_text
        )}`
    )
    .join("\n\n");
}

function buildPreparationSteps(
  bestMatch
) {
  const steps = [];

  steps.push(
    "Keep relevant evidence about what happened, such as messages, notices, agreements, photographs, receipts or other documents connected to the matter."
  );

  steps.push(
    "Write down the important events in date order while the details are still fresh."
  );

  const referrals =
    (bestMatch.referrals || [])
      .filter(Boolean)
      .slice(0, 4);

  referrals.forEach(
    (referral) => {
      const title =
        cleanValue(
          referral.title
        );

      const instructions =
        cleanValue(
          referral.instructions
        );

      const organisationName =
        cleanValue(
          referral.organisation
            ?.name
        );

      if (
        title &&
        instructions
      ) {
        steps.push(
          organisationName
            ? `${title} through ${organisationName}: ${instructions}`
            : `${title}: ${instructions}`
        );

        return;
      }

      if (instructions) {
        steps.push(
          organisationName
            ? `Contact ${organisationName}: ${instructions}`
            : instructions
        );

        return;
      }

      if (
        organisationName
      ) {
        steps.push(
          `Consider contacting ${organisationName} using the verified referral information available in Verdict.`
        );
      }
    }
  );

  return steps
    .slice(0, 6)
    .map(
      (step, index) =>
        `${index + 1}. ${step}`
    )
    .join("\n\n");
}

function buildReferralSection(
  bestMatch
) {
  const referrals =
    (bestMatch.referrals || [])
      .filter(
        (referral) =>
          referral?.organisation
      )
      .slice(0, 4);

  if (!referrals.length) {
    return "";
  }

  return referrals
    .map((referral) => {
      const organisation =
        referral.organisation;

      const lines = [];

      if (
        cleanValue(
          organisation.name
        )
      ) {
        lines.push(
          `• ${organisation.name}`
        );
      }

      if (
        cleanValue(
          referral.title
        )
      ) {
        lines.push(
          `  ${referral.title}`
        );
      }

      if (
        cleanValue(
          referral.instructions
        )
      ) {
        lines.push(
          `  ${referral.instructions}`
        );
      }

      if (
        cleanValue(
          organisation.phone
        )
      ) {
        lines.push(
          `  Phone: ${organisation.phone}`
        );
      }

      if (
        cleanValue(
          organisation.email
        )
      ) {
        lines.push(
          `  Email: ${organisation.email}`
        );
      }

      if (
        cleanValue(
          referral.official_url
        )
      ) {
        lines.push(
          `  Official link: ${referral.official_url}`
        );
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

function buildSourcesSection(
  bestMatch
) {
  const sources =
    buildSourceList(
      bestMatch
    );

  if (!sources.length) {
    return "";
  }

  return sources
    .map((source) => {
      const title =
        cleanValue(
          source.title
        );

      const authority =
        cleanValue(
          source.authority
        );

      const officialUrl =
        cleanValue(
          source.official_url
        );

      const firstLine =
        authority
          ? `• ${title} — ${authority}`
          : `• ${title}`;

      if (officialUrl) {
        return `${firstLine}\n  ${officialUrl}`;
      }

      return firstLine;
    })
    .join("\n\n");
}

/*
 * ---------------------------------------------------------
 * ATTACHMENT ANALYSIS DISPLAY
 * ---------------------------------------------------------
 *
 * This section deliberately stays separate from verified
 * legal guidance.
 *
 * The uploaded material is evidence/factual context.
 * It is NOT treated as legal authority.
 * ---------------------------------------------------------
 */

function buildAttachmentSection(
  analysis
) {
  if (!analysis) {
    return "";
  }

  const sections = [];

  const documentType =
    cleanValue(
      analysis.documentType
    );

  const summary =
    cleanValue(
      analysis.summary
    );

  const observations =
    Array.isArray(
      analysis.observations
    )
      ? analysis.observations
          .map(cleanValue)
          .filter(Boolean)
          .slice(0, 10)
      : [];

  const uncertainties =
    Array.isArray(
      analysis.uncertainties
    )
      ? analysis.uncertainties
          .map(cleanValue)
          .filter(Boolean)
          .slice(0, 6)
      : [];

  if (documentType) {
    sections.push(
      `Document type: ${documentType}`
    );
  }

  if (summary) {
    sections.push(
      `Summary:\n${summary}`
    );
  }

  if (
    observations.length
  ) {
    sections.push(
      `What Verdict could identify:\n${observations
        .map(
          (item) =>
            `• ${item}`
        )
        .join("\n")}`
    );
  }

  if (
    uncertainties.length
  ) {
    sections.push(
      `What is unclear:\n${uncertainties
        .map(
          (item) =>
            `• ${item}`
        )
        .join("\n")}`
    );
  }

  if (!sections.length) {
    return "";
  }

  return `WHAT VERDICT FOUND IN YOUR ATTACHMENT

${sections.join("\n\n")}

The attachment is being treated as information supplied by you, not as a verified source of law.`;
}

/*
 * ---------------------------------------------------------
 * GROUNDED MODEL RESPONSE
 * ---------------------------------------------------------
 */

function buildGroundedReply(
  data,
  groundedAnswer
) {
  if (
    data?.coverage !== "verified" ||
    !data?.matches?.length ||
    !cleanValue(groundedAnswer)
  ) {
    return buildVerifiedReply(data);
  }

  const attachmentSection =
    buildAttachmentSection(
      data?.attachmentAnalysis
    );

  const bestMatch = data.matches[0];

  const referrals =
    buildReferralSection(bestMatch);

  const sources =
    buildSourcesSection(bestMatch);

  const missingFacts =
    Array.isArray(
      data?.reasoning?.missingFacts
    )
      ? data.reasoning.missingFacts
          .map(cleanValue)
          .filter(Boolean)
          .slice(0, 6)
      : [];

  const limitations =
    Array.isArray(
      data?.reasoning?.limitations
    )
      ? data.reasoning.limitations
          .map(cleanValue)
          .filter(Boolean)
          .slice(0, 6)
      : [];

  const nextSteps =
    Array.isArray(
      data?.reasoning?.suggestedNextSteps
    )
      ? data.reasoning.suggestedNextSteps
          .map(cleanValue)
          .filter(Boolean)
          .slice(0, 6)
      : [];

  const sections = [
    attachmentSection,

    `VERIFIED LEGAL GUIDANCE

${groundedAnswer}`,

    missingFacts.length
      ? `FACTS THAT MAY MATTER

${missingFacts
  .map((item) => `• ${item}`)
  .join("\n\n")}`
      : "",

    nextSteps.length
      ? `POSSIBLE NEXT STEPS

${nextSteps
  .map(
    (item, index) =>
      `${index + 1}. ${item}`
  )
  .join("\n\n")}`
      : "",

    referrals
      ? `WHERE YOU MAY BE ABLE TO GET HELP

${referrals}`
      : "",

    sources
      ? `VERIFIED LEGAL SOURCES

${sources}`
      : "",

    limitations.length
      ? `LIMITATIONS

${limitations
  .map((item) => `• ${item}`)
  .join("\n\n")}`
      : "",

    `IMPORTANT

Verdict AI is a legal preparation tool.

Information extracted from an uploaded document or image is treated as user-supplied factual context. It is not treated as a verified source of South African law.

Verdict does not act as your lawyer, represent you or guarantee an outcome. Important legal rights, procedures and deadlines should be checked against reliable official sources or a qualified legal professional.`,
  ];

  return sections
    .filter(Boolean)
    .join("\n\n");
}

/*
 * ---------------------------------------------------------
 * VERIFIED RESPONSE
 * ---------------------------------------------------------
 */

function buildVerifiedReply(
  data
) {
  // Product/app help is separate from verified legal guidance.
  if (data?.coverage === "product_help") {
    return (
      cleanValue(data?.productHelp?.answer) ||
      cleanValue(data?.message)
    );
  }

  const attachmentSection =
    buildAttachmentSection(
      data?.attachmentAnalysis
    );

  /*
   * If legal coverage was not verified, we may still
   * safely show what was extracted from the attachment.
   *
   * We do not turn that extraction into legal advice.
   */

  if (
    data.coverage !==
      "verified" ||
    !data.matches?.length
  ) {
    const legalMessage =
      data.message ||
      "Verdict does not currently have enough verified guidance to answer that safely.";

    return [
      attachmentSection,

      `VERIFIED LEGAL GUIDANCE

${legalMessage}`,

      `IMPORTANT

Verdict AI is a legal preparation tool.

Information extracted from an uploaded document or image is treated as user-supplied factual context. It is not treated as a verified source of South African law.

Verdict does not act as your lawyer, represent you or guarantee an outcome. Important legal rights, procedures and deadlines should be checked against reliable official sources or a qualified legal professional.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const bestMatch =
    data.matches[0];

  const domainName =
    bestMatch.domain?.name ||
    "Legal guidance";

  const issueName =
    bestMatch.issue?.name ||
    "Relevant legal issue";

  const rules =
    buildRuleSection(
      bestMatch
    );

  const preparationSteps =
    buildPreparationSteps(
      bestMatch
    );

  const referrals =
    buildReferralSection(
      bestMatch
    );

  const sources =
    buildSourcesSection(
      bestMatch
    );

  const sections = [
    attachmentSection,

    `VERIFIED LEGAL GUIDANCE

Matched area:
${domainName} → ${issueName}`,

    rules
      ? `WHAT THE VERIFIED GUIDANCE SAYS

${rules}`
      : "",

    preparationSteps
      ? `POSSIBLE NEXT STEPS

${preparationSteps}`
      : "",

    referrals
      ? `WHERE YOU MAY BE ABLE TO GET HELP

${referrals}`
      : "",

    sources
      ? `VERIFIED LEGAL SOURCES

${sources}`
      : "",

    `IMPORTANT

Verdict AI is a legal preparation tool.

Information extracted from an uploaded document or image is treated as user-supplied factual context. It is not treated as a verified source of South African law.

Verdict does not act as your lawyer, represent you or guarantee an outcome. Important legal rights, procedures and deadlines should be checked against reliable official sources or a qualified legal professional.`,
  ];

  return sections
    .filter(Boolean)
    .join("\n\n");
}

/*
 * ---------------------------------------------------------
 * FILE HELPERS
 * ---------------------------------------------------------
 */

function isTextLikeFile(
  file
) {
  const type =
    String(
      file?.type || ""
    ).toLowerCase();

  const name =
    String(
      file?.name || ""
    ).toLowerCase();

  return (
    type.startsWith(
      "text/"
    ) ||
    type ===
      "application/json" ||
    name.endsWith(
      ".txt"
    ) ||
    name.endsWith(
      ".md"
    ) ||
    name.endsWith(
      ".csv"
    ) ||
    name.endsWith(
      ".json"
    )
  );
}

async function fileToDataUrl(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          String(
            reader.result ||
              ""
          )
        );

      reader.onerror = () =>
        reject(
          new Error(
            "Verdict could not read the attached file."
          )
        );

      reader.readAsDataURL(
        file
      );
    }
  );
}

async function prepareAttachment(
  file
) {
  if (!file) {
    return null;
  }

  const maxSize =
    10 * 1024 * 1024;

  if (
    file.size >
    maxSize
  ) {
    throw new Error(
      "Please choose a file smaller than 10 MB."
    );
  }

  /*
   * Text-like files can be read directly in the browser.
   *
   * They do not need to be sent through the multimodal
   * attachment reader.
   */

  if (
    isTextLikeFile(
      file
    )
  ) {
    const text =
      await file.text();

    return {
      name:
        file.name,

      type:
        file.type ||
        "text/plain",

      size:
        file.size,

      text:
        text.slice(
          0,
          20000
        ),

      dataUrl:
        "",
    };
  }

  /*
   * Images/PDFs/documents are sent as a data URL.
   * The backend attachment reader handles them.
   */

  return {
    name:
      file.name,

    type:
      file.type ||
      "application/octet-stream",

    size:
      file.size,

    text:
      "",

    dataUrl:
      await fileToDataUrl(
        file
      ),
  };
}

/*
 * ---------------------------------------------------------
 * RETRIEVAL QUESTION
 * ---------------------------------------------------------
 */

function buildRetrievalQuestion(
  question,
  attachment
) {
  const cleanQuestion =
    cleanValue(
      question
    );

  if (
    !attachment
  ) {
    return cleanQuestion;
  }

  /*
   * Text documents are already readable in the browser,
   * so include their contents as user-supplied factual
   * context.
   */

  if (
    attachment.text
  ) {
    return `${cleanQuestion}

The user attached a document named "${attachment.name}". Use the document text below only as factual context supplied by the user. Do not treat it as a verified legal source.

ATTACHED DOCUMENT TEXT:
${attachment.text}`;
  }

  /*
   * Do NOT invent an interpretation here.
   *
   * The backend attachment reader will analyse the actual
   * image/PDF/document and add the extracted factual
   * context before legal matching.
   */

  return cleanQuestion;
}

/*
 * ---------------------------------------------------------
 * PROVIDER
 * ---------------------------------------------------------
 */

export function VerdictAIProvider({
  children,
}) {
  const [
    conversation,
    setConversation,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  async function sendQuestion(
    question,
    file = null
  ) {
    const cleanQuestion =
      cleanValue(
        question
      );

    if (
      (!cleanQuestion &&
        !file) ||
      loading
    ) {
      return;
    }

    const displayQuestion =
      cleanQuestion ||
      "Please review the attached file and explain what may be relevant.";

    /*
     * Immediately show the user's message and filename.
     */

    setConversation(
      (current) => [
        ...current,

        makeMessage(
          "user",
          displayQuestion,
          file?.name ||
            ""
        ),
      ]
    );

    setLoading(true);

    try {
      /*
       * Prepare attachment.
       */

      const attachment =
        await prepareAttachment(
          file
        );

      /*
       * Get authenticated Supabase session.
       */

      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth
          .getSession();

      const accessToken =
        sessionData?.session
          ?.access_token;

      if (
        sessionError ||
        !accessToken
      ) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      /*
       * Build the question used by the legal retrieval
       * engine.
       */

      const retrievalQuestion =
        buildRetrievalQuestion(
          displayQuestion,
          attachment
        );

      /*
       * Call Verdict backend.
       */

      const response =
        await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/legal/search`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                question:
                  retrievalQuestion,

                attachment:
                  attachment
                    ? {
                        name:
                          attachment.name,

                        type:
                          attachment.type,

                        size:
                          attachment.size,

                        /*
                         * Images/PDFs/documents use this.
                         *
                         * Text files have an empty dataUrl
                         * because their text is already
                         * included in retrievalQuestion.
                         */
                        dataUrl:
                          attachment.dataUrl,
                      }
                    : null,
              }),
          }
        );

      let data;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          "Verdict received an invalid response from the legal retrieval service."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Verdict could not retrieve verified legal guidance."
        );
      }

      /*
       * The backend now returns attachmentAnalysis when
       * an image/PDF/document has actually been analysed.
       *
       * buildVerifiedReply keeps this analysis separate
       * from verified legal knowledge.
       */

      /*
       * Prefer Nova's grounded explanation when available.
       * Otherwise keep the existing verified retrieval response.
       */
      const groundedAnswer =
        data?.reasoning?.mode ===
          "grounded_model"
          ? cleanValue(
              data?.reasoning?.answer
            )
          : "";

      const reply =
        groundedAnswer
          ? buildGroundedReply(
              data,
              groundedAnswer
            )
          : buildVerifiedReply(
              data
            );

      setConversation(
        (current) => [
          ...current,

          makeMessage(
            "assistant",
            reply
          ),
        ]
      );
    } catch (error) {
      console.error(
        "Verdict AI retrieval error:",
        error
      );

      setConversation(
        (current) => [
          ...current,

          makeMessage(
            "assistant",
            error?.message ||
              "Verdict could not retrieve verified legal guidance right now."
          ),
        ]
      );
    } finally {
      setLoading(false);
    }
  }

  function clearConversation() {
    setConversation([]);
  }

  return (
    <VerdictAIContext.Provider
      value={{
        conversation,
        loading,
        sendQuestion,
        clearConversation,
      }}
    >
      {children}
    </VerdictAIContext.Provider>
  );
}

export function useVerdictAI() {
  const context =
    useContext(
      VerdictAIContext
    );

  if (!context) {
    throw new Error(
      "useVerdictAI must be used inside VerdictAIProvider"
    );
  }

  return context;
}