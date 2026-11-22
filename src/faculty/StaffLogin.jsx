import { useState } from "react";
import { GraduationCap, Check, BookOpen } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { ensureAppSession } from "../lib/authToken.js";
import { STUDENT_APP_URL, STUDENT_SIGNUP_URL } from "./env.js";
import "./faculty.css";

/**
 * Staff sign-in for the faculty portal. Same auth backend as the main app —
 * Supabase sign-in, then ensureAppSession() fetches the app profile and
 * writes the scholars-circle-auth blob. Students get bounced by the
 * FacultyApp role gate after sign-in; invite-code signup for new staff
 * stays on the main site's signup page.
 */
export default function StaffLogin({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const studentAppUrl = STUDENT_APP_URL;
  const signupUrl = STUDENT_SIGNUP_URL;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (authError) throw authError;
      // Drop any stale blob first — ensureAppSession's fast path prefers the
      // stored authUser over the fresh session, so an earlier sign-in on this
      // origin would shadow the account just entered.
      try { localStorage.removeItem("scholars-circle-auth"); } catch { /* noop */ }
      const user = await ensureAppSession();
      if (!user) {
        setError("Signed in, but your profile could not be loaded. Please try again.");
        return;
      }
      onSignedIn?.();
    } catch (err) {
      setError(err.message || "Invalid credentials. Please check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app dark fc-auth">
      <aside className="fc-auth-side">
        <div className="fc-brand">
          <span className="fc-brand-logo"><BookOpen size={17} /></span>
          <div><b>Scholar's Circle</b><span>Staff</span></div>
        </div>
        <h2>Run your teaching from one place.</h2>
        <p>The staff workspace for lecturers and admins on Scholar's Circle.</p>
        <div className="fc-auth-points">
          <div><Check size={16} /> Classrooms, live sessions and assignments</div>
          <div><Check size={16} /> Question banks and teaching resources</div>
          <div><Check size={16} /> Insights on how students use your materials</div>
        </div>
      </aside>
      <main className="fc-auth-main">
        <div className="fc-auth-card">
          <GraduationCap size={34} style={{ color: "var(--app-accent)" }} />
          <h1>Staff sign in</h1>
          <p>Use your lecturer or admin account.</p>
          <form className="fc-login-form" onSubmit={submit}>
            <input
              className="auth-input"
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="auth-input"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="fc-error">{error}</p>}
            <button className="fc-btn" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="fc-gate-links">
            <a href={signupUrl}>Need a staff account? Sign up with an invite code</a>
            <a href={studentAppUrl}>Student? Open Scholar's Circle</a>
          </div>
        </div>
      </main>
    </div>
  );
}
