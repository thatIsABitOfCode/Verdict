import { useNavigate } from "react-router-dom";
import "../styles/legal.css";

function FullTerms() {
  const navigate = useNavigate();

  const sections = [
    {
      title: "1. About Verdict",
      content:
        "Verdict is a digital legal-information, case-organisation and referral platform. It is designed to help users understand information, organise matters, prepare documents and evidence, track important dates and identify possible support options.",
    },
    {
      title: "2. Verdict is not a law firm",
      content:
        "Verdict is not a law firm and does not provide legal representation. Using Verdict does not create an attorney-client relationship.",
    },
    {
      title: "3. Legal information and AI limitations",
      content:
        "Verdict may use automated systems and artificial intelligence to explain information, identify possible legal issues and suggest next steps. These systems can make mistakes, misunderstand facts or provide incomplete information. Users must review important information before relying on it.",
    },
    {
      title: "4. No guarantee of outcomes",
      content:
        "Verdict cannot guarantee the result of any complaint, dispute, court process, tribunal process, application, referral, appeal or other legal matter.",
    },
    {
      title: "5. User responsibility",
      content:
        "Users are responsible for providing accurate information, reviewing generated documents, confirming important facts and determining whether professional legal advice is required.",
    },
    {
      title: "6. Evidence and uploaded information",
      content:
        "Users may upload documents, photographs, messages, recordings and other evidence. Users must only upload material they are legally entitled to possess, use and share.",
    },
    {
      title: "7. Prohibited use",
      content:
        "Verdict must not be used to fabricate evidence, forge documents, impersonate another person, unlawfully obtain information, harass others, threaten others or assist unlawful conduct.",
    },
    {
      title: "8. Deadlines and reminders",
      content:
        "Verdict may help identify dates and create reminders. These features are provided as organisational tools only. Users remain responsible for confirming and meeting official legal deadlines.",
    },
    {
      title: "9. Generated documents",
      content:
        "Letters, notices, templates and other documents generated through Verdict must be reviewed by the user before they are sent, filed or relied upon.",
    },
    {
      title: "10. Referrals and third parties",
      content:
        "Verdict may refer users to attorneys, Legal Aid, advice offices, government departments, tribunals or other organisations. A referral does not guarantee that the organisation will accept the matter or achieve a particular result.",
    },
    {
      title: "11. Emergency situations",
      content:
        "Verdict is not an emergency service. Users facing immediate danger, violence, medical emergencies or other urgent threats should contact the appropriate emergency or professional service.",
    },
    {
      title: "12. Account security",
      content:
        "Users are responsible for keeping account credentials secure and should notify Verdict if they suspect unauthorised access.",
    },
    {
      title: "13. Privacy and personal information",
      content:
        "Verdict may process personal information required to provide its services. How information is collected, used, stored and protected is explained in the Verdict Privacy Policy.",
    },
    {
      title: "14. User content",
      content:
        "Users retain ownership of the documents and information they upload. Users grant Verdict permission to process that content only to the extent required to provide the service.",
    },
    {
      title: "15. Intellectual property",
      content:
        "Verdict's software, design, branding and original platform content remain protected by applicable intellectual-property laws.",
    },
    {
      title: "16. Service availability",
      content:
        "Verdict may occasionally be unavailable because of maintenance, technical problems, connectivity issues or circumstances beyond its control.",
    },
    {
      title: "17. Account restriction",
      content:
        "Verdict may restrict or suspend accounts that are used unlawfully, fraudulently or in ways that compromise the safety or security of the platform or other users.",
    },
    {
      title: "18. Changes to these Terms",
      content:
        "Verdict may update these Terms when the service, law or platform changes. Material changes may require users to review and accept a new version before continuing.",
    },
    {
      title: "19. Governing law",
      content:
        "These Terms are intended to operate in accordance with the laws of the Republic of South Africa.",
    },
    {
      title: "20. Contact and complaints",
      content:
        "Verdict will provide users with a way to raise service, privacy and legal-information concerns. Formal contact details will be added before public launch.",
    },
  ];

  return (
    <main className="legal-page">
      <section className="legal-shell">
        <button
          className="legal-back"
          type="button"
          onClick={() =>
            navigate("/terms", {
              replace: true,
            })
          }
        >
          ← Back
        </button>

        <div className="legal-heading">
          <span>VERDICT</span>
          <p className="eyebrow">Legal</p>
          <h1>Terms & Conditions</h1>

          <p>
            These Terms explain the rules that apply when you use Verdict.
          </p>

          <small>Draft version 1.0</small>
        </div>

        <div className="legal-sections">
          {sections.map((section) => (
            <details
              className="legal-section"
              key={section.title}
            >
              <summary>
                {section.title}
              </summary>

              <p>
                {section.content}
              </p>
            </details>
          ))}
        </div>

        <div className="legal-notice">
          These Terms are currently a product-development draft and should
          receive professional legal review before Verdict is launched publicly.
        </div>
      </section>
    </main>
  );
}

export default FullTerms;