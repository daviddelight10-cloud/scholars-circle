import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { WHATSAPP_NUMBER } from "../lib/plans.js";
import { submitCopyrightReport } from "../lib/reportsApi.js";

const LAST_UPDATED = "7 October 2026";
const WA_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;

const CSS = `
  .lg-page { min-height: 100dvh; background: #08090f; color: #e8eaf6; font-family: 'Manrope', system-ui, sans-serif; padding: 24px 16px 64px; }
  .lg-inner { max-width: 720px; margin: 0 auto; }
  .lg-back { display: inline-flex; align-items: center; gap: 6px; color: #8b92c4; text-decoration: none; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
  .lg-back:hover { color: #FFD700; }
  .lg-title { font-size: 26px; font-weight: 800; margin: 0 0 4px; color: #fff; }
  .lg-upd { font-size: 12px; color: #4a5080; margin-bottom: 24px; }
  .lg-h2 { font-size: 15px; font-weight: 800; color: #FFD700; margin: 26px 0 8px; letter-spacing: 0.02em; }
  .lg-page p, .lg-page li { font-size: 14px; line-height: 1.75; color: #c3c8e0; margin: 0 0 10px; }
  .lg-page ul { padding-left: 20px; margin: 0 0 12px; }
  .lg-page li { margin-bottom: 5px; }
  .lg-page a { color: #FFD700; text-decoration: none; }
  .lg-page a:hover { text-decoration: underline; }
  .lg-card { background: #0e1020; border: 0.5px solid #1e2140; border-radius: 16px; padding: 18px; margin: 16px 0; }
  .lg-note { background: rgba(218,165,32,0.08); border: 0.5px solid rgba(218,165,32,0.3); border-radius: 12px; padding: 12px 14px; font-size: 13px; color: #e8d9a8; line-height: 1.6; margin: 14px 0; }
  .lg-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .lg-field label { font-size: 12px; font-weight: 700; color: #8b92c4; letter-spacing: 0.04em; text-transform: uppercase; }
  .lg-field input, .lg-field textarea { background: #12142a; border: 0.5px solid #1e2140; border-radius: 10px; padding: 11px 13px; font-size: 14px; color: #e8eaf6; font-family: inherit; outline: none; }
  .lg-field input:focus, .lg-field textarea:focus { border-color: #DAA520; }
  .lg-field textarea { min-height: 96px; resize: vertical; }
  .lg-hint { font-size: 12px; color: #4a5080; margin-top: -8px; margin-bottom: 14px; }
  .lg-check { display: flex; gap: 10px; align-items: flex-start; background: #12142a; border: 0.5px solid #1e2140; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: #c3c8e0; line-height: 1.55; cursor: pointer; }
  .lg-check input { margin-top: 3px; accent-color: #DAA520; }
  .lg-submit { width: 100%; border: none; border-radius: 12px; padding: 14px; font-size: 14px; font-weight: 800; font-family: inherit; letter-spacing: 0.03em; cursor: pointer; background: linear-gradient(135deg, #DAA520, #b8860b); color: #fff; transition: opacity 0.15s; }
  .lg-submit:disabled { opacity: 0.45; cursor: default; }
  .lg-err { background: rgba(248,113,113,0.1); border: 0.5px solid rgba(248,113,113,0.35); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #f87171; margin-bottom: 14px; }
  .lg-done { background: rgba(52,211,153,0.08); border: 0.5px solid rgba(52,211,153,0.35); border-radius: 16px; padding: 24px 18px; text-align: center; margin: 20px 0; }
  .lg-done-t { font-size: 17px; font-weight: 800; color: #34d399; margin-bottom: 6px; }
  .lg-done-p { font-size: 13px; color: #8b92c4; line-height: 1.6; }
`;

function LegalShell({ title, children }) {
  return (
    <div className="lg-page">
      <style>{CSS}</style>
      <div className="lg-inner">
        <Link to="/" className="lg-back">← Scholar's Circle</Link>
        <h1 className="lg-title">{title}</h1>
        <div className="lg-upd">Last updated: {LAST_UPDATED}</div>
        {children}
        <p style={{ marginTop: 36, fontSize: 12, color: "#4a5080" }}>
          Questions about this policy? Reach us in-app (Settings → Support) or on{" "}
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer">WhatsApp</a>.
        </p>
      </div>
    </div>
  );
}

