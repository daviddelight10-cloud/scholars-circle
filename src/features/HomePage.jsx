import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import PricingSection from './homepage/PricingSection';

const FOUNDERS = [
  {
    name: 'Zibiri-David Delight Aluaye',
    shortName: 'Delight',
    initials: 'DA',
    role: 'Co-Founder & Product Lead',
    roleShort: 'Product Lead',
    bio: '200L MBBS student at LCU. Built Scholar\'s Circle after watching classmates struggle with the same anatomy chapters semester after semester. Leads product vision and AI integration.',
    color: '#FFD700',
    bg: 'rgba(79,142,247,0.07)',
    border: 'rgba(79,142,247,0.2)',
    tag: 'Product · 200L MBBS',
    image: '/images/founder-delight.jpg',
  },
  {
    name: 'Akinmusire Ifeoluwa Sarah',
    shortName: 'Sarah',
    initials: 'SA',
    role: 'Co-Founder & Operations Lead',
    roleShort: 'Operations Lead',
    bio: '200L MBBS student at LCU. Oversees student engagement and partnerships with medical departments. Knows exactly what a 2AM revision session feels like.',
    color: '#FF5470',
    bg: 'rgba(255,84,112,0.07)',
    border: 'rgba(255,84,112,0.2)',
    tag: 'Operations · 200L MBBS',
    image: '/images/founder-sarah.jpg',
  },
  {
    name: 'George Samuel',
    shortName: 'George',
    initials: 'GS',
    role: 'Co-Founder & Technology Lead',
    roleShort: 'Technology Lead',
    bio: '200L MBBS student at LCU. Handles the tech stack that powers Circle to Ask and spaced repetition. Believes medical students deserve better than photocopied past questions.',
    color: '#3DD68C',
    bg: 'rgba(61,214,140,0.07)',
    border: 'rgba(61,214,140,0.2)',
    tag: 'Engineering · 200L MBBS',
    image: '/images/founder-george.jpg',
  },
];

const TESTIMONIALS = [
  { quote: 'I stopped re-reading the same Anatomy chapter and started actually testing myself. My mastery ring doesn\'t lie to me.', by: '— 200L Medicine & Surgery' },
  { quote: 'Circle to Ask saved me during ANA 111 revision. I could lasso a diagram at 1am and finally understand the brachial plexus.', by: '— 100L Medicine & Surgery' },
  { quote: 'The streak feature is the only reason I opened my notes every single day before our first professional exam.', by: '— 300L Physiology' },
];

const FEATURES = [
  { tag: 'From your own notes', title: 'Circle to Ask', desc: 'Lasso any anatomy diagram, pharmacology table, or pathology slide in your lecture PDF and ask Scholar\'s Circle to explain it — like leaning over to ask the sharpest person in your study group.' },
  { tag: 'Remembers what you forget', title: 'Spaced repetition that adapts', desc: 'An SM-2-based engine tracks every topic you\'ve practiced — from embryology to clinical pharmacology — and brings back exactly what\'s about to slip, not what you already know cold.' },
  { tag: 'You vs your last score', title: 'Practice that feels like a game', desc: 'Hearts, combos, XP and streaks turn MBBS revision into something you actually want to open at midnight, not something you dread before professional exams.' },
  { tag: 'Your department\'s shelf', title: 'Research & Teacher Hub', desc: 'Past questions, lecturer-uploaded material, and shared resources for Medicine, Nursing, Pharmacy, Physiology, and more — filtered to your exact department and year level.' },
];

const TIMELINE = [
  { time: '7:42 AM', title: 'Upload today\'s anatomy lecture slide', desc: 'Straight from your phone, right after the dissection hall — no scanning, no typing it out.', exam: false },
  { time: '7:43 AM', title: 'Circle to Ask the diagram you didn\'t catch', desc: 'Lasso the brachial plexus diagram, ask your question, get an answer grounded in that exact page.', exam: false },
  { time: '8:15 AM', title: 'Five practice questions, generated on the spot', desc: 'From that exact slide — clinical vignettes and MCQs, not generic trivia pulled off the internet.', exam: false },
  { time: '11:50 PM', title: 'Spaced repetition resurfaces the three things you\'ll forget', desc: 'The embryology facts you\'re actually likely to miss in tomorrow\'s CBT — not a random reshuffle.', exam: true },
];

