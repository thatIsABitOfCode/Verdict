import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../styles/support.css";

const GUIDE = [
  ["Getting started", "Use Home as your starting point. Open My Matters to create a new matter or return to one you already saved."],
  ["Create or edit a matter", "In My Matters, start a matter and record what happened, relevant date information, and the person or organisation involved. Saved matters can be reopened and edited."],
  ["Evidence", "Inside a matter, open Evidence to upload PDF, JPG, JPEG, PNG or WEBP files. The current upload limit is 10 MB per file. Uploaded evidence can then be protected and later verified for file integrity."],
  ["Evidence integrity", "Protect integrity creates a SHA-256 fingerprint and protects the integrity record with an ML-DSA-65 signature. Verify integrity checks whether the current stored file still matches that protected record. This does not prove authenticity, truth or legal admissibility."],
  ["Timeline", "Use Timeline to record important events and dates. Review suggested timeline information before saving it."],
  ["Consistency check", "The matter workspace can flag explicit date inconsistencies that may need review. Verdict does not decide which record is true."],
  ["Guidance", "Guidance connects the facts recorded in the matter to verified South African legal information currently available in Verdict, including sources and preparation gaps where available."],
  ["Verdict AI", "Ask legal-preparation questions or ask how to use Verdict. Product-help questions are kept separate from verified legal guidance."],
  ["Know Your Rights", "Browse legal areas and verified legal information currently covered by Verdict."],
  ["Find Help", "Browse verified support organisations and official service links. This is separate from Verdict technical support."],
  ["Calendar & notifications", "Review important dates and reminders in Calendar and Notifications. Browser notifications can be enabled when your browser supports them."],
  ["Case Summary / Matter Pack", "Prepare an organised matter summary/PDF for review. It is a preparation document, not a legal opinion."],
];

const FAQ = [
  ["What is Verdict?", "Verdict is a South African legal-information and case-preparation platform. It helps you organise a matter, evidence and dates, review verified legal information, prepare next steps and find relevant support."],
  ["Does Verdict give legal advice or represent me?", "No. Verdict provides legal information and preparation support. It is not a law firm, does not represent users and does not guarantee an outcome."],
  ["Can Verdict tell me whether I will win?", "No. Verdict can identify relevant information, inconsistencies and preparation gaps, but it does not predict outcomes or score legal merits."],
  ["What does Integrity verified mean?", "It means the current stored file bytes match the protected fingerprint and the integrity signature validates. It does not prove authenticity, truth, chain of custody or admissibility."],
  ["Does Verdict AI treat my uploaded document as law?", "No. Information extracted from an attachment is treated as user-supplied factual context, not as a verified source of South African law."],
  ["What happens if Verdict has no verified legal coverage?", "Verdict should tell you that verified coverage is unavailable or limited rather than inventing legal information."],
  ["Where do I get legal help?", "Use Find Help for verified support organisations and official service links. Technical-support tickets are for problems using Verdict, not legal representation."],
  ["How do I report a technical problem?", "Open the Support Tickets tab and submit what you were trying to do, what happened and any error message. Do not include passwords, access tokens or other account secrets."],
];