// ─── Privacy Policy ────────────────────────────────────────────────────────────
export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        Scholar's Circle is a study platform where students and educators upload, share, and
        practice with learning materials. This policy explains what we collect, why, and the
        choices you have. By using Scholar's Circle you agree to this policy.
      </p>

      <h2 className="lg-h2">What we collect</h2>
      <ul>
        <li><b>Account details</b> — email, username, name, role (student/educator), university, department, and level.</li>
        <li><b>Content you upload</b> — documents, notes, and images you add to your space, plus AI-generated study tools created from them (summaries, quizzes, flashcards).</li>
        <li><b>Study activity</b> — quiz attempts, progress, XP, streaks, reviews, bookmarks, and materials you save.</li>
        <li><b>Social activity</b> — posts, comments, group membership, and messages sent through the app.</li>
        <li><b>Device & push data</b> — push notification tokens and basic device information, if you enable notifications.</li>
        <li><b>Security & audit events</b> — login events with IP address and device/browser details, and admin actions, used to protect accounts and investigate abuse.</li>
        <li><b>Payment references</b> — transaction IDs and subscription status. Card or bank details are handled by our payment processor (Paystack) and never reach our servers.</li>
      </ul>

      <h2 className="lg-h2">How we use it</h2>
      <ul>
        <li>Provide the service — your library, spaces, practice tools, and social features.</li>
        <li>Generate AI study materials from documents you choose to upload.</li>
        <li>Deliver content you've shared to the people you shared it with.</li>
        <li>Operate subscriptions, trials, and activation keys.</li>
        <li>Send notifications you've opted into and important account notices.</li>
        <li>Moderate content, investigate reports, and keep the platform safe.</li>
      </ul>

      <h2 className="lg-h2">AI processing</h2>
      <p>
        When you upload a document and generate study tools, its text may be processed by
        third-party AI providers acting on our behalf. They process the content to produce
        summaries, questions, and flashcards — they are not permitted to use it for other
        purposes. Only upload documents you own or have permission to use.
      </p>

      <h2 className="lg-h2">Sharing and visibility</h2>
      <p>
        Materials in My Space are private to you by default. When you share a material or space
        — to your feed, a group, a friend, or via a link — it becomes visible according to the
        audience you chose. Turning off a link revokes access for everyone except you. Community
        materials are visible to other members until you or a moderator removes them.
      </p>

      <h2 className="lg-h2">Third-party services</h2>
      <ul>
        <li><b>Supabase</b> — authentication, database, and file storage.</li>
        <li><b>Paystack</b> — subscription payments and payment verification.</li>
        <li><b>Firebase / FCM</b> — push notification delivery.</li>
        <li><b>AI providers</b> — generating study tools from your uploads.</li>
        <li><b>Vercel & Railway</b> — hosting for the app and its servers.</li>
      </ul>

      <h2 className="lg-h2">Retention and deletion</h2>
      <p>
        We keep your data while your account is active. Deleting a folder moves it to a recycle
        bin for 30 days before permanent removal; other deletions are immediate. Deleting your
        account removes your profile, uploads, and activity, though limited security and audit
        records may be retained briefly where required for fraud prevention or legal compliance.
        Backups may retain deleted data for a short period before rotation.
      </p>

      <h2 className="lg-h2">Security</h2>
      <p>
        We use industry-standard protections including encrypted connections, hashed passwords
        (handled by our auth provider), and access controls on moderation and admin tools. No
        system is perfectly secure — notify us immediately via WhatsApp if you suspect your
        account is compromised.
      </p>

      <h2 className="lg-h2">Children</h2>
      <p>
        Scholar's Circle is designed for secondary and tertiary students. It is not directed at
        children under 13, and we do not knowingly collect their data.
      </p>

      <h2 className="lg-h2">Your choices</h2>
      <ul>
        <li>Control visibility of every material and space you own.</li>
        <li>Revoke share links at any time.</li>
        <li>Manage notifications in Settings.</li>
        <li>Delete your account in Settings, or ask us via WhatsApp.</li>
      </ul>

      <h2 className="lg-h2">Changes</h2>
      <p>
        We may update this policy as the product evolves. Material changes will be announced
        in-app; continued use after an update means you accept the revised policy.
      </p>
    </LegalShell>
  );
}

// ─── Terms of Service ─────────────────────────────────────────────────────────
export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These terms govern your use of Scholar's Circle. By creating an account or continuing
        to use the app, you agree to them — we record the date of acceptance on your account.
        If you don't agree, please don't use the service.
      </p>

      <h2 className="lg-h2">1. The service</h2>
      <p>
        Scholar's Circle is a study platform: you can upload learning materials, organise them
        into spaces, generate AI-powered study tools (summaries, practice questions, flashcards),
        share materials with others, and study together in groups and live quizzes.
      </p>

      <h2 className="lg-h2">2. Accounts and eligibility</h2>
      <ul>
        <li>You must provide accurate information when creating an account.</li>
        <li>Accounts are personal — one person per account, and you're responsible for activity under your login.</li>
        <li>You must be at least 13 years old, or the age required in your jurisdiction to consent to online services.</li>
        <li>We may suspend accounts that violate these terms.</li>
      </ul>

      <h2 className="lg-h2">3. Subscriptions and payments</h2>
      <ul>
        <li>Some features require a paid subscription or an activation key issued by an educator.</li>
        <li>Payments are processed by Paystack (or verified manually via support). Prices are in Nigerian Naira.</li>
        <li>A free trial may be available with usage limits; it doesn't auto-convert to a paid plan.</li>
        <li>Subscriptions give access for the stated period. Refunds are handled case-by-case via support, and are not guaranteed except where required by law.</li>
      </ul>

      <h2 className="lg-h2">4. Your content</h2>
      <ul>
        <li><b>You keep ownership</b> of materials you upload.</li>
        <li>You grant us a licence to host, process (including with AI tools), and display your content according to the visibility you choose — for example, sharing to a group lets that group's members see and save it.</li>
        <li><b>Only upload what you have rights to.</b> You confirm that you own the content or have permission from the rights holder to share it. Uploading someone else's copyrighted work without permission violates these terms and may expose you to liability.</li>
        <li>We may remove content that violates these terms or applicable law — see our <Link to="/copyright">Copyright Policy</Link>.</li>
      </ul>

      <h2 className="lg-h2">5. Prohibited use</h2>
      <ul>
        <li>Uploading infringing, unlawful, harassing, or harmful content.</li>
        <li>Uploading malware or attempting to compromise the service or other users.</li>
        <li>Scraping, bulk-downloading materials, or automated abuse of the platform.</li>
        <li>Facilitating exam malpractice or academic dishonesty that violates your institution's rules.</li>
        <li>False payment claims, chargeback fraud, or abusing the free trial.</li>
        <li>Impersonating another person or institution.</li>
      </ul>

      <h2 className="lg-h2">6. AI-generated study tools</h2>
      <ul>
        <li>Summaries, practice questions, flashcards, and explanations are AI-generated study aids — they may contain errors and do not replace your official curriculum, textbooks, or lecturers.</li>
        <li>AI output is not professional, medical, legal, or financial advice.</li>
        <li>You are responsible for reviewing generated material before relying on or sharing it.</li>
      </ul>

      <h2 className="lg-h2">7. Copyright and takedowns</h2>
      <p>
        If content on Scholar's Circle infringes your copyright, file a notice at{" "}
        <Link to="/copyright">/copyright</Link> or via the in-app report flow. Valid notices lead
        to removal or disabling of the reported material. Repeat infringers lose access to the
        platform. Knowingly false claims may result in consequences for the claimant.
      </p>

      <h2 className="lg-h2">8. Moderation</h2>
      <p>
        We moderate reported and flagged content at our discretion. Moderators may make materials
        private, remove them, or restrict accounts. Reporting is anonymous to the uploader.
      </p>

      <h2 className="lg-h2">9. Disclaimers</h2>
      <p>
        The service is provided "as is" and "as available". We don't guarantee uninterrupted
        availability, the accuracy of user-uploaded or AI-generated content, or fitness for any
        particular purpose.
      </p>

      <h2 className="lg-h2">10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Scholar's Circle is not liable for indirect or
        consequential losses — including lost study time, academic outcomes, or lost data —
        arising from use of the service.
      </p>

      <h2 className="lg-h2">11. Governing law</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria.
      </p>

      <h2 className="lg-h2">12. Changes</h2>
      <p>
        We may update these terms as the product evolves. We'll announce material changes in-app;
        continued use after an update constitutes acceptance.
      </p>
    </LegalShell>
  );
}

// ─── Copyright Policy + takedown form ─────────────────────────────────────────
export function CopyrightPolicyPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    targetUrl: params.get("u") || "",
    contactName: "",
    contactEmail: "",
    claimDescription: "",
    evidenceUrl: "",
  });
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSubmit =
    form.targetUrl.trim() && form.contactName.trim() && form.contactEmail.trim() &&
    form.claimDescription.trim() && declared && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr("");
    try {
      await submitCopyrightReport({ ...form, declarationAccepted: true });
      setDone(true);
    } catch (e) {
      setErr(e.message || "Couldn't submit your notice — please try again.");
    }
    setBusy(false);
  };

  return (
    <LegalShell title="Copyright Policy">
      <p>
        Scholar's Circle hosts study materials uploaded by students and educators. Uploaders
        must only share content they own or have permission to share — but if something on the
        platform infringes your copyright, we will act on a valid notice. You don't need an
        account to file one.
      </p>

      <h2 className="lg-h2">Ways to report</h2>
      <ul>
        <li><b>In-app</b> — on any material or space, tap ⋮ → Report → Copyright infringement (members only).</li>
        <li><b>Formal notice</b> — use the form below. Works for anyone, no account needed.</li>
        <li><b>WhatsApp</b> — message us directly at{" "}
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer">support</a> if the form doesn't fit your situation.</li>
      </ul>

      <h2 className="lg-h2">What happens next</h2>
      <ul>
        <li>Our moderation team reviews every notice.</li>
        <li>Valid notices result in the material being removed or made inaccessible.</li>
        <li>The uploader is notified and may submit a counter-notice if they believe the removal was a mistake (for example, if they hold a licence or the use is permitted). Submitting false notices can have consequences.</li>
        <li>Accounts that repeatedly upload infringing content are suspended or terminated.</li>
      </ul>

      <h2 className="lg-h2">Submit a takedown notice</h2>
      {done ? (
        <div className="lg-done">
          <div className="lg-done-t">Notice received ✓</div>
          <div className="lg-done-p">
            Thank you — our moderation team will review your notice and act on it. If we need
            anything else, we'll reach you through the contact you provided.
          </div>
        </div>
      ) : (
        <div className="lg-card">
          {err && <div className="lg-err">{err}</div>}
          <div className="lg-field">
            <label>Link to the material</label>
            <input
              type="url"
              placeholder="https://…/resources/xxxx or /folders/xxxx"
              value={form.targetUrl}
              onChange={set("targetUrl")}
            />
          </div>
          <div className="lg-hint">
            Paste the Scholar's Circle link to the infringing material or space.
          </div>
          <div className="lg-field">
            <label>Your full name</label>
            <input type="text" placeholder="Rights holder or authorised agent" value={form.contactName} onChange={set("contactName")} />
          </div>
          <div className="lg-field">
            <label>Contact — email or WhatsApp number</label>
            <input type="text" placeholder="Where we can reach you about this notice" value={form.contactEmail} onChange={set("contactEmail")} />
          </div>
          <div className="lg-field">
            <label>Describe the copyrighted work</label>
            <textarea
              placeholder="e.g. 'Lecture notes I wrote for BCH 201 at University of…' — identify the work and how this material infringes it."
              value={form.claimDescription}
              onChange={set("claimDescription")}
            />
          </div>
          <div className="lg-field">
            <label>Link to your original work (optional)</label>
            <input type="url" placeholder="https://… where the original can be seen" value={form.evidenceUrl} onChange={set("evidenceUrl")} />
          </div>
          <label className="lg-check">
            <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
            <span>
              I have a good-faith belief that the material described infringes my copyright (or the
              rights of someone I'm authorised to act for), the information in this notice is
              accurate, and I understand that false claims may have consequences.
            </span>
          </label>
          <button className="lg-submit" disabled={!canSubmit} onClick={submit}>
            {busy ? "Submitting…" : "Submit takedown notice"}
          </button>
        </div>
      )}

      <h2 className="lg-h2">Counter-notice</h2>
      <p>
        If your material was removed and you believe that was a mistake — for example, you hold
        the rights or a valid licence — contact us via{" "}
        <a href={WA_LINK} target="_blank" rel="noopener noreferrer">WhatsApp</a> with your
        username, the removed material, and why you believe the notice is wrong. We'll review and
        may restore the content if the claim is withdrawn or found invalid.
      </p>
    </LegalShell>
  );
}