const FAQS = [
  { q: 'Does this work with my school\'s curriculum?', a: 'Yes. Scholar\'s Circle generates practice questions from your own lecture PDFs and course material — so it\'s aligned to whatever your lecturers teach, whether you\'re at LCU, UI, OAU, UNILORIN, or anywhere else. Upload your notes, and the AI does the rest.' },
  { q: 'Can I use it during clinical rotations?', a: 'Absolutely. Scholar\'s Circle is a PWA (Progressive Web App) — install it on your phone and use it offline during ward rounds, clinic postings, or commute to the teaching hospital. Your spaced repetition queue syncs the moment you\'re back online.' },
  { q: 'Is this only for MBBS students?', a: 'No. While we built it as MBBS students, Scholar\'s Circle works for Nursing, Pharmacy, Physiology, Medical Laboratory Science, Anatomy, Public Health, Radiography, and other health-science programs. If your course has PDFs and past questions, it works for you.' },
  { q: 'Will it replace my textbook?', a: 'No — it complements it. Textbooks give you the foundation; Scholar\'s Circle turns that foundation into active recall. Think of it as the bridge between reading Gray\'s Anatomy and actually remembering what you read when the examiner asks.' },
  { q: 'How is this different from Anki?', a: 'Anki is powerful but requires you to manually create every flashcard — hours of work most medical students don\'t have. Scholar\'s Circle uses AI to generate clinical vignettes, MCQs, and flashcards directly from your lecture PDFs. No card creation. No copying diagrams by hand. Just upload and practice.' },
  { q: 'What if I get a question wrong?', a: 'The spaced repetition engine immediately logs the topic as a weak area and schedules it to resurface sooner — before your next CBT or professional exam. You\'ll also see exactly which subjects and organ systems need more attention on your mastery ring.' },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [ringAnimated, setRingAnimated] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const ringRef = useRef(null);
  const heroRef = useRef(null);
  const windowWidth = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)[0];
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const root = document.getElementById('root');
    const onScroll = () => {
      if (!root) return;
      const max = root.scrollHeight - root.clientHeight;
      setScrollPct(max > 0 ? (root.scrollTop / max) * 100 : 0);
      setIsScrolled(root.scrollTop > 30);
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

    // Pick up event already captured by App.jsx
    if (window.__deferredPrompt) setDeferredPrompt(window.__deferredPrompt);

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); window.__deferredPrompt = e; };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for App.jsx dispatching the event
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
  const [foundersRef, foundersInView] = useInView(0.08);

  const ink = '#0A0D13';
  const inkSoft = '#11151E';
  const inkCard = '#151A24';
  const line = 'rgba(255,255,255,0.08)';
  const lineStrong = 'rgba(255,255,255,0.14)';
  const text = '#EDEFF5';
  const textDim = '#9AA3B5';
  const textFaint = '#646E84';
  const blue = '#FFD700';
  const gold = '#F5A623';
  const coral = '#FF5470';
  const green = '#3DD68C';

  return (
    <main style={{ background: ink, color: text, fontFamily: 'Manrope, sans-serif', fontSize: 16, lineHeight: 1.55, minHeight: '100vh', overflowX: 'clip' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        a { color: inherit; text-decoration: none; }
        ul { margin: 0; padding: 0; list-style: none; }
        h1, h2, h3 { font-family: 'Syne', sans-serif; margin: 0; letter-spacing: -0.01em; }
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
          font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 0.92rem;
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
        .btn-lg { padding: 15px 26px; font-size: 0.98rem; }

        .feature-card { transition: border-color 0.2s ease, transform 0.2s ease; }
        .feature-card:hover { border-color: ${lineStrong}; transform: translateY(-2px); }

        .scroll-x { overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
        .scroll-x::-webkit-scrollbar { display: none; }
        .scroll-x > * { scroll-snap-align: center; }

        @media (max-width: 900px) { .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; } .hero-visual { height: 280px; order: -1; } .nav-links { display: none !important; } .nav-actions { display: none !important; } .menu-btn { display: flex !important; } }
        @media (min-width: 901px) { .menu-btn { display: none !important; } .mobile-menu { display: none !important; } }
        @media (max-width: 760px) {
          .feature-grid { grid-template-columns: 1fr !important; }
          .compare { grid-template-columns: 1fr !important; }
          .testimonial-scroll { display: flex !important; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 12px; padding-left: calc(12px + env(safe-area-inset-left)); padding-right: calc(12px + env(safe-area-inset-right)); }
          .testimonial-scroll::-webkit-scrollbar { display: none; }
          .testimonial-scroll > * { min-width: 44vw; max-width: 44vw; flex-shrink: 0; scroll-snap-align: start; }
          .founder-scroll { display: flex !important; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 12px; padding-left: calc(12px + env(safe-area-inset-left)); padding-right: calc(12px + env(safe-area-inset-right)); }
          .founder-scroll::-webkit-scrollbar { display: none; }
          .founder-scroll > * { min-width: 42vw; max-width: 42vw; flex-shrink: 0; scroll-snap-align: start; }
          .orbit-ring { width: 280px !important; height: 280px !important; }
          .hero-ring { width: 180px !important; height: 180px !important; }
          .hero-ring svg { width: 180px !important; height: 180px !important; }
          section { padding: 64px 0 !important; }
        }
        @media (min-width: 761px) {
          .testimonial-scroll { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 22px; }
          .founder-scroll { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 22px; }
        }
        @media (max-width: 560px) { .wrap { padding: 0 20px !important; } section { padding: 56px 0 !important; } .cta-band { padding: 44px 24px !important; } .hero-section { padding: 48px 0 32px !important; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } html { scroll-behavior: auto; } }
      `}</style>

      {/* Scroll progress rail */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: line, zIndex: 60 }}>
        <div style={{ height: '100%', width: `${scrollPct}%`, background: `linear-gradient(90deg, ${blue}, ${gold})`, transition: 'width 0.08s linear' }} />
      </div>

      {/* Nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: isScrolled ? 'rgba(10,13,19,0.78)' : 'transparent', backdropFilter: isScrolled ? 'blur(14px) saturate(140%)' : 'none', borderBottom: `1px solid ${isScrolled ? line : 'transparent'}`, transition: 'all 0.3s ease', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: text }}>
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
              <a key={l.label} href={l.href} style={{ fontSize: '0.92rem', color: textDim, fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>{l.label}</a>
            ))}
            <Link to="/resources" style={{ fontSize: '0.92rem', color: textDim, fontWeight: 600, transition: 'color 0.15s ease' }}
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
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} style={{ fontSize: '0.95rem', color: textDim, fontWeight: 600, padding: '6px 0' }}>{l.label}</a>
            ))}
            <Link to="/resources" onClick={() => setMenuOpen(false)} style={{ fontSize: '0.95rem', color: textDim, fontWeight: 600, padding: '6px 0' }}>Resources</Link>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Log in</Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)} className="btn btn-primary btn-sm" style={{ flex: 1 }}>Start free trial</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section ref={heroRef} className="hero-section" style={{ padding: '72px 0 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 520, height: 520, background: `radial-gradient(circle, rgba(79,142,247,0.16), transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', position: 'relative', zIndex: 1 }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 56, alignItems: 'center' }}>
            {/* Left */}
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
                {['ANA 111', 'PHY 121', 'BHM 111', 'PAT 211', 'PHA 311'].map(c => (
                  <span key={c} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.03em', color: textDim, border: `1px solid ${lineStrong}`, borderRadius: 999, padding: '5px 11px' }}>{c}</span>
                ))}
              </div>
              <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 3.85rem)', fontWeight: 800, lineHeight: 1.04, marginBottom: 22, fontFamily: 'Syne, sans-serif' }}>
                Cram less.<br />
                <span style={{ color: blue }}>Remember</span> more.<br />
                Walk into the hall <span style={{ color: gold }}>ready.</span>
              </h1>
              <p style={{ fontSize: '1.1rem', color: textDim, maxWidth: 480, marginBottom: 30 }}>
                Scholar's Circle turns your own lecture notes and course PDFs into practice questions and spaced-repetition flashcards — built for medical, nursing, pharmacy, and health-science students. <b style={{ color: text, fontWeight: 700 }}>Built by MBBS students at LCU</b> who were tired of reading an anatomy chapter four times and still freezing in the exam hall.
              </p>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                <Link to="/signup" className="btn btn-primary btn-lg">Start your 2-day free trial →</Link>
                <a href="#how" className="btn btn-ghost btn-lg">See how it works</a>
              </div>
              <p style={{ fontSize: '0.8rem', color: textFaint, fontFamily: 'JetBrains Mono, monospace' }}>NO CARD NEEDED · BUILT FOR MEDICAL & HEALTH SCIENCE STUDENTS</p>
            </div>

            {/* Right — Mastery ring + orbit */}
            <div className="hero-visual" style={{ position: 'relative', height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="orbit-ring" style={{ position: 'absolute', width: 380, height: 380, border: `1px dashed ${lineStrong}`, borderRadius: '50%' }}>
                {[
                  { top: '-13px', left: '50%', transform: 'translateX(-50%)', label: 'ANA 111' },
                  { top: '50%', left: 'auto', right: '-13px', transform: 'translateY(-50%)', label: 'PHY 121' },
                  { top: 'auto', bottom: '-13px', left: '50%', transform: 'translateX(-50%)', label: 'BHM 111' },
                  { top: '50%', left: '-13px', right: 'auto', transform: 'translateY(-50%)', label: 'PAT 211' },
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
                      <stop offset="0%" stopColor={blue} />
                      <stop offset="100%" stopColor={gold} />
                    </linearGradient>
                  </defs>
                  <circle fill="none" stroke={line} strokeWidth="10" cx="115" cy="115" r="100" />
                  <circle
                    ref={ringRef}
                    fill="none" strokeWidth="10" strokeLinecap="round"
                    stroke="url(#ringGradient)"
                    cx="115" cy="115" r="100"
                    strokeDasharray="628"
                    strokeDashoffset={ringAnimated ? 628 - (628 * 0.68) : 628}
                    style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.2,0.7,0.2,1)' }}
                  />
                </svg>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '2.3rem', display: 'block', color: text }}>68%</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: textDim, letterSpacing: '0.04em', marginTop: 2, display: 'block' }}>MASTERED · ANATOMY</span>
                </div>
              </div>
              <div className="float-card" style={{ position: 'absolute', top: '6%', right: '4%', background: inkCard, border: `1px solid ${lineStrong}`, borderRadius: 10, padding: '9px 13px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 500, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', color: gold }}>+12 XP</div>
              <div className="float-card" style={{ position: 'absolute', bottom: '10%', left: '0%', background: inkCard, border: `1px solid ${lineStrong}`, borderRadius: 10, padding: '9px 13px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 500, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', color: coral, animationDelay: '1.1s' }}>🔥 4-day streak</div>
              <div className="float-card" style={{ position: 'absolute', top: '52%', right: '-6%', background: inkCard, border: `1px solid ${lineStrong}`, borderRadius: 10, padding: '9px 13px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 500, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', color: text, animationDelay: '2.2s' }}>❤❤❤❤🤍</div>
            </div>
          </div>

          {/* Ticker */}
          <div style={{ marginTop: 54, paddingTop: 22, borderTop: `1px solid ${line}`, display: 'flex', gap: 28, flexWrap: 'wrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: textFaint }}>
            <span><span className="pulse-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: green, marginRight: 7, boxShadow: `0 0 0 3px rgba(61,214,140,0.18)` }} /><b style={{ color: textDim }}>1,284</b> practice questions answered this week</span>
            <span><b style={{ color: textDim }}>96</b> medical study groups active right now</span>
            <span><b style={{ color: textDim }}>12</b> health-science programs, one shared shelf</span>
          </div>
        </div>
      </section>

      {/* Why We Built This */}
      <section style={{ padding: '96px 0', background: inkSoft, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 600, color: blue, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Why we built this</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, maxWidth: 640, marginBottom: 24, fontFamily: 'Syne, sans-serif' }}>The textbook doesn't fail you. Your memory does.</h2>
          <p style={{ maxWidth: 680, color: textDim, fontSize: '1.08rem', marginBottom: 48 }}>
            Photocopied past questions from the medical library. A WhatsApp group that goes quiet two days before the professional exam. Reading Gray's Anatomy three times and still blanking on the one question that mattered. <b style={{ color: text, fontWeight: 700 }}>We lived through all of it as MBBS students</b> — and built the tool we wished existed.
          </p>
          <div className="compare" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, border: `1px solid ${lineStrong}`, borderRadius: 18, overflow: 'hidden', background: lineStrong }}>
            <div style={{ background: inkSoft, padding: '30px 28px' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 18, display: 'inline-block', padding: '4px 10px', borderRadius: 6, color: textFaint, background: 'rgba(255,255,255,0.05)' }}>The old way</span>
              {['Read the anatomy chapter once. Forget half of it by Friday.', 'Hunt for past questions in a crowded medical WhatsApp group.', "Find out you got it wrong — after the professional exam, not before.", 'Study alone, with no idea where you actually stand in your cohort.'].map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 16, fontSize: '0.95rem', color: textFaint }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>×</span>{t}
                </li>
              ))}
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(79,142,247,0.06), transparent)', padding: '30px 28px' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 18, display: 'inline-block', padding: '4px 10px', borderRadius: 6, color: blue, background: 'rgba(79,142,247,0.14)' }}>With Scholar's Circle</span>
              {['Spaced repetition resurfaces what you\'re about to forget — before the next CBT catches you.', 'AI-generated clinical vignettes and MCQs from your actual course material, ready in seconds.', 'See exactly which topic to fix — anatomy, pharmacology, pathology — the moment you get it wrong.', 'A mastery ring that shows your real standing, by subject and organ system.'].map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 16, fontSize: '0.95rem', color: text }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', flexShrink: 0, color: green }}>✓</span>{t}
                </li>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" ref={featuresRef} style={{ padding: '96px 0' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 600, color: blue, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>What's inside</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, fontFamily: 'Syne, sans-serif' }}>Everything you need between the lecture hall and the professional exam.</h2>
          </div>
          <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="feature-card" style={{
                opacity: featuresInView ? 1 : 0,
                transform: featuresInView ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms, border-color 0.2s ease`,
                background: inkCard, border: `1px solid ${line}`, borderRadius: 18, padding: 30,
              }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: gold, marginBottom: 16, display: 'block' }}>{f.tag}</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 10, fontFamily: 'Syne, sans-serif', color: text }}>{f.title}</h3>
                <p style={{ color: textDim, fontSize: '0.96rem' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works — Timeline */}
      <section id="how" style={{ padding: '96px 0', background: inkSoft, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 600, color: blue, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>How it actually works</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, fontFamily: 'Syne, sans-serif' }}>A normal Tuesday in med school, with Scholar's Circle.</h2>
          </div>
          <div style={{ position: 'relative', maxWidth: 680 }}>
            <div style={{ position: 'absolute', left: 67, top: 6, bottom: 6, width: 1, background: lineStrong }} />
            {TIMELINE.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '67px 1fr', gap: 24, marginBottom: 34, position: 'relative' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: t.exam ? coral : textFaint, textAlign: 'right', paddingTop: 2 }}>{t.time}{t.exam && <br />}{t.exam && 'night before'}</div>
                <div style={{ position: 'absolute', left: 62, top: 5, width: 11, height: 11, borderRadius: '50%', background: ink, border: `2px solid ${i === TIMELINE.length - 1 ? coral : blue}` }} />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 5, fontFamily: 'Syne, sans-serif', color: text }}>{t.title}</h3>
                  <p style={{ color: textDim, fontSize: '0.94rem' }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section ref={testiRef} style={{ padding: '64px 0' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ maxWidth: 640, marginBottom: 32 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', fontWeight: 600, color: blue, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>From the reading rooms of LCU</span>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, fontFamily: 'Syne, sans-serif' }}>Medical students who got there with us.</h2>
          </div>
          <div className="testimonial-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{
                opacity: testiInView ? 1 : 0,
                transform: testiInView ? 'translateY(0)' : 'translateY(16px)',
                transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`,
                background: inkCard, border: `1px solid ${line}`, borderLeft: `3px solid ${blue}`, borderRadius: 10, padding: '10px 12px',
              }}>
                <p style={{ fontSize: '0.75rem', lineHeight: 1.45, marginBottom: 8, color: text }}>"{t.quote}"</p>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: textFaint, margin: 0 }}>{t.by}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 600, color: blue, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Questions medical students ask</span>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', fontWeight: 800, fontFamily: 'Syne, sans-serif', color: text, lineHeight: 1.2 }}>Frequently Asked Questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQS.map((f, i) => (
              <div key={i} style={{ background: inkCard, border: `1px solid ${openFaq === i ? lineStrong : line}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s ease' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: text, fontFamily: 'Manrope, sans-serif', fontSize: '0.98rem', fontWeight: 600 }}
                >
                  <span>{f.q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, color: textDim, transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div style={{ maxHeight: openFaq === i ? '300px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                  <p style={{ padding: '0 22px 20px', color: textDim, fontSize: '0.92rem', lineHeight: 1.6 }}>{f.a}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <p style={{ color: textFaint, fontSize: '0.85rem', marginBottom: 14 }}>Still have questions?</p>
            <a href="https://wa.me/2349028617178" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chat with us on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Compact Founders */}
      <section ref={foundersRef} style={{ padding: '64px 0', background: inkSoft, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ maxWidth: 640, marginBottom: 32 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', fontWeight: 600, color: blue, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>Built by students, for students</span>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, fontFamily: 'Syne, sans-serif' }}>The team behind Scholar's Circle.</h2>
          </div>
          <div className="founder-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {FOUNDERS.map((f, i) => (
              <div key={i} style={{
                opacity: foundersInView ? 1 : 0,
                transform: foundersInView ? 'translateY(0)' : 'translateY(16px)',
                transition: `opacity 0.6s ease ${i * 100}ms, transform 0.6s ease ${i * 100}ms`,
                background: f.bg, border: `1px solid ${f.border}`, borderRadius: 10, padding: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <img src={f.image} alt={f.name} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${f.color}44` }} />
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${f.color}, ${f.color}77)`, display: 'none', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                    {f.initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.shortName}</p>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: f.color, background: `${f.color}14`, padding: '1px 6px', borderRadius: 999, border: `1px solid ${f.color}30` }}>{f.roleShort}</span>
                  </div>
                </div>
                <p style={{ color: textDim, fontSize: 10.5, lineHeight: 1.4, margin: 0 }}>{f.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Install App */}
      <section style={{ padding: '48px 0', borderTop: `1px solid ${line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', fontWeight: 600, color: blue, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Works on your phone</span>
            <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, fontFamily: 'Syne, sans-serif' }}>Install Scholar's Circle</h2>
            <p style={{ color: textDim, fontSize: '0.88rem', marginTop: 8 }}>No App Store needed — install directly from your browser in seconds.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, minmax(0, 380px))', gap: 14, justifyContent: 'center', maxWidth: 780, margin: '0 auto' }}>
            {/* Android card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(61,214,140,0.08), rgba(79,142,247,0.06))', border: `1px solid rgba(61,214,140,0.25)`, borderRadius: 14, padding: isMobile ? '16px 14px' : '22px 24px' }}>
              <div style={{ fontSize: isMobile ? 28 : 36, marginBottom: 10 }}>🤖</div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: isMobile ? 13 : 15, color: text, marginBottom: 4 }}>Android</p>
              <p style={{ color: textDim, fontSize: isMobile ? 11 : 12.5, lineHeight: 1.4, marginBottom: 14 }}>Tap below to add Scholar's Circle to your home screen instantly.</p>
              {isInstalled ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(61,214,140,0.12)', border: '1px solid rgba(61,214,140,0.3)', borderRadius: 999, padding: '6px 14px', fontSize: 12, color: '#3DD68C', fontWeight: 600 }}>
                  ✓ Already installed
                </div>
              ) : isIOS ? (
                <p style={{ fontSize: 11, color: textFaint }}>Use the Safari steps on the right →</p>
              ) : (
                <button onClick={handleInstall} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, #3DD68C, #FFD700)', border: 'none', borderRadius: 999, padding: isMobile ? '8px 14px' : '9px 18px', fontSize: isMobile ? 12 : 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Install Now
                </button>
              )}
            </div>
            {/* iPhone card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(79,142,247,0.08), rgba(255,84,112,0.05))', border: `1px solid rgba(79,142,247,0.22)`, borderRadius: 14, padding: isMobile ? '16px 14px' : '22px 24px' }}>
              <div style={{ fontSize: isMobile ? 28 : 36, marginBottom: 10 }}>🍎</div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: isMobile ? 13 : 15, color: text, marginBottom: 4 }}>iPhone / iPad</p>
              <p style={{ color: textDim, fontSize: isMobile ? 11 : 12.5, lineHeight: 1.4, marginBottom: 12 }}>Follow these steps in Safari:</p>
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { icon: '↑', label: 'Tap the Share button' },
                  { icon: '+', label: '"Add to Home Screen"' },
                  { icon: '✓', label: 'Tap "Add" to confirm' },
                ].map((step, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(79,142,247,0.2)', border: '1px solid rgba(79,142,247,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: blue, flexShrink: 0 }}>{step.icon}</span>
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
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16 }}>Pricing</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: blue, background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 999, padding: '2px 8px' }}>from ₦700/week</span>
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
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ background: `linear-gradient(135deg, ${inkSoft}, ${ink})`, border: `1px solid ${line}`, borderRadius: 24, padding: '64px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(245,166,35,0.12), transparent 60%)', pointerEvents: 'none' }} />
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, marginBottom: 14, position: 'relative', fontFamily: 'Syne, sans-serif' }}>Professional exams don't wait. Neither should you.</h2>
            <p style={{ color: textDim, marginBottom: 30, fontSize: '1.05rem', position: 'relative' }}>Start free. No card. Watch your first mastery ring fill up before your next anatomy test.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, position: 'relative', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn btn-primary btn-lg">Start your 2-day free trial →</Link>
              <Link to="/resources" className="btn btn-ghost btn-lg">Browse resources</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${line}`, padding: '48px 0 calc(32px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: text }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: gold, boxShadow: `0 0 0 4px rgba(245,166,35,0.14)` }} />
                Scholar's Circle
              </Link>
              <p style={{ color: textFaint, fontSize: '0.88rem', marginTop: 8, maxWidth: 280 }}>Built by MBBS students, for medical & health-science students. Spaced repetition, AI-generated practice, and a study group that actually shows up.</p>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link to="/features" style={{ color: textDim, fontSize: '0.88rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Features</Link>
              <a href="#how" style={{ color: textDim, fontSize: '0.88rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>How it works</a>
              <Link to="/pricing" style={{ color: textDim, fontSize: '0.88rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Pricing</Link>
              <Link to="/resources" style={{ color: textDim, fontSize: '0.88rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Resources</Link>
              <Link to="/blog" style={{ color: textDim, fontSize: '0.88rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Blog</Link>
              <Link to="/login" style={{ color: textDim, fontSize: '0.88rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = text}
                onMouseLeave={e => e.currentTarget.style.color = textDim}>Log in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm" style={{ marginLeft: 4 }}>Start free</Link>
            </div>
          </div>
          <div style={{ marginTop: 36, paddingTop: 20, borderTop: `1px solid ${line}`, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: textFaint, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span>© 2026 Scholar's Circle</span>
            <span>Made in Ibadan, Nigeria 🇳🇬</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