function Support() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("home");
  const [openFaq, setOpenFaq] = useState(null);
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("technical");
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("");

  async function loadTickets(activeUser = user) {
    if (!activeUser) return;
    const { data, error } = await supabase.from("support_tickets").select("*").eq("user_id", activeUser.id).order("updated_at", { ascending: false });
    if (error) return setNotice(error.message);
    setTickets(data || []);
  }

  async function loadMessages(ticket) {
    if (!ticket) return;
    const { data, error } = await supabase.from("support_ticket_messages").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
    if (error) return setNotice(error.message);
    setMessages(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const activeUser = data?.user || null;
      setUser(activeUser);
      if (activeUser) await loadTickets(activeUser);
    })();
  }, []);

  useEffect(() => { if (selected) loadMessages(selected); }, [selected?.id]);

  async function submitTicket(event) {
    event.preventDefault();
    setNotice("");
    if (!user) return setNotice("Please sign in again before submitting a ticket.");
    const { data, error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: subject.trim(),
      category,
      description: description.trim(),
    }).select().single();
    if (error) return setNotice(error.message);
    setSubject("");
    setDescription("");
    setNotice(`Ticket ${data.ticket_number} submitted.`);
    setSelected(data);
    await loadTickets(user);
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!user || !selected || !reply.trim()) return;
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: selected.id,
      user_id: user.id,
      sender_type: "user",
      message: reply.trim(),
    });
    if (error) return setNotice(error.message);
    setReply("");
    await loadMessages(selected);
    await loadTickets(user);
  }

  return (
    <main className="support-page"><section className="support-shell">
      <header className="support-header">
        <button type="button" className="support-back" onClick={() => navigate("/settings")} aria-label="Go back">←</button>
        <span className="support-wordmark">VERDICT</span><div className="support-header-space" />
      </header>

      <section className="support-title"><span className="support-eyebrow">Help centre</span><h1>Help & Support</h1><p>Learn how Verdict works, browse common questions, find legal support or contact the Verdict technical-support team.</p></section>

      <div className="support-tabs">
        {[['home','Support'],['guide','User Guide'],['faq','FAQ'],['tickets','Support Tickets']].map(([key,label]) => <button type="button" key={key} className={`support-tab ${tab===key?'active':''}`} onClick={() => setTab(key)}>{label}</button>)}
      </div>

      {tab === "home" && <>
        <section className="support-quick-grid">
          <button type="button" className="support-quick-card" onClick={() => navigate("/help")}><span className="support-quick-icon">→</span><div><strong>Need legal help?</strong><p>Explore Verdict's verified referral and support options.</p></div></button>
          <button type="button" className="support-quick-card" onClick={() => setTab("tickets")}><span className="support-quick-icon">?</span><div><strong>Technical support</strong><p>Send a ticket to the Verdict Support team.</p></div></button>
          <button type="button" className="support-quick-card" onClick={() => setTab("guide")}><span className="support-quick-icon">i</span><div><strong>User Guide</strong><p>Learn each major Verdict feature and workflow.</p></div></button>
          <button type="button" className="support-quick-card" onClick={() => navigate("/matters")}><span className="support-quick-icon">V</span><div><strong>Using your matters</strong><p>Return to your matters and continue preparing.</p></div></button>
        </section>

        <section className="support-section"><div className="support-section-heading"><span className="section-label">Frequently asked questions</span><h2>Common questions</h2></div><div className="support-faq-list">{FAQ.slice(0,6).map(([question,answer], index) => { const isOpen=openFaq===index; return <article className={`support-faq ${isOpen?'open':''}`} key={question}><button type="button" className="support-faq-question" onClick={() => setOpenFaq(isOpen?null:index)} aria-expanded={isOpen}><span>{question}</span><span>{isOpen?'−':'+'}</span></button>{isOpen&&<div className="support-faq-answer"><p>{answer}</p></div>}</article>})}</div></section>

        <section className="support-section"><div className="support-section-heading"><span className="section-label">Legal & privacy</span></div><div className="support-link-list"><button type="button" onClick={() => navigate("/terms/full")}><div><strong>Terms & Conditions</strong><span>Read Verdict's terms</span></div><span>→</span></button><button type="button" onClick={() => navigate("/privacy")}><div><strong>Privacy</strong><span>Learn how information is handled</span></div><span>→</span></button></div></section>

        <article className="support-legal-help"><div><span>Important</span><h2>Product support is not legal assistance.</h2><p>If you need help with a legal matter, use Verdict's Find Help section rather than technical support.</p><button type="button" onClick={() => navigate("/help")}>Find legal help <span>→</span></button></div></article>
      </>}

      {tab === "guide" && <section className="support-section"><div className="support-section-heading"><span className="section-label">User guide</span><h2>Using Verdict</h2><p>A practical guide to the features currently available in the app.</p></div><div className="support-guide-list">{GUIDE.map(([title,text],index)=><article className="support-guide-card" key={title}><span className="support-guide-number">{String(index+1).padStart(2,"0")}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>}

      {tab === "faq" && <section className="support-section"><div className="support-section-heading"><span className="section-label">FAQ</span><h2>Frequently asked questions</h2></div><div className="support-faq-list">{FAQ.map(([question,answer], index) => { const id=`full-${index}`; const isOpen=openFaq===id; return <article className={`support-faq ${isOpen?'open':''}`} key={question}><button type="button" className="support-faq-question" onClick={() => setOpenFaq(isOpen?null:id)} aria-expanded={isOpen}><span>{question}</span><span>{isOpen?'−':'+'}</span></button>{isOpen&&<div className="support-faq-answer"><p>{answer}</p></div>}</article>})}</div></section>}

      {tab === "tickets" && <section className="support-section"><div className="support-section-heading"><span className="section-label">Verdict technical support</span><h2>Support tickets</h2><p>Report a technical, account or navigation problem. Technical support does not provide legal advice.</p></div>
        <form className="support-ticket-form" onSubmit={submitTicket}><div className="support-form-group"><label>Category</label><select value={category} onChange={e=>setCategory(e.target.value)}><option value="technical">Technical issue</option><option value="account">Account help</option><option value="navigation">Navigation / app help</option><option value="feedback">Feedback</option></select></div><div className="support-form-group"><label>Subject</label><input maxLength="140" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Briefly describe the issue" /></div><div className="support-form-group"><label>What happened?</label><textarea rows="6" maxLength="4000" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Tell us what you were trying to do and what happened." /></div><p className="support-security-note">Do not include passwords, access tokens or other account secrets.</p><button className="support-submit-button" disabled={!subject.trim()||!description.trim()}>Submit ticket</button>{notice&&<p className="support-message">{notice}</p>}</form>
        <div className="support-ticket-list">{tickets.map(ticket=><button type="button" className={`support-ticket-card ${selected?.id===ticket.id?'active':''}`} key={ticket.id} onClick={()=>setSelected(ticket)}><div className="support-ticket-top"><div><span className="support-ticket-number">{ticket.ticket_number}</span><h3>{ticket.subject}</h3></div><span className={`support-status support-status-${ticket.status}`}>{ticket.status.replaceAll('_',' ')}</span></div></button>)}</div>
        {selected&&<article className="support-thread"><div className="support-thread-header"><span className="support-ticket-number">{selected.ticket_number}</span><h3>{selected.subject}</h3><p>{selected.description}</p></div><div className="support-messages">{messages.map(message=><div className={`support-message-bubble ${message.sender_type}`} key={message.id}><span className="support-message-sender">{message.sender_type==='admin'?'Verdict Support':'You'}</span><div className="support-message-text">{message.message}</div></div>)}</div><form className="support-reply-form" onSubmit={sendReply}><textarea rows="4" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Reply to Verdict Support"/><div className="support-reply-actions"><button className="support-submit-button" disabled={!reply.trim()}>Send reply</button></div></form></article>}
      </section>}
    </section></main>
  );
}

export default Support;
