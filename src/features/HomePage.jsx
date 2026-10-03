import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import PricingSection from './homepage/PricingSection';

const TESTIMONIALS = [
  { quote: 'I stopped re-reading the same Anatomy chapter and started actually testing myself. My mastery ring doesn\'t lie to me.', by: '— 200L Medicine & Surgery' },
  { quote: 'Circle to Ask saved me during ANA 111 revision. I could lasso a diagram at 1am and finally understand the brachial plexus.', by: '— 100L Medicine & Surgery' },
  { quote: 'The streak feature is the only reason I opened my notes every single day before our first professional exam.', by: '— 300L Physiology' },
];

const FEATURES = [
  { icon: '👥', title: 'Study live with friends', desc: 'Drop a 6-letter code in the group chat — up to 8 friends answer the same questions at the same time, with voice chat, XP wagers, and whoever got it right teaching the rest.' },
  { icon: '⭕', title: 'Ask your notes anything', desc: 'Circle any diagram, table, or paragraph in your lecture PDF and get an answer grounded in that exact page — like leaning over to ask the sharpest person in your study group.' },
  { icon: '🎓', title: 'Sit the exam before the exam', desc: 'Timed mock exams built from your own materials — then a results summary that shows exactly which topics failed you, before the real CBT does.' },
  { icon: '🧠', title: 'Review at the right moment', desc: 'A smart review engine tracks everything you\'ve practiced and brings back exactly what you\'re about to forget — not what you already know cold.' },
  { icon: '🔥', title: 'Practice that feels like a game', desc: 'Hearts, combos, XP and streaks turn revision into something you actually want to open at midnight — not something you dread before exams.' },
  { icon: '📚', title: 'Your department\'s shelf', desc: 'Past questions and shared materials for Medicine, Nursing, Pharmacy, Physiology and more — filtered to your department and level.' },
];

const SHOWCASE = [
  { img: '/images/showcase/circle-mark.jpg', tag: 'Circle to Ask', caption: 'Draw a circle around anything in your PDF' },
  { img: '/images/showcase/circle-answer.jpg', tag: 'Circle to Ask', caption: 'Get an answer grounded in that exact page' },
  { img: '/images/showcase/live-lobby.jpg', tag: 'Live with friends', caption: 'Share a code — everyone answers together, with voice' },
  { img: '/images/showcase/exam-results.jpg', tag: 'Exam simulator', caption: 'See exactly which topics failed you — before the real exam' },
  { img: '/images/showcase/survival.jpg', tag: 'Streak Survival', caption: 'Hearts, XP and streaks keep you coming back' },
];

const TIMELINE = [
  { time: '7:42 AM', title: 'Upload today\'s anatomy lecture slide', desc: 'Straight from your phone, right after the dissection hall — no scanning, no typing it out.', exam: false },
  { time: '7:43 AM', title: 'Circle to Ask the diagram you didn\'t catch', desc: 'Lasso the brachial plexus diagram, ask your question, get an answer grounded in that exact page.', exam: false },
  { time: '8:15 AM', title: 'Five practice questions, generated on the spot', desc: 'From that exact slide — clinical vignettes and practice questions, not generic trivia pulled off the internet.', exam: false },
  { time: '11:50 PM', title: 'Smart review resurfaces the three things you\'ll forget', desc: 'The embryology facts you\'re actually likely to miss in tomorrow\'s CBT — not a random reshuffle.', exam: true },
];

const FAQS = [
  { q: 'Does this work with my school\'s curriculum?', a: 'Yes. Scholar\'s Circle generates practice questions from your own lecture PDFs and course material — so it\'s aligned to whatever your lecturers teach, whether you\'re at LCU, UI, OAU, UNILORIN, or anywhere else. Upload your notes, and the AI does the rest.' },
  { q: 'Can I use it during clinical rotations?', a: 'Absolutely. Install Scholar\'s Circle straight from your browser — no App Store needed — and it keeps working offline during ward rounds, clinic postings, or your commute to the teaching hospital. Your review queue syncs the moment you\'re back online.' },
  { q: 'Is this only for MBBS students?', a: 'No. While we built it as MBBS students, Scholar\'s Circle works for Nursing, Pharmacy, Physiology, Medical Laboratory Science, Anatomy, Public Health, Radiography, and other health-science programs. If your course has PDFs and past questions, it works for you.' },
  { q: 'Will it replace my textbook?', a: 'No — it complements it. Textbooks give you the foundation; Scholar\'s Circle turns that foundation into memory you can rely on. Think of it as the bridge between reading Gray\'s Anatomy and actually remembering what you read when the examiner asks.' },
  { q: 'How is this different from Anki?', a: 'Anki is powerful but requires you to manually create every flashcard — hours of work most medical students don\'t have. Scholar\'s Circle uses AI to generate practice questions directly from your lecture PDFs. No card creation. No copying diagrams by hand. Just upload and practice.' },
  { q: 'What if I get a question wrong?', a: 'The review engine immediately marks that topic as a weak area and brings it back sooner — before your next CBT or professional exam. You\'ll also see exactly which subjects and organ systems need more attention on your mastery ring.' },
];

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

export default function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [ringAnimated, setRingAnimated] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const windowWidth = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)[0];
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const root = document.getElementById('root');
    const onScroll = () => {
      if (!root) return;
      const max = root.scrollHeight - root.clientHeight;
      setScrollPct(max > 0 ? (root.scrollTop / max) * 100 : 0);
      setIsScrolled(root.scrollTop > 30);
      setShowCta(root.scrollTop > 700 && max - root.scrollTop > 400);
    };
    if (root) {
      root.addEventListener('scroll', onScroll, { passive: true });
      return () => root.removeEventListener('scroll', onScroll);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setRingAnimated(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);

    if (window.__deferredPrompt) setDeferredPrompt(window.__deferredPrompt);

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); window.__deferredPrompt = e; };
    window.addEventListener('beforeinstallprompt', handler);

    const customHandler = (e) => { if (e.detail) setDeferredPrompt(e.detail); };
    window.addEventListener('pwa-install-available', customHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa-install-available', customHandler);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPrompt || window.__deferredPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setDeferredPrompt(null);
    window.__deferredPrompt = null;
    if (outcome === 'accepted') setIsInstalled(true);
  };

  const [featuresRef, featuresInView] = useInView(0.1);
  const [testiRef, testiInView] = useInView(0.1);

  const ink = '#0a0a0a';
  const inkSoft = '#121214';
  const inkCard = '#17171b';
  const line = 'rgba(255,255,255,0.08)';
  const lineStrong = 'rgba(255,255,255,0.14)';
  const text = '#F2F4F8';
  const textDim = '#A8B0C4';
  const textFaint = '#707A90';
  const gold = '#F5A623';
  const goldBright = '#FFD700';
  const coral = '#FF5470';
  const green = '#3DD68C';

  const eyebrow = {
    fontFamily: 'Manrope, sans-serif', fontSize: '0.8rem', fontWeight: 800,
    color: gold, letterSpacing: '0.1em', textTransform: 'uppercase',
    marginBottom: 14, display: 'block',
  };
  const h2Style = {
    fontSize: 'clamp(1.85rem, 3.4vw, 2.6rem)', fontWeight: 700,
    fontFamily: 'Sora, sans-serif', lineHeight: 1.15, letterSpacing: '-0.02em',
  };
  const wrapStyle = { maxWidth: 1180, margin: '0 auto', padding: '0 28px' };

  return (
    <main style={{ background: ink, color: text, fontFamily: 'Manrope, sans-serif', fontSize: 17, lineHeight: 1.65, minHeight: '100dvh', overflowX: 'clip' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        a { color: inherit; text-decoration: none; }
        ul { margin: 0; padding: 0; list-style: none; }
        h1, h2, h3 { font-family: 'Sora', sans-serif; margin: 0; letter-spacing: -0.02em; }
        p { margin: 0; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes counterspin { to { transform: rotate(-360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

        .orbit-ring { animation: spin 60s linear infinite; }
        .orbit-chip span { display: inline-block; animation: counterspin 60s linear infinite; }
        .float-card { animation: float 6s ease-in-out infinite; }
        .pulse-dot { animation: pulse 2s ease-in-out infinite; }
        .fade-in { animation: fadeIn 0.6s ease both; }

        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px 20px; border-radius: 999px;
          font-family: 'Manrope', sans-serif; font-weight: 800; font-size: 0.92rem;
          cursor: pointer; border: 1px solid transparent;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
          white-space: nowrap;
        }
        .btn:hover { transform: translateY(-1px); }
        .btn-ghost { color: ${text}; border-color: ${lineStrong}; background: transparent; }
        .btn-ghost:hover { border-color: ${textDim}; }
        .btn-primary { background: ${gold}; color: #1A1300; }
        .btn-primary:hover { background: #FFB838; }
        .btn-sm { padding: 8px 16px; font-size: 0.85rem; }
        .btn-lg { padding: 15px 28px; font-size: 1rem; }

        .feature-card { transition: border-color 0.2s ease, transform 0.2s ease; }
        .feature-card:hover { border-color: ${lineStrong}; transform: translateY(-2px); }

        .showcase-scroll { display: flex; gap: 18px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 4px 28px 20px; }
        .showcase-scroll::-webkit-scrollbar { display: none; }
        .shot-card { flex: 0 0 220px; scroll-snap-align: start; }
        .shot-frame { border-radius: 22px; overflow: hidden; border: 1px solid ${lineStrong}; background: #000; box-shadow: 0 18px 44px rgba(0,0,0,0.45); }
        .shot-frame img { display: block; width: 100%; height: auto; }
        @media (min-width: 1100px) { .shot-card { flex: 0 0 236px; } .showcase-scroll { justify-content: center; overflow-x: visible; flex-wrap: wrap; } }

        .sticky-cta { position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 55; display: none; }
        @media (max-width: 900px) { .sticky-cta.show { display: flex; } }
        @media (min-width: 901px) { .sticky-cta { display: none !important; } }

        @media (max-width: 900px) { .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; } .hero-visual { height: 280px; order: -1; } .nav-links { display: none !important; } .nav-actions { display: none !important; } .menu-btn { display: flex !important; } }
        @media (min-width: 901px) { .menu-btn { display: none !important; } .mobile-menu { display: none !important; } }
        @media (max-width: 760px) {
          .feature-grid { grid-template-columns: 1fr !important; }
          .compare { grid-template-columns: 1fr !important; }
          .testimonial-scroll { display: flex !important; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 12px; padding-left: calc(12px + env(safe-area-inset-left)); padding-right: calc(12px + env(safe-area-inset-right)); }
          .testimonial-scroll::-webkit-scrollbar { display: none; }
          .testimonial-scroll > * { min-width: 74vw; flex-shrink: 0; scroll-snap-align: start; }
          .orbit-ring { width: 280px !important; height: 280px !important; }
          .hero-ring { width: 180px !important; height: 180px !important; }
          .hero-ring svg { width: 180px !important; height: 180px !important; }
          section { padding: 72px 0 !important; }
        }
        @media (min-width: 761px) {
          .testimonial-scroll { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 22px; }
        }
        @media (max-width: 560px) { .wrap { padding: 0 20px !important; } section { padding: 64px 0 !important; } .cta-band { padding: 44px 24px !important; } .hero-section { padding: 48px 0 32px !important; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } html { scroll-behavior: auto; } }
      `}</style>

      {/* Scroll progress rail */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: line, zIndex: 60 }}>
        <div style={{ height: '100%', width: `${scrollPct}%`, background: `linear-gradient(90deg, ${goldBright}, ${gold})`, transition: 'width 0.08s linear' }} />
      </div>

      {/* Nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: isScrolled ? 'rgba(10,10,10,0.78)' : 'transparent', backdropFilter: isScrolled ? 'blur(14px) saturate(140%)' : 'none', borderBottom: `1px solid ${isScrolled ? line : 'transparent'}`, transition: 'all 0.3s ease', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: text }}>
            <img src="/images/logo.png" alt="Scholar's Circle" style={{ width: 28, height: 28, borderRadius: 6 }} />
            Scholar's Circle
          </Link>
          <nav className="nav-links" style={{ display: 'flex', gap: 32 }}>
            {[
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how' },
              { label: 'FAQ', href: '#faq' },
              { label: 'Pricing', href: '#pricing' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: '0.92rem', color: textDim, fontWeight: 700, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>{l.label}</a>
            ))}
            <Link to="/resources" style={{ fontSize: '0.92rem', color: textDim, fontWeight: 700, transition: 'color 0.15s ease' }}
              onMouseEnter={e => e.currentTarget.style.color = text}
              onMouseLeave={e => e.currentTarget.style.color = textDim}>Resources</Link>
          </nav>
          <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
            <Link to="/signup" className="btn btn-primary btn-sm">Start free trial</Link>
          </div>
          <button className="menu-btn" onClick={() => setMenuOpen(v => !v)} style={{ display: 'none', background: 'none', border: `1px solid ${lineStrong}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: text, fontSize: 18, alignItems: 'center', justifyContent: 'center' }}>
            {menuOpen ? '\u2715' : '\u2630'}
          </button>
        </div>
        {menuOpen && (
          <div className="mobile-menu" style={{ borderTop: `1px solid ${line}`, background: ink, padding: '16px 28px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how' },
              { label: 'FAQ', href: '#faq' },
              { label: 'Pricing', href: '#pricing' },
            ].map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} style={{ fontSize: '0.95rem', color: textDim, fontWeight: 700, padding: '6px 0' }}>{l.label}</a>
            ))}
            <Link to="/resources" onClick={() => setMenuOpen(false)} style={{ fontSize: '0.95rem', color: textDim, fontWeight: 700, padding: '6px 0' }}>Resources</Link>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Log in</Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)} className="btn btn-primary btn-sm" style={{ flex: 1 }}>Start free trial</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="hero-section" style={{ padding: '80px 0 48px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 520, height: 520, background: `radial-gradient(circle, rgba(245,166,35,0.14), transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ ...wrapStyle, position: 'relative', zIndex: 1 }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 56, alignItems: 'center' }}>
            {/* Left */}
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
                {['ANA 111', 'PHY 121', 'BHM 111'].map(c => (
                  <span key={c} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.03em', color: textDim, border: `1px solid ${lineStrong}`, borderRadius: 999, padding: '5px 11px' }}>{c}</span>
                ))}
              </div>
              <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 3.85rem)', fontWeight: 800, lineHeight: 1.04, marginBottom: 22, fontFamily: 'Sora, sans-serif' }}>
                Cram less.<br />
                <span style={{ color: goldBright }}>Remember</span> more.<br />
                Walk into the hall <span style={{ color: gold }}>ready.</span>
              </h1>
              <p style={{ fontSize: '1.12rem', color: textDim, maxWidth: 480, marginBottom: 30, lineHeight: 1.7 }}>
                Your lecture PDFs become practice questions and smart reviews — built by MBBS students who got tired of reading a chapter four times and still blanking in the exam hall.
              </p>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                <Link to="/signup" className="btn btn-primary btn-lg">Start your 2-day free trial →</Link>
                <a href="#how" className="btn btn-ghost btn-lg">See how it works</a>
              </div>
              <p style={{ fontSize: '0.82rem', color: textFaint, fontWeight: 600 }}>No card needed · For medical & health-science students</p>
            </div>

            {/* Right — Mastery ring + orbit */}
            <div className="hero-visual" style={{ position: 'relative', height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="orbit-ring" style={{ position: 'absolute', width: 380, height: 380, border: `1px dashed ${lineStrong}`, borderRadius: '50%' }}>
                {[
                  { top: '-13px', left: '50%', transform: 'translateX(-50%)', label: 'ANA 111' },
                  { top: 'auto', bottom: '-13px', left: '50%', transform: 'translateX(-50%)', label: 'BHM 111' },
                ].map((c, i) => (
                  <span key={i} className="orbit-chip" style={{ position: 'absolute', top: c.top, left: c.left, right: c.right, bottom: c.bottom, transform: c.transform, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: textDim, background: inkSoft, border: `1px solid ${lineStrong}`, padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    <span>{c.label}</span>
                  </span>
                ))}
              </div>
              <div className="hero-ring" style={{ position: 'relative', width: 230, height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 230 230" width="230" height="230" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                  <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={goldBright} />
                      <stop offset="100%" stopColor={gold} />
                    </linearGradient>
                  </defs>
                  <circle fill="none" stroke={line} strokeWidth="10" cx="115" cy="115" r="100" />
                  <circle
                    fill="none" strokeWidth="10" strokeLinecap="round"
                    stroke="url(#ringGradient)"
                    cx="115" cy="115" r="100"
                    strokeDasharray="628"
                    strokeDashoffset={ringAnimated ? 628 - (628 * 0.68) : 628}
                    style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.2,0.7,0.2,1)' }}
                  />
                </svg>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '2.3rem', display: 'block', color: text }}>68%</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: textDim, letterSpacing: '0.04em', marginTop: 2, display: 'block' }}>MASTERED · ANATOMY</span>
                </div>
              </div>
              <div className="float-card" style={{ position: 'absolute', top: '6%', right: '4%', background: inkCard, border: `1px solid ${lineStrong}`, borderRadius: 10, padding: '9px 13px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 500, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', color: gold }}>+12 XP</div>
              <div className="float-card" style={{ position: 'absolute', bottom: '10%', left: '0%', background: inkCard, border: `1px solid ${lineStrong}`, borderRadius: 10, padding: '9px 13px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 500, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', color: coral, animationDelay: '1.1s' }}>🔥 4-day streak</div>
            </div>
          </div>

          {/* Ticker */}
          <div style={{ marginTop: 54, paddingTop: 22, borderTop: `1px solid ${line}`, display: 'flex', gap: 28, flexWrap: 'wrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: textFaint }}>
            <span><span className="pulse-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: green, marginRight: 7, boxShadow: `0 0 0 3px rgba(61,214,140,0.18)` }} /><b style={{ color: textDim }}>Free forever</b> — no card, no catch</span>
            <span><b style={{ color: textDim }}>2-day full trial</b> of every premium feature</span>
            <span>Built by MBBS students at <b style={{ color: textDim }}>LCU</b></span>
          </div>
        </div>
      </section>

      {/* See it in action — real screenshots */}
      <section style={{ padding: '72px 0', background: inkSoft, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ ...wrapStyle, maxWidth: 640, marginBottom: 36, textAlign: 'left' }}>
            <span style={eyebrow}>Straight from the app</span>
            <h2 style={h2Style}>See it in action.</h2>
            <p style={{ color: textDim, marginTop: 12, fontSize: '1.05rem' }}>Real screens, real questions, real group sessions — no mockups.</p>
          </div>
          <div className="showcase-scroll">
            {SHOWCASE.map((s, i) => (
              <div key={i} className="shot-card">
                <div className="shot-frame">
                  <img src={s.img} alt={`${s.tag} — ${s.caption}`} loading="lazy" />
                </div>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: gold, marginTop: 12 }}>{s.tag}</p>
                <p style={{ fontSize: '0.9rem', color: textDim, lineHeight: 1.5, marginTop: 4 }}>{s.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why We Built This */}
      <section style={{ padding: '96px 0', background: inkSoft, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
        <div style={wrapStyle}>
          <span style={eyebrow}>Why we built this</span>
          <h2 style={{ ...h2Style, maxWidth: 640, marginBottom: 24 }}>The textbook doesn't fail you. Your memory does.</h2>
          <p style={{ maxWidth: 680, color: textDim, fontSize: '1.1rem', marginBottom: 48, lineHeight: 1.7 }}>
            Photocopied past questions from the medical library. A WhatsApp group that goes quiet two days before the professional exam. Reading Gray's Anatomy three times and still blanking on the one question that mattered. <b style={{ color: text, fontWeight: 800 }}>We lived through all of it as MBBS students</b> — and built the tool we wished existed.
          </p>
          <div className="compare" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, border: `1px solid ${lineStrong}`, borderRadius: 18, overflow: 'hidden', background: lineStrong }}>
            <div style={{ background: inkSoft, padding: '32px 28px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 20, display: 'inline-block', padding: '5px 12px', borderRadius: 8, color: textFaint, background: 'rgba(255,255,255,0.05)' }}>The old way</span>
              {['Read the anatomy chapter once. Forget half of it by Friday.', 'Hunt for past questions in a crowded medical WhatsApp group.', "Find out you got it wrong — after the professional exam, not before.", 'Study alone, with no idea where you actually stand in your cohort.'].map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 16, fontSize: '0.98rem', color: textFaint }}>
                  <span style={{ flexShrink: 0, fontWeight: 800 }}>×</span>{t}
                </li>
              ))}
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(245,166,35,0.07), transparent)', padding: '32px 28px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 20, display: 'inline-block', padding: '5px 12px', borderRadius: 8, color: gold, background: 'rgba(245,166,35,0.12)' }}>With Scholar's Circle</span>
              {['Smart review brings back what you\'re about to forget — before the next CBT catches you.', 'Practice questions generated from your actual course material, ready in seconds.', 'See exactly which topic to fix — anatomy, pharmacology, pathology — the moment you get it wrong.', 'A mastery ring that shows your real standing, by subject and organ system.'].map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 16, fontSize: '0.98rem', color: text }}>
                  <span style={{ flexShrink: 0, fontWeight: 800, color: green }}>✓</span>{t}
                </li>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" ref={featuresRef} style={{ padding: '96px 0' }}>
        <div style={wrapStyle}>
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <span style={eyebrow}>What's inside</span>
            <h2 style={h2Style}>Everything you need between the lecture hall and the professional exam.</h2>
          </div>
          <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="feature-card" style={{
                opacity: featuresInView ? 1 : 0,
                transform: featuresInView ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms, border-color 0.2s ease`,
                background: inkCard, border: `1px solid ${line}`, borderRadius: 18, padding: 32,
              }}>
                <span style={{ fontSize: 26, marginBottom: 16, display: 'block' }}>{f.icon}</span>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10, fontFamily: 'Sora, sans-serif', color: text }}>{f.title}</h3>
                <p style={{ color: textDim, fontSize: '1rem', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works — Timeline */}
      <section id="how" style={{ padding: '96px 0', background: inkSoft, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
        <div style={wrapStyle}>
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <span style={eyebrow}>How it actually works</span>
            <h2 style={h2Style}>A normal Tuesday in med school, with Scholar's Circle.</h2>
          </div>
          <div style={{ position: 'relative', maxWidth: 680 }}>
            <div style={{ position: 'absolute', left: 67, top: 6, bottom: 6, width: 1, background: lineStrong }} />
            {TIMELINE.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '67px 1fr', gap: 24, marginBottom: 34, position: 'relative' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: t.exam ? coral : textFaint, textAlign: 'right', paddingTop: 2 }}>{t.time}{t.exam && <br />}{t.exam && 'night before'}</div>
                <div style={{ position: 'absolute', left: 62, top: 5, width: 11, height: 11, borderRadius: '50%', background: ink, border: `2px solid ${i === TIMELINE.length - 1 ? coral : gold}` }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6, fontFamily: 'Sora, sans-serif', color: text }}>{t.title}</h3>
                  <p style={{ color: textDim, fontSize: '0.98rem', lineHeight: 1.65 }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section ref={testiRef} style={{ padding: '80px 0' }}>
        <div style={wrapStyle}>
          <div style={{ maxWidth: 640, marginBottom: 36 }}>
            <span style={eyebrow}>From the reading rooms of LCU</span>
            <h2 style={h2Style}>Medical students who got there with us.</h2>
          </div>
          <div className="testimonial-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{
                opacity: testiInView ? 1 : 0,
                transform: testiInView ? 'translateY(0)' : 'translateY(16px)',
                transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`,
                background: inkCard, border: `1px solid ${line}`, borderLeft: `3px solid ${gold}`, borderRadius: 14, padding: '22px 20px',
              }}>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 12, color: text }}>"{t.quote}"</p>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: textFaint, margin: 0 }}>{t.by}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={eyebrow}>Questions students ask</span>
            <h2 style={{ ...h2Style, color: text }}>Frequently Asked Questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQS.map((f, i) => (
              <div key={i} style={{ background: inkCard, border: `1px solid ${openFaq === i ? lineStrong : line}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s ease' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: text, fontFamily: 'Manrope, sans-serif', fontSize: '1rem', fontWeight: 700 }}
                >
                  <span>{f.q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, color: textDim, transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div style={{ maxHeight: openFaq === i ? '300px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                  <p style={{ padding: '0 22px 20px', color: textDim, fontSize: '0.95rem', lineHeight: 1.7 }}>{f.a}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <p style={{ color: textFaint, fontSize: '0.88rem', marginBottom: 14 }}>Still have questions?</p>
            <a href="https://wa.me/2349028617178" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chat with us on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Install App */}
      <section style={{ padding: '56px 0', borderTop: `1px solid ${line}` }}>
        <div style={wrapStyle}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <span style={eyebrow}>Works on your phone</span>
            <h2 style={{ ...h2Style, fontSize: 'clamp(1.5rem, 3vw, 2.1rem)' }}>Installs in seconds — no App Store needed</h2>
            <p style={{ color: textDim, fontSize: '0.92rem', marginTop: 10 }}>Add it to your home screen and it works offline — even in the wards where there's no signal.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, minmax(0, 380px))', gap: 14, justifyContent: 'center', maxWidth: 780, margin: '0 auto' }}>
            {/* Android card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(61,214,140,0.08), rgba(245,166,35,0.05))', border: `1px solid rgba(61,214,140,0.25)`, borderRadius: 16, padding: isMobile ? '16px 14px' : '22px 24px' }}>
              <div style={{ fontSize: isMobile ? 28 : 36, marginBottom: 10 }}>🤖</div>
              <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: isMobile ? 13 : 15, color: text, marginBottom: 4 }}>Android</p>
              <p style={{ color: textDim, fontSize: isMobile ? 11 : 12.5, lineHeight: 1.5, marginBottom: 14 }}>One tap adds Scholar's Circle to your home screen.</p>
              {isInstalled ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(61,214,140,0.12)', border: '1px solid rgba(61,214,140,0.3)', borderRadius: 999, padding: '6px 14px', fontSize: 12, color: '#3DD68C', fontWeight: 700 }}>
                  ✓ Already installed
                </div>
              ) : isIOS ? (
                <p style={{ fontSize: 11, color: textFaint }}>Use the Safari steps on the right →</p>
              ) : (
                <button onClick={handleInstall} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: `linear-gradient(135deg, ${green}, ${gold})`, border: 'none', borderRadius: 999, padding: isMobile ? '8px 14px' : '9px 18px', fontSize: isMobile ? 12 : 13, fontWeight: 800, color: '#fff', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Install Now
                </button>
              )}
            </div>
            {/* iPhone card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(245,166,35,0.08), rgba(255,84,112,0.05))', border: `1px solid rgba(245,166,35,0.22)`, borderRadius: 16, padding: isMobile ? '16px 14px' : '22px 24px' }}>
              <div style={{ fontSize: isMobile ? 28 : 36, marginBottom: 10 }}>🍎</div>
              <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: isMobile ? 13 : 15, color: text, marginBottom: 4 }}>iPhone / iPad</p>
              <p style={{ color: textDim, fontSize: isMobile ? 11 : 12.5, lineHeight: 1.5, marginBottom: 12 }}>Follow these steps in Safari:</p>
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { icon: '↑', label: 'Tap the Share button' },
                  { icon: '+', label: '"Add to Home Screen"' },
                  { icon: '✓', label: 'Tap "Add" to confirm' },
                ].map((step, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: gold, flexShrink: 0 }}>{step.icon}</span>
                    <span style={{ fontSize: isMobile ? 10.5 : 12, color: textDim }}>{step.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — collapsible on mobile */}
      {isMobile ? (
        <div style={{ borderTop: `1px solid ${line}` }}>
          <button
            onClick={() => setPricingOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px', background: 'none', border: 'none', cursor: 'pointer', color: text, fontFamily: 'Manrope, sans-serif' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 16 }}>Pricing</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: gold, background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 999, padding: '3px 10px' }}>from ₦700/week</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: pricingOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', color: textDim, flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div style={{ maxHeight: pricingOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
            <PricingSection />
          </div>
        </div>
      ) : (
        <PricingSection />
      )}

      {/* CTA Band */}
      <section style={{ padding: '96px 0' }}>
        <div style={wrapStyle}>
          <div className="cta-band" style={{ background: `linear-gradient(135deg, ${inkSoft}, ${ink})`, border: `1px solid ${line}`, borderRadius: 24, padding: '64px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(245,166,35,0.14), transparent 60%)', pointerEvents: 'none' }} />
            <h2 style={{ ...h2Style, marginBottom: 14, position: 'relative' }}>Professional exams don't wait. Neither should you.</h2>
            <p style={{ color: textDim, marginBottom: 30, fontSize: '1.08rem', position: 'relative' }}>Start free. No card. Watch your first mastery ring fill up before your next anatomy test.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, position: 'relative', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn btn-primary btn-lg">Start your 2-day free trial →</Link>
              <Link to="/resources" className="btn btn-ghost btn-lg">Browse resources</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${line}`, padding: '48px 0 calc(32px + env(safe-area-inset-bottom))' }}>
        <div style={wrapStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: text }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: gold, boxShadow: `0 0 0 4px rgba(245,166,35,0.14)` }} />
                Scholar's Circle
              </Link>
              <p style={{ color: textFaint, fontSize: '0.9rem', marginTop: 8, maxWidth: 280, lineHeight: 1.6 }}>Built by MBBS students, for medical & health-science students. Smart review, AI-generated practice, and a study group that actually shows up.</p>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="#features" style={{ color: textDim, fontSize: '0.9rem', fontWeight: 700, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Features</a>
              <a href="#how" style={{ color: textDim, fontSize: '0.9rem', fontWeight: 700, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>How it works</a>
              <a href="#pricing" style={{ color: textDim, fontSize: '0.9rem', fontWeight: 700, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Pricing</a>
              <Link to="/resources" style={{ color: textDim, fontSize: '0.9rem', fontWeight: 700, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Resources</Link>
              <Link to="/blog" style={{ color: textDim, fontSize: '0.9rem', fontWeight: 700, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Blog</Link>
              <Link to="/login" style={{ color: textDim, fontSize: '0.9rem', fontWeight: 700, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Log in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm" style={{ marginLeft: 4 }}>Start free</Link>
            </div>
          </div>
          <div style={{ marginTop: 36, paddingTop: 20, borderTop: `1px solid ${line}`, fontSize: '0.82rem', color: textFaint, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontWeight: 600 }}>
            <span>© 2026 Scholar's Circle</span>
            <span>Made in Ibadan, Nigeria 🇳🇬</span>
          </div>
        </div>
      </footer>

      {/* Sticky mobile CTA — appears after hero, hides near footer */}
      {isMobile && (
        <div className={`sticky-cta${showCta && !menuOpen ? ' show' : ''}`}>
          <Link to="/signup" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '13px 18px 13px 20px', borderRadius: 999,
            background: `linear-gradient(135deg, ${goldBright}, ${gold})`,
            color: '#1A1300', fontWeight: 800, fontSize: '0.95rem',
            boxShadow: '0 12px 32px rgba(245,166,35,0.35)',
          }}>
            <span>Start free — full access for 2 days</span>
            <span style={{ fontSize: '1.1rem' }}>→</span>
          </Link>
        </div>
      )}
    </main>
  );
}
