/*
  Verdict product knowledge
  -------------------------
  Grounded from the actual Verdict application source supplied by the project owner.

  Purpose:
  - Give Verdict AI a structured model of the real application.
  - Let the AI reason about user intent instead of matching exact user phrases.
  - Keep product-help separate from verified legal guidance.
  - Never invent controls or capabilities that are not represented here.

  When the user's wording is informal ("paste", "put", "attach", "where do I..."),
  interpret the task from the named feature and explain the real supported workflow.
*/

export const VERDICT_PRODUCT = {
  identity: {
    name: "Verdict",
    jurisdiction: "South Africa",
    purpose:
      "A legal-information and case-preparation platform that helps users describe and organise a legal matter, preserve supporting evidence, build a timeline, review verified legal information where Verdict has coverage, identify preparation gaps, find appropriate support, manage important dates, and prepare an organised Matter Pack.",
    notAReplacementForLawyer: true,
    boundaries: [
      "Verdict is not a lawyer or law firm.",
      "Verdict does not represent the user.",
      "Verdict does not determine liability, guilt, legal merits or whether a case will succeed.",
      "Verdict does not guarantee an outcome.",
      "Uploaded documents and images are user-supplied factual context and are not automatically treated as verified South African law.",
      "Evidence-integrity verification does not prove authenticity, truth, chain of custody or admissibility.",
    ],
  },

  navigation: {
    primary: [
      {
        name: "Home",
        route: "/home",
        purpose:
          "Starting point for the signed-in application. Users can describe a situation in their own words and access their matter-related tools and shortcuts.",
      },
      {
        name: "My Matters",
        route: "/matters",
        purpose:
          "Shows saved matters. Users can open an existing matter, start a new matter, continue preparation, edit a matter, and delete a matter using the confirmation flow.",
      },
      {
        name: "Calendar",
        route: "/calendar",
        purpose:
          "Calendar and reminder workspace for important dates, follow-ups and matter-related items.",
      },
      {
        name: "Know Your Rights",
        route: "/know-your-rights",
        purpose:
          "Browse and search the legal-information areas currently covered by Verdict.",
      },
      {
        name: "Find Help",
        route: "/find-help",
        purpose:
          "Find verified support organisations and official services available through Verdict.",
      },
      {
        name: "Verdict AI",
        route: "/verdict-ai",
        purpose:
          "Conversational assistant for Verdict product help and legal-preparation questions. Product questions use product knowledge; legal questions use the verified legal pipeline.",
      },
      {
        name: "Profile",
        route: "/profile",
        purpose:
          "View and edit personal account/profile information and access account-related sections.",
      },
      {
        name: "Settings",
        route: "/settings",
        purpose:
          "Manage account links, language, notifications, location, privacy/legal information and Help & Support.",
      },
      {
        name: "Help & Support",
        route: "/support",
        purpose:
          "Product help area containing user guidance, FAQs, technical support, legal-help routing, and links to Verdict's Terms and Privacy information.",
      },
      {
        name: "Notifications",
        route: "/notifications",
        purpose:
          "Review reminder/notification items and manage notification-related actions available in the interface.",
      },
    ],
    fallback:
      "Unknown application routes redirect to Home.",
  },

  authentication: {
    features: [
      "Sign up",
      "Log in",
      "Forgot password",
      "Reset password",
      "Protected authenticated routes",
      "Terms acceptance flow",
    ],
    notes: [
      "Verdict uses Supabase Auth.",
      "Authenticated application pages are wrapped by ProtectedRoute.",
      "Full Terms and Privacy pages can be opened from the relevant legal/settings flows.",
    ],
  },

  matters: {
    create: {
      route: "/matters/new",
      workflow: [
        {
          step: 1,
          name: "Your situation",
          behavior:
            "The user describes what happened in their own words. They do not need legal terminology. A new matter requires at least 10 characters in the story before continuing.",
        },
        {
          step: 2,
          name: "Timing",
          behavior:
            "The user records when the matter happened. An approximate date is acceptable, and the interface supports indicating that the user is unsure of the exact date.",
        },
        {
          step: 3,
          name: "Other party",
          behavior:
            "The user records the type of person or organisation involved and can add the relevant name/organisation information.",
        },
        {
          step: 4,
          name: "Supporting files during new-matter creation",
          behavior:
            "For a new matter, the creation flow includes an optional file-selection step before saving. Editing an existing matter uses a shorter three-step flow.",
        },
      ],
      persistence:
        "Saved matter information is stored in Supabase and can be reopened and edited.",
    },

    myMatters: {
      route: "/matters",
      capabilities: [
        "View saved matters",
        "Open a matter",
        "Start a new matter",
        "Continue a matter",
        "Edit matter details",
        "Delete a matter through a confirmation modal",
      ],
    },

    overview: {
      routePattern: "/matters/:matterId",
      purpose:
        "Central workspace for the current saved matter.",
      sections: [
        "Matter information",
        "Matter Health Check / preparation completeness",
        "Consistency review",
        "Recommended or verified next action",
        "Evidence",
        "Timeline",
        "Guidance",
        "Case Summary / Matter Pack",
      ],
      healthCheck: {
        meaning:
          "Matter Health measures preparation completeness only. It is not a legal-strength, merits or chance-of-success score.",
        checks: [
          "Matter described",
          "Other party recorded",
          "Date information recorded",
          "Supporting material added",
          "Timeline started",
        ],
        behavior:
          "The overview calculates how many preparation items are complete and identifies the next incomplete preparation item.",
      },
      nextAction:
        "The overview can display a recommended/verified next action and route the user to Evidence, Timeline, Case Summary or Guidance depending on the action.",
    },
  },

  evidence: {
    route: "/matters/:matterId/evidence",
    prerequisite:
      "Evidence belongs to a saved matter. The user should open the relevant matter and then open Evidence.",
    uploadWorkflow: [
      "Open My Matters.",
      "Open the relevant saved matter.",
      "Open Evidence.",
      "Use the Add evidence / Choose files upload control.",
      "The device file picker opens.",
      "Select one or multiple supported files.",
      "Review/add the evidence category and description requested by the interface.",
      "Save/upload the evidence to the matter.",
    ],
    interactions: {
      filePicker: true,
      multipleFileSelection: true,
      clipboardPasteOnEvidencePage: false,
      dragAndDropOnEvidencePage: false,
      clarification:
        "If a user says paste, put, attach, insert or add a file/picture 'on Evidence', infer that they want to add evidence and explain the real file-picker workflow. Do not claim clipboard paste or drag-and-drop exists on the Evidence page.",
    },
    supportedFormats: [
      "PDF",
      "JPG",
      "JPEG",
      "PNG",
      "WEBP",
    ],
    maxFileSize:
      "10 MB per file",
    descriptionExample:
      "The interface gives an example such as: 'This bank statement shows that I paid the deposit on 3 March.'",
    checklist:
      "The Evidence page includes preparation guidance/checklist concepts for useful supporting material such as written communications, transaction/payment material, agreements/official documents, and visual supporting material.",
    integrity: {
      featureName:
        "Quantum-safe evidence integrity",
      protectAction:
        "Protect integrity creates a SHA-256 fingerprint of the stored file and protects the integrity record with an ML-DSA-65 post-quantum digital signature.",
      verifyAction:
        "Verify integrity re-checks the stored file against the protected integrity record.",
      statuses:
        "The interface can represent protected/verified/changed integrity states.",
      strictMeaning:
        "An integrity verification means the current stored bytes match the protected record. It does not by itself establish authenticity, truth, legal admissibility or a complete legal chain of custody.",
    },
  },

  timeline: {
    route: "/matters/:matterId/timeline",
    purpose:
      "Organise important events and dates connected to the matter.",
    capabilities: [
      "View matter timeline events",
      "Add an event",
      "Record an event date",
      "Choose/record an event type",
      "Add an event title",
      "Add useful event details",
      "Delete a timeline event",
    ],
    examples:
      "The interface uses examples such as 'Landlord said the deposit would be returned'.",
    suggestedEvents:
      "Verdict may derive/suggest timeline information from matter context, but suggested information should be reviewed by the user before it becomes part of their saved preparation record.",
  },

  consistencyCheck: {
    location:
      "Matter Overview",
    purpose:
      "Surface explicit information that may need review, particularly date/information inconsistencies across the matter, timeline and supporting material.",
    limits: [
      "It does not decide which version is true.",
      "It does not accuse a user or another party of lying.",
      "It is a preparation/review aid, not a legal conclusion.",
    ],
    reviewDestinations:
      "A flagged issue can direct the user back to edit the matter, Timeline or Evidence depending on the item.",
  },

  guidance: {
    location:
      "Matter Overview",
    purpose:
      "Connect recorded matter information to verified South African legal information available in Verdict.",
    coverageStates: [
      "Checking verified sources",
      "Verified coverage/guidance available",
      "Limited coverage / no verified match",
    ],
    canShow: [
      "Verified legal guidance",
      "Relevant verified topics/rules",
      "Official/verified sources",
      "Referrals where present in verified data",
      "Practical preparation information",
      "What might be missing / preparation gaps",
      "Limitations",
    ],
    missingInformation: {
      featureName:
        "What might be missing?",
      meaning:
        "Uses the current matter state together with verified legal context to identify facts or preparation items that may still be needed.",
      limits:
        "It does not predict whether the user will win, decide legal merits, or manufacture facts.",
    },
    noCoverageBehavior:
      "If Verdict does not have enough verified legal coverage for the question/matter, it should say so rather than invent legal authority.",
  },

  caseSummary: {
    names: [
      "Case Summary",
      "Matter Pack",
    ],
    purpose:
      "Create an organised preparation summary from the user's matter information.",
    contentCanInclude: [
      "Matter details",
      "Timeline information",
      "Evidence information",
      "Relevant verified legal context/sources when available",
      "Preparation-oriented information",
    ],
    export:
      "The project includes PDF export functionality for the case summary/Matter Pack.",
    limits:
      "The Matter Pack is a preparation document. It is not a legal opinion and does not guarantee a legal result.",
  },

  knowYourRights: {
    route: "/know-your-rights",
    capabilities: [
      "Search for a legal-information topic",
      "Browse available legal areas/topics",
      "Open available rights/legal information in the interface",
    ],
    grounding:
      "Rights information should reflect Verdict's available structured/verified legal coverage. Lack of coverage should not be filled with invented law.",
  },

  findHelp: {
    route: "/find-help",
    purpose:
      "Help users locate appropriate support and official services.",
    helpTypes: [
      "Legal Aid",
      "Government Services",
      "Courts & Tribunals",
      "Legal Professionals",
    ],
    capabilities: [
      "Search for help",
      "Use available filters",
      "Select a South African province where the interface/data supports provincial filtering",
      "Open available official/contact information for returned organisations",
    ],
    provinces:
      "The page contains South African province selection/filtering.",
    limits: [
      "Do not invent an organisation or referral.",
      "Do not guarantee that an organisation will accept a matter or provide representation.",
      "Technical support for Verdict is separate from legal assistance.",
    ],
  },

  calendar: {
    route: "/calendar",
    purpose:
      "Manage important dates and reminders.",
    capabilities: [
      "Move between months",
      "Select calendar dates",
      "Add a calendar item",
      "Add a title",
      "Set date/time information available in the form",
      "Choose an event/reminder type",
      "Add notes",
      "View saved items",
      "Delete items",
    ],
    example:
      "The interface gives an example such as 'Follow up with Legal Aid'.",
  },

  notifications: {
    route: "/notifications",
    purpose:
      "Surface reminders/notification items generated from relevant app data and allow the user to review them.",
    behavior:
      "The implemented notification system checks for relevant items while the application/page is active and can use the browser Notification API when permission/support is available.",
    importantLimit:
      "The current implementation is not a full background push-notification service with a service worker. Do not promise notifications while the app is completely closed unless that capability is later implemented.",
    storageNote:
      "The current implementation uses local browser state/storage for parts of notification delivery tracking.",
  },

  verdictAI: {
    route: "/verdict-ai",
    roles: [
      "Answer questions about how to use Verdict using this product knowledge.",
      "Handle legal-preparation questions through Verdict's verified legal retrieval/reasoning pipeline.",
      "Analyse supported user attachments as user-supplied context.",
    ],
    composer: {
      textInput: true,
      attachControl:
        "The chat has an Attach file or image control.",
      clipboardPaste:
        "The Verdict AI message composer explicitly supports pasting an image with Ctrl+V.",
      distinction:
        "Clipboard image pasting is supported in Verdict AI chat. It is NOT the same as the Evidence page, which uses the file picker.",
    },
    attachmentFormats:
      "The chat attachment input accepts images and PDF, TXT, MD, CSV, JSON, DOC and DOCX file types.",
    maxAttachmentSize:
      "10 MB per attachment in the current Verdict AI page implementation.",
    attachmentSafety:
      "Content extracted from an attachment is user-supplied factual context. It is not a verified legal source merely because Verdict AI read it.",
    legalPipeline:
      "Substantive legal questions use semantic legal-topic classification, verified legal retrieval and bounded reasoning. Verified legal authority comes from Verdict's legal knowledge/sources, not unrestricted model memory.",
    providerBehavior:
      "The backend supports configured AI-provider routing/fallbacks. Provider availability does not change the requirement that legal claims remain grounded in verified legal data.",
  },

  home: {
    route: "/home",
    purpose:
      "Signed-in landing page and starting point for beginning/continuing legal preparation.",
    situationInput:
      "The Home interface lets a user describe their situation in their own words and can move them into the matter-preparation flow.",
    shortcuts:
      "Home provides access to relevant app areas and recent/current matter activity.",
  },

  profile: {
    route: "/profile",
    purpose:
      "View and edit user profile/account information.",
    editableInformation: [
      "Full name",
      "Phone number",
    ],
    displayedOrLinkedInformation: [
      "Email/account information",
      "Preferred language",
      "Location",
      "Settings/privacy-related destinations",
    ],
    persistence:
      "Profile information is loaded/saved through Supabase-backed profile data.",
  },

  settings: {
    route: "/settings",
    sections: {
      account: [
        "Email address — opens Profile",
        "Password — change/reset through the password-recovery flow",
        "Phone number — opens Profile",
      ],
      preferences: [
        "Language",
        "Notifications",
        "Location",
      ],
      privacyAndLegal: [
        "Privacy",
        "Terms & Conditions",
        "Data & account",
      ],
      support: [
        "Help & Support",
      ],
    },
    languagesShownInCurrentUI: [
      "English",
      "isiZulu",
      "isiXhosa",
      "Afrikaans",
      "Sepedi",
      "Setswana",
      "Sesotho",
      "Tsonga",
      "siSwati",
      "Tshivenda",
      "isiNdebele",
      "South African Sign Language",
    ],
    location:
      "The user can store/update a location preference such as a province. Location may help with relevant local/provincial support information.",
    dataAccountLimit:
      "The current Settings UI states that data export and account deletion are being prepared. Do not tell users these controls are already available.",
  },

  support: {
    route: "/support",
    purpose:
      "Help users understand Verdict, troubleshoot product issues and reach technical support without confusing technical support with legal assistance.",
    sections: [
      "User Guide",
      "Frequently Asked Questions",
      "Technical Support / support tickets",
      "Legal-help routing",
      "Terms & Conditions link",
      "Privacy link",
    ],
    ticketSystem: {
      authenticated: true,
      userCapabilities: [
        "Submit a support ticket",
        "Choose a support category available in the form",
        "Provide a subject and description",
        "View their own tickets",
        "Read the ticket conversation",
        "Send user replies where enabled",
      ],
      categories: [
        "Technical",
        "Account",
        "Navigation / app help",
        "Feedback",
      ],
      statuses: [
        "Open",
        "In progress",
        "Waiting on user",
        "Resolved",
        "Closed",
      ],
      securityGuidance:
        "Users should not include passwords, access tokens or other account secrets in a support ticket.",
    },
    admin: {
      route: "/admin/support",
      access:
        "Authenticated access plus membership in Verdict's support_admins data is required for support-admin functionality.",
      capabilities: [
        "View submitted support tickets",
        "Open ticket conversations",
        "Reply as Verdict Support",
        "Update ticket status",
      ],
      note:
        "The admin support page is an operational support tool, not legal representation.",
    },
    legalHelpDistinction:
      "If a user needs legal assistance rather than help using the app, direct them to Find Help or relevant verified referrals. Do not treat the technical-support team as lawyers.",
  },

  termsAndPrivacy: {
    termsRoute: "/terms/full",
    privacyRoute: "/privacy",
    purpose:
      "Provide the application's legal terms and privacy information.",
    termsAcceptance:
      "Verdict includes a terms-acceptance step in the authenticated onboarding/application flow.",
  },

  dataAndSecurity: {
    platform:
      "Supabase is used for authentication and application data/storage in the supplied project.",
    accessControl:
      "User-linked records and storage are intended to be scoped to authenticated users/matters, with RLS/ownership controls used by the project.",
    evidenceIntegrityBackend:
      "Evidence integrity protection/verification is performed through backend endpoints rather than trusting a browser-only integrity claim.",
    secrets:
      "Backend service credentials and signing material should remain server-side and must never be exposed as product-help output.",
  },

  reasoningRulesForProductHelp: [
    "First decide whether the user is asking how Verdict works or asking a substantive legal question.",
    "For product-help questions, answer from VERDICT_PRODUCT and do not route the answer through legal sources/referrals unless the user is actually asking for legal help.",
    "Do not require exact wording. Infer the intended task from the feature and surrounding words.",
    "Map informal verbs such as paste, put, attach, insert, upload, add, save, find, open, change and remove to the actual supported workflow for the named feature.",
    "If the requested interaction is unsupported, say what Verdict actually supports and give the closest real workflow.",
    "Never invent a button, route, feature, support channel, file format, limit, notification capability or legal capability.",
    "When product knowledge is genuinely insufficient to answer a UI-detail question, say what is known and what is not established rather than making up an interaction.",
    "Keep product help concise and task-oriented unless the user asks for a detailed walkthrough.",
    "Use human-facing page and feature names in normal answers rather than displaying internal URL routes unless the user specifically asks for a route or URL.",
    "Do not present Verdict's navigation as a technical sitemap. Explain where the user should go using the page or feature name.",
    "Do not add VERIFIED LEGAL GUIDANCE headings, legal referrals or legal-source sections to a pure product-help response.",
    "If a question combines product use with a substantive legal question, keep the two parts conceptually separate: product instructions come from product knowledge; legal information must come from verified legal retrieval.",
    "Do not turn Matter Health, preparation gaps, consistency checks or AI analysis into a case-strength/win-probability score.",
    "Do not describe evidence integrity as proof that evidence is genuine or admissible.",
    "Do not treat attachment text as verified law.",
  ],
};

export function productKnowledgeText() {
  return JSON.stringify(
    VERDICT_PRODUCT,
    null,
    2
  );
}