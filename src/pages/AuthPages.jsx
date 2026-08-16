import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

export default function AuthPages() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState(() => location.pathname === '/signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const signupEmailRef = useRef('');
  const signupUsernameRef = useRef('');
  const signupPasswordRef = useRef('');
  const signupConfirmPasswordRef = useRef('');

  useEffect(() => {
    if (location.pathname === '/signup') {
      setMode('signup');
    } else if (location.pathname === '/login') {
      setMode('login');
    }
  }, [location.pathname]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) throw authError;

      const sessionToken = data.session?.access_token || '';
      
      // Fetch app profile
      let appUser = null;
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        });
        const profile = await response.json();
        appUser = profile?.user || null;
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }

      if (appUser) {
        localStorage.setItem('scholars-circle-auth', JSON.stringify({ authUser: appUser, authToken: sessionToken }));
      }

      const redirectParam = new URLSearchParams(window.location.search).get('redirect');
      if (redirectParam && redirectParam.startsWith('/')) {
        window.location.href = redirectParam;
      } else {
        navigate('/app');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    const emailVal = (signupEmailRef.current?.value || email).trim();
    const usernameVal = (signupUsernameRef.current?.value || username).trim();
    const passwordVal = (signupPasswordRef.current?.value || password).trim();
    const confirmPasswordVal = (signupConfirmPasswordRef.current?.value || confirmPassword).trim();

    if (passwordVal !== confirmPasswordVal) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (passwordVal.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailVal,
        password: passwordVal,
        options: { data: { username: usernameVal, role: 'STUDENT' } },
      });

      if (signUpError) throw signUpError;

      const sessionToken = data.session?.access_token || '';
      
      if (sessionToken) {
        // Create profile
        try {
          await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/auth/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
            body: JSON.stringify({ email: emailVal, username: usernameVal, role: 'STUDENT' }),
          });
        } catch (err) {
          console.error('Profile creation failed:', err);
        }

        localStorage.setItem('scholars-circle-auth', JSON.stringify({ 
          authUser: { email: emailVal, username: usernameVal, role: 'STUDENT' }, 
          authToken: sessionToken 
        }));
        
        navigate('/app');
      } else {
        setInfo('Account created! Please check your email to confirm your account, then sign in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: `${window.location.origin}${new URLSearchParams(window.location.search).get('redirect') || '/app'}` 
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google.');
    }
  }

  async function handleForgotPassword() {
    const emailVal = email.trim();
    if (!emailVal) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailVal, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setInfo('Password reset link sent! Check your email to reset your password.');
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setInfo('Password updated successfully! You can now sign in with your new password.');
      setResetPasswordMode(false);
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  if (resetPasswordMode) {
    return (
      <main style={{ minHeight: '100vh', background: '#0A0D13', color: '#EDEFF5', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          a { color: inherit; text-decoration: none; }
          .auth-input {
            width: 100%; background: #151A24; border: 1px solid rgba(255,255,255,0.16); color: #EDEFF5;
            border-radius: 10px; padding: 13px 14px; font-size: 0.95rem; font-family: 'Manrope', sans-serif;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
          }
          .auth-input:focus { border-color: #FFD700; box-shadow: 0 0 0 3px rgba(79,142,247,0.14); outline: none; }
          .auth-btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            padding: 15px 26px; border-radius: 999px; font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 0.98rem;
            cursor: pointer; border: 1px solid transparent; transition: transform 0.15s ease, background 0.15s ease;
            white-space: nowrap;
          }
          .auth-btn-primary { background: #F5A623; color: #1A1300; }
          .auth-btn-primary:hover { background: #FFB838; }
        `}</style>

        <div style={{ width: '100%', maxWidth: 380 }}>
          <Link to="/?force_home=1" style={{ fontSize: '0.84rem', color: '#646E84', fontWeight: 600, display: 'inline-flex', gap: 6, marginBottom: 28, textDecoration: 'none' }}>
            {'<- Back to home'}
          </Link>

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>Set new password</h1>
            <p style={{ color: '#9AA3B5', fontSize: '0.94rem' }}>Enter your new password below.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>New password</label>
              <input
                className="auth-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Confirm new password</label>
              <input
                className="auth-input"
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
            <button onClick={handleResetPassword} disabled={loading} className="auth-btn auth-btn-primary" style={{ width: '100%', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Updating...' : 'Update password ->'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.88rem', color: '#9AA3B5' }}>
              <span onClick={() => { setResetPasswordMode(false); setMode('login'); }} style={{ color: '#F5A623', fontWeight: 700, cursor: 'pointer' }}>Back to sign in</span>
            </p>
          </div>

          {error && <p style={{ color: '#f87171', fontSize: '0.9rem', marginTop: 16, textAlign: 'center' }}>{error}</p>}
          {info && <p style={{ color: '#34d399', fontSize: '0.9rem', marginTop: 16, textAlign: 'center' }}>{info}</p>}
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0A0D13', color: '#EDEFF5', fontFamily: 'Manrope, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { color: inherit; text-decoration: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes counterspin { to { transform: rotate(-360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes sweep { from { transform: translateY(0); opacity: 1; } to { transform: translateY(420%); opacity: 0; } }
        @keyframes blink { 50% { opacity: 0; } }
        .auth-orbit-ring { animation: spin 70s linear infinite; }
        .auth-orbit-chip span { display: inline-block; animation: counterspin 70s linear infinite; }
        .auth-float-card { animation: float 6s ease-in-out infinite; }
        .auth-pulse-dot { animation: pulse 2s ease-in-out infinite; }
        .auth-scan-sweep { animation: sweep 2.6s ease-out 1; }
        .auth-cursor { animation: blink 1s steps(2) infinite; color: #FFD700; }
        .auth-input {
          width: 100%; background: #151A24; border: 1px solid rgba(255,255,255,0.16); color: #EDEFF5;
          border-radius: 10px; padding: 13px 14px; font-size: 0.95rem; font-family: 'Manrope', sans-serif;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .auth-input:focus { border-color: #FFD700; box-shadow: 0 0 0 3px rgba(79,142,247,0.14); outline: none; }
        .auth-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 15px 26px; border-radius: 999px; font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 0.98rem;
          cursor: pointer; border: 1px solid transparent; transition: transform 0.15s ease, background 0.15s ease;
          white-space: nowrap;
        }
        .auth-btn-primary { background: #F5A623; color: '#1A1300'; }
        .auth-btn-primary:hover { background: '#FFB838'; }
        .auth-google-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 12px; border-radius: 10px; font-size: 0.9rem;
          background: #151A24; border: 1px solid rgba(255,255,255,0.16); color: #EDEFF5;
          cursor: pointer; font-family: 'Manrope', sans-serif; font-weight: 600;
          transition: border-color 0.15s ease;
        }
        .auth-google-btn:hover { border-color: #9AA3B5; }
        .auth-shell { display: grid; grid-template-columns: 1fr 1fr; minHeight: '100vh'; }
        .auth-mobile-banner { display: none; }
        @media (max-width: 900px) {
          .auth-shell { grid-template-columns: 1fr !important; }
          .auth-visual-panel { display: none !important; }
          .auth-form-panel { padding: 32px 24px !important; min-height: 100vh; align-items: flex-start !important; padding-top: 60px !important; }
          .auth-mobile-banner { display: flex !important; align-items: center; gap: 10px; margin-bottom: 28px; }
        }
        @media (max-width: 560px) {
          .auth-form-panel { padding: 24px 20px !important; }
        }
      `}</style>

      <div className="auth-shell">
        {/* Visual Panel */}
        <div className="auth-visual-panel" style={{
          position: 'relative',
          background: 'radial-gradient(circle at 30% 20%, rgba(79,142,247,0.14), transparent 55%), radial-gradient(circle at 80% 85%, rgba(245,166,35,0.10), transparent 50%), #11151E',
          borderRight: '1px solid rgba(255,255,255,0.09)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '40px 48px',
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
            WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 72%)',
            maskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 72%)',
          }} />
          <div className="auth-scan-sweep" style={{ position: 'absolute', left: 0, right: 0, top: '-30%', height: '30%', background: 'linear-gradient(180deg, rgba(79,142,247,0.10), transparent)', pointerEvents: 'none' }} />

          {/* Top: Logo + boot line */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: '#EDEFF5' }}>
              <img src="/images/logo.png" alt="Scholar's Circle" style={{ width: 28, height: 28, borderRadius: 6 }} />
              Scholar's Circle
            </Link>
            <div style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', color: '#646E84', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{'>>> connecting to your circle'}</span>
              <span className="auth-cursor">_</span>
            </div>
          </div>

          {/* Center: Orbit + Ring */}
          <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 340, height: 340 }}>
              <div className="auth-orbit-ring" style={{ position: 'absolute', inset: 0, border: '1px dashed rgba(255,255,255,0.16)', borderRadius: '50%' }}>
                {[
                  { top: '-12px', left: '50%', transform: 'translateX(-50%)', label: 'ANA 111' },
                  { top: '50%', left: 'auto', right: '-12px', transform: 'translateY(-50%)', label: 'PHY 121' },
                  { top: 'auto', bottom: '-12px', left: '50%', transform: 'translateX(-50%)', label: 'BHM 111' },
                  { top: '50%', left: '-12px', right: 'auto', transform: 'translateY(-50%)', label: 'PAT 211' },
                ].map((c, i) => (
                  <span key={i} className="auth-orbit-chip" style={{ position: 'absolute', top: c.top, left: c.left, right: c.right, bottom: c.bottom, transform: c.transform, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: '#9AA3B5', background: '#151A24', border: '1px solid rgba(255,255,255,0.16)', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    <span>{c.label}</span>
                  </span>
                ))}
              </div>
              <div style={{ position: 'absolute', width: 190, height: 190, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#11151E', boxShadow: '0 0 0 1px rgba(255,255,255,0.16), 0 0 60px rgba(79,142,247,0.18)' }}>
                <svg viewBox="0 0 190 190" width="190" height="190" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                  <defs>
                    <linearGradient id="authRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFD700" />
                      <stop offset="100%" stopColor="#F5A623" />
                    </linearGradient>
                  </defs>
                  <circle fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="8" cx="95" cy="95" r="80" />
                  <circle
                    fill="none" strokeWidth="8" strokeLinecap="round" stroke="url(#authRingGrad)"
                    cx="95" cy="95" r="80"
                    strokeDasharray="503"
                    strokeDashoffset={mode === 'signup' ? 503 - (503 * 0.12) : 503 - (503 * 0.68)}
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.2,0.7,0.2,1)' }}
                  />
                </svg>
                <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '0 20px' }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.2, color: '#EDEFF5' }}>
                    {mode === 'signup' ? 'Join the Circle.' : 'Welcome back.'}
                  </h2>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#9AA3B5', marginTop: 6, display: 'block', letterSpacing: '0.03em' }}>
                    {mode === 'signup' ? '2-DAY FREE TRIAL - NO CARD' : 'YOUR STREAK IS WAITING'}
                  </span>
                </div>
              </div>
              <div className="auth-float-card" style={{ position: 'absolute', top: '6%', right: '0%', background: '#151A24', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', boxShadow: '0 12px 28px rgba(0,0,0,0.4)', color: '#F5A623' }}>92% mastery</div>
              <div className="auth-float-card" style={{ position: 'absolute', bottom: '8%', left: '-4%', background: '#151A24', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', boxShadow: '0 12px 28px rgba(0,0,0,0.4)', color: '#FF5470', animationDelay: '1.2s' }}>Next: Embryology</div>
            </div>
          </div>

          {/* Bottom: Pulse stat */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#646E84' }}>
              <span className="auth-pulse-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#3DD68C', marginRight: 8, boxShadow: '0 0 0 3px rgba(61,214,140,0.18)' }} />
              1,284 medical students studying right now
            </span>
          </div>
        </div>

        {/* Form Panel */}
        <div className="auth-form-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 32px 48px' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            {/* Mobile brand banner */}
            <div className="auth-mobile-banner">
              <img src="/images/logo.png" alt="Scholar's Circle" style={{ width: 32, height: 32, borderRadius: 6 }} />
              <div>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#EDEFF5', display: 'block' }}>Scholar's Circle</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#646E84' }}>Cram less. Remember more.</span>
              </div>
            </div>

            <Link to="/?force_home=1" style={{ fontSize: '0.84rem', color: '#646E84', fontWeight: 600, display: 'inline-flex', gap: 6, marginBottom: 28, textDecoration: 'none' }}>
              {'<- Back to home'}
            </Link>

            {mode === 'login' ? (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>Welcome back</h1>
              <p style={{ color: '#9AA3B5', fontSize: '0.94rem' }}>Your mastery ring missed you. Let's get back to it.</p>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Email</label>
                <input
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))}
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="auth-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    style={{ paddingRight: 40 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#646E84', cursor: 'pointer', padding: 4, fontSize: 14 }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: -4 }}>
                <span onClick={handleForgotPassword} style={{ color: '#F5A623', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
                  Forgot password?
                </span>
              </div>

              <button type="submit" disabled={loading} className="auth-btn auth-btn-primary" style={{ width: '100%', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Signing in...' : 'Sign in ->'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', color: '#646E84', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
              or
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
            </div>

            <button onClick={handleGoogleSignIn} className="auth-google-btn">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <p style={{ textAlign: 'center', marginTop: 26, fontSize: '0.9rem', color: '#9AA3B5' }}>
              No account? <span onClick={() => { setMode('signup'); setError(''); setInfo(''); }} style={{ color: '#F5A623', fontWeight: 700, cursor: 'pointer' }}>Sign up</span>
            </p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>Join the Circle</h1>
              <p style={{ color: '#9AA3B5', fontSize: '0.94rem' }}>Start practicing in minutes. 2-day free trial, no card needed.</p>
            </div>

            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Username</label>
                <input
                  className="auth-input"
                  ref={signupUsernameRef}
                  placeholder="adeola_okafor"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Email</label>
                <input
                  className="auth-input"
                  ref={signupEmailRef}
                  type="email"
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="auth-input"
                    ref={signupPasswordRef}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    style={{ paddingRight: 40 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#646E84', cursor: 'pointer', padding: 4, fontSize: 14 }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#646E84', marginBottom: 8 }}>Confirm password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="auth-input"
                    ref={signupConfirmPasswordRef}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    style={{ paddingRight: 40 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#646E84', cursor: 'pointer', padding: 4, fontSize: 14 }}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <label style={{ fontSize: '0.88rem', color: '#9AA3B5', display: 'flex', gap: 9, alignItems: 'flex-start', lineHeight: 1.4 }}>
                <input type="checkbox" style={{ marginTop: 3, accentColor: '#F5A623', width: 15, height: 15, flexShrink: 0 }} required />
                <span>I agree to the <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#FFD700', fontWeight: 600 }}>Terms of Service</a> and <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#FFD700', fontWeight: 600 }}>Privacy Policy</a>.</span>
              </label>

              <button type="submit" disabled={loading} className="auth-btn auth-btn-primary" style={{ width: '100%', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Creating account...' : 'Start your 2-day free trial ->'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', color: '#646E84', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
              or
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
            </div>

            <button onClick={handleGoogleSignIn} className="auth-google-btn">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign up with Google
            </button>

            <p style={{ textAlign: 'center', marginTop: 26, fontSize: '0.9rem', color: '#9AA3B5' }}>
              Already have an account? <span onClick={() => { setMode('login'); setError(''); setInfo(''); }} style={{ color: '#F5A623', fontWeight: 700, cursor: 'pointer' }}>Sign in</span>
            </p>
          </>
        )}

        {error && <p style={{ color: '#f87171', fontSize: '0.9rem', marginTop: 16, textAlign: 'center' }}>{error}</p>}
        {info && <p style={{ color: '#34d399', fontSize: '0.9rem', marginTop: 16, textAlign: 'center' }}>{info}</p>}

        {/* Contact Support */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.09)', textAlign: 'center' }}>
          <p style={{ color: '#646E84', fontSize: '0.82rem', marginBottom: 12 }}>Having a problem?</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/2348061234567"
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6, 
                padding: '8px 16px', 
                borderRadius: 8, 
                background: '#25D366', 
                color: '#fff', 
                fontSize: '0.85rem', 
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
            <a
              href="tel:+2348061234567"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6, 
                padding: '8px 16px', 
                borderRadius: 8, 
                background: '#151A24', 
                border: '1px solid rgba(255,255,255,0.16)', 
                color: '#EDEFF5', 
                fontSize: '0.85rem', 
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Call Us
            </a>
          </div>
        </div>
      </div>
      </div>
      </div>
    </main>
  );
}
