import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import "../styles/legal.css";

function Privacy() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const openedFromTerms =
    location.state?.from ===
    "/terms";

  const sections = [
    {
      title: "1. Information Verdict may collect",
      content:
        "This may include account information, contact details, matter information, uploaded evidence, documents, reminders, referral activity and technical information needed to operate the service.",
    },
    {
      title: "2. Why Verdict uses information",
      content:
        "Information may be used to provide the service, organise matters, generate guidance, manage accounts, secure the platform, provide reminders and improve Verdict.",
    },
    {
      title: "3. Sensitive information",
      content:
        "Legal matters may contain sensitive information. Verdict should minimise collection and only process information required for the user's matter or requested feature.",
    },
    {
      title: "4. Uploaded evidence",
      content:
        "Documents and evidence should only be processed for providing Verdict's features unless the user separately agrees to another use.",
    },
    {
      title: "5. AI processing",
      content:
        "Some information may be processed by automated systems to provide explanations, summaries, document assistance, matter analysis or suggested next steps.",
    },
    {
      title: "6. Sharing information",
      content:
        "Verdict should not sell personal legal information. Information should only be shared where necessary to provide the service, where the user directs Verdict to do so, or where required by law.",
    },
    {
      title: "7. Referrals",
      content:
        "Verdict should not automatically send a user's full case file to a referral organisation without the user's knowledge and consent.",
    },
    {
      title: "8. Security",
      content:
        "Verdict should use reasonable technical and organisational safeguards to protect personal information and uploaded evidence.",
    },
    {
      title: "9. Data retention",
      content:
        "Personal information should only be retained for as long as necessary for the purpose for which it was collected or as required by applicable law.",
    },
    {
      title: "10. User rights",
      content:
        "Users should be able to access, correct and, where legally appropriate, request deletion of their personal information.",
    },
    {
      title: "11. Account deletion",
      content:
        "Verdict should provide a clear process for users to request deletion of their account and associated information, subject to legal retention requirements.",
    },
    {
      title: "12. Privacy changes",
      content:
        "Users should be informed when material changes are made to the Privacy Policy.",
    },
  ];

  function handleBack() {
    if (openedFromTerms) {
      navigate(
        "/terms",
        {
          replace: true,
        }
      );

      return;
    }

    navigate(
      "/home",
      {
        replace: true,
      }
    );
  }

  return (
    <main className="legal-page">
      <section className="legal-shell">
        <button
          className="legal-back"
          type="button"
          onClick={
            handleBack
          }
        >
          ← Back
        </button>

        <div className="legal-heading">
          <span>
            VERDICT
          </span>

          <p className="eyebrow">
            Privacy
          </p>

          <h1>
            Privacy Policy
          </h1>

          <p>
            This explains how Verdict
            intends to handle personal
            information.
          </p>

          <small>
            Draft version 1.0
          </small>
        </div>

        <div className="legal-sections">
          {sections.map(
            (section) => (
              <details
                className="legal-section"
                key={
                  section.title
                }
              >
                <summary>
                  {
                    section.title
                  }
                </summary>

                <p>
                  {
                    section.content
                  }
                </p>
              </details>
            )
          )}
        </div>

        <div className="legal-notice">
          This Privacy Policy is a
          development draft. The final
          version should be reviewed
          for compliance with South
          African privacy law before
          public launch.
        </div>
      </section>
    </main>
  );
}

export default Privacy;