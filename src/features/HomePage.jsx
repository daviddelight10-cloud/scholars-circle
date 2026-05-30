import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Zap, BarChart3, ArrowRight, TrendingUp,
  Sparkles, Trophy, Brain, X, ChevronRight, Star, Menu
} from 'lucide-react';
import MobileAppSection from './homepage/MobileAppSection';
import PricingSection from './homepage/PricingSection';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROTATING_WORDS = ['Biology', 'Physics', 'Chemistry', 'Math', 'Every Exam'];

const FEATURES = [
  { icon: <Zap className="w-5 h-5" />, title: 'Smart Study Modes', desc: 'Practice, Exam, and Flashcard modes tailored to your learning style.', color: '#3D7EFF', bg: 'rgba(61,126,255,0.06)', border: 'rgba(61,126,255,0.18)' },
  { icon: <Brain className="w-5 h-5" />, title: 'Spaced Repetition', desc: 'SM-2 algorithm adapts to your memory patterns for maximum retention.', color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)' },
  { icon: <Trophy className="w-5 h-5" />, title: 'Gamified Learning', desc: 'Earn XP, unlock badges, and climb leaderboards every session.', color: '#F5A623', bg: 'rgba(245,166,35,0.06)', border: 'rgba(245,166,35,0.18)' },
  { icon: <BarChart3 className="w-5 h-5" />, title: 'Progress Analytics', desc: 'Deep insights into performance. Spot weak areas and celebrate growth.', color: '#EC4899', bg: 'rgba(236,72,153,0.06)', border: 'rgba(236,72,153,0.18)' },
  { icon: <BookOpen className="w-5 h-5" />, title: 'Multi-Subject Hub', desc: 'All courses in one place — Biology, Chemistry, Physics, Math.', color: '#8B5CF6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.18)' },
  { icon: <Sparkles className="w-5 h-5" />, title: 'AI Question Gen', desc: 'Generate unlimited custom questions tailored to your syllabus.', color: '#06B6D4', bg: 'rgba(6,182,212,0.06)', border: 'rgba(6,182,212,0.18)' },
];

const STATS = [
  { label: 'Questions Ready', target: 500, suffix: '+' },
  { label: 'Course Modules', target: 8, suffix: '' },
  { label: 'Study Sessions', target: 10000, suffix: '+' },
  { label: 'Retention Rate', target: 95, suffix: '%' },
];

const PROGRESS_BARS = [
  { label: 'Chordata', pct: 85, color: '#3D7EFF', delay: 0 },
  { label: 'Genetics', pct: 72, color: '#10B981', delay: 180 },
  { label: 'Cell Biology', pct: 58, color: '#F5A623', delay: 360 },
];

const STEPS = [
  { step: '01', title: 'Choose Your Subjects', desc: 'Select from multiple course modules. Import your syllabus or use AI to generate personalized question sets.', icon: <BookOpen className="w-5 h-5" /> },
  { step: '02', title: 'Study Intelligently', desc: 'Pick your mode: Practice for exploration, Exam for timed pressure, or Flashcard for quick on-the-go review.', icon: <Brain className="w-5 h-5" /> },
  { step: '03', title: 'Track & Improve', desc: 'Watch analytics grow. Spaced repetition auto-optimizes your schedule. Gamification keeps you coming back.', icon: <TrendingUp className="w-5 h-5" /> },
];

const TESTIMONIALS = [
  { name: 'Amara O.', role: 'MBBS Year 1', text: 'My BIO 111 scores jumped from 58% to 84% in three weeks. The spaced repetition is a game-changer.', avatar: '#3D7EFF' },
  { name: 'Chidi N.', role: 'Engineering Student', text: 'Having Physics, Calculus, and Org Chem in one place is exactly what I needed. The AI questions are spot-on.', avatar: '#10B981' },
  { name: 'Funke A.', role: 'Biochemistry Year 2', text: 'The gamification actually works — I study more now because I want to keep my streak. Genuinely addictive.', avatar: '#F5A623' },
];

const CREDIBILITY_CARDS = [
  { icon: <Brain className="w-5 h-5" />, title: 'AI-Powered Learning', desc: 'Smart algorithms adapt to your learning pace and style for personalized study experiences.', color: '#3D7EFF', bg: 'rgba(61,126,255,0.06)', border: 'rgba(61,126,255,0.18)' },
  { icon: <TrendingUp className="w-5 h-5" />, title: 'Spaced Repetition Science', desc: 'Backed by cognitive science, our SM-2 algorithm maximizes long-term retention.', color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)' },
  { icon: <BookOpen className="w-5 h-5" />, title: 'Built by Medical Students', desc: 'Developed by MBBS students who understand real academic challenges.', color: '#F5A623', bg: 'rgba(245,166,35,0.06)', border: 'rgba(245,166,35,0.18)' },
  { icon: <BarChart3 className="w-5 h-5" />, title: 'Progress Tracking', desc: 'Detailed analytics help you identify strengths and areas for improvement.', color: '#EC4899', bg: 'rgba(236,72,153,0.06)', border: 'rgba(236,72,153,0.18)' },
];

const FOUNDER_STORY = [
  {
    year: '2023',
    title: 'The Problem',
    desc: 'As MBBS students, we struggled with overwhelming coursework, scattered resources, and ineffective study methods. We knew there had to be a better way.',
    color: '#3D7EFF',
  },
  {
    year: '2024',
    title: 'The Solution',
    desc: 'We combined spaced repetition science, AI-powered question generation, and gamification to create a platform that actually works for students.',
    color: '#10B981',
  },
  {
    year: '2025',
    title: 'The Impact',
    desc: 'Today, Scholar\'s Circle helps hundreds of students achieve better grades through smarter, science-backed studying.',
    color: '#F5A623',
  },
];

const FOUNDERS = [
  {
    name: 'Zibiri-David Delight Aluaye',
    shortName: 'Delight',
    initials: 'DA',
    role: 'Co-Founder & Product Lead',
    roleShort: 'Product Lead',
    bio: 'Delight leads the vision and development of Scholar\'s Circle, focusing on creating an intuitive learning experience that addresses the real needs of students. He oversees product strategy, user experience, and platform innovation.',
    color: '#3D7EFF',
    bg: 'rgba(61,126,255,0.07)',
    border: 'rgba(61,126,255,0.2)',
    tag: 'Product · UX · Strategy',
    image: '/images/founder-delight.jpg',
  },
  {
    name: 'Akinmusire Ifeoluwa Sarah',
    shortName: 'Sarah',
    initials: 'SA',
    role: 'Co-Founder & Operations Lead',
    roleShort: 'Operations Lead',
    bio: 'Sarah oversees operations, student engagement, and strategic partnerships. She ensures that Scholar\'s Circle remains aligned with the needs of students and educational institutions.',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.07)',
    border: 'rgba(236,72,153,0.2)',
    tag: 'Operations · Partnerships · Engagement',
    image: '/images/founder-sarah.jpg',
  },
  {
    name: 'George Samuel',
    shortName: 'George',
    initials: 'GS',
    role: 'Co-Founder & Technology Lead',
    roleShort: 'Technology Lead',
    bio: 'George focuses on technology strategy, platform performance, and future scalability. He works to ensure that Scholar\'s Circle delivers a secure, reliable, and innovative learning experience.',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.2)',
    tag: 'Engineering · Infrastructure · Security',
    image: '/images/founder-george.jpg',
  },
];

// ─── Hooks ───────────────────────────────────────────────────────────────────
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

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

// ─── Sub-components ──────────────────────────────────────────────────────────
const AnimatedCounter = React.memo(function AnimatedCounter({ target, suffix = '', start }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0 = null;
    const tick = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / 2000, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [start, target]);
  return <span>{count.toLocaleString()}{suffix}</span>;
});

const FeatureCard = React.memo(function FeatureCard({ feature, index, visible, isMobile }) {
  const cardRef = useRef(null);
  const glowRef = useRef(null);

  const handleMove = (e) => {
    if (isMobile || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    cardRef.current.style.transform = `perspective(700px) rotateX(${((y - r.height / 2) / r.height) * 10}deg) rotateY(${-((x - r.width / 2) / r.width) * 10}deg) translateZ(12px)`;
    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, ${feature.color}22, transparent 70%)`;
      glowRef.current.style.opacity = '1';
    }
  };
  const handleLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = 'perspective(700px) rotateX(0) rotateY(0) translateZ(0)';
    if (glowRef.current) glowRef.current.style.opacity = '0';
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="hover-lift hover-border"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.6s ease ${index * 70}ms, transform 0.6s ease ${index * 70}ms`,
        background: feature.bg,
        border: `1px solid ${feature.border}`,
        borderRadius: 18,
        padding: 22,
        position: 'relative',
        overflow: 'hidden',
        willChange: 'transform',
        transformStyle: 'preserve-3d',
      }}
    >
      <div ref={glowRef} style={{ position: 'absolute', inset: 0, opacity: 0, transition: 'opacity 0.3s', pointerEvents: 'none', borderRadius: 18 }} />
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${feature.color}18`, border: `1px solid ${feature.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: feature.color, position: 'relative', zIndex: 1 }}>
        {feature.icon}
      </div>
      <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 8, position: 'relative', zIndex: 1 }}>{feature.title}</h3>
      <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.65, marginBottom: 14, position: 'relative', zIndex: 1 }}>{feature.desc}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: feature.color, fontSize: 13, fontWeight: 600, position: 'relative', zIndex: 1 }}>
        Learn more <ChevronRight style={{ width: 13, height: 13 }} />
      </div>
    </div>
  );
});

const TestimonialCard = React.memo(function TestimonialCard({ t, visible, delay }) {
  return (
    <div className="hover-lift" style={{
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `all 0.6s ease ${delay}ms`,
      background: '#0D0E18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 22,
    }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
        {[...Array(5)].map((_, i) => <Star key={i} style={{ width: 13, height: 13, fill: '#F5A623', color: '#F5A623' }} />)}
      </div>
      <p style={{ color: '#94A3B8', fontSize: 14, lineHeight: 1.7, marginBottom: 18, fontStyle: 'italic' }}>"{t.text}"</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${t.avatar},${t.avatar}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {t.name[0]}
        </div>
        <div>
          <p style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{t.name}</p>
          <p style={{ color: '#475569', fontSize: 12 }}>{t.role}</p>
        </div>
      </div>
    </div>
  );
});

const CredibilityCard = React.memo(function CredibilityCard({ card, index, visible }) {
  return (
    <div className="hover-lift hover-border" style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.6s ease ${index * 80}ms, transform 0.6s ease ${index * 80}ms`,
      background: card.bg,
      border: `1px solid ${card.border}`,
      borderRadius: 18,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${card.color}18`, border: `1px solid ${card.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: card.color }}>
        {card.icon}
      </div>
      <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 8 }}>{card.title}</h3>
      <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.65 }}>{card.desc}</p>
    </div>
  );
});

const FounderCard = React.memo(function FounderCard({ founder, index, visible, isMobile }) {
  const [hovered, setHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="hover-lift"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition: `opacity 0.65s ease ${index * 120}ms, transform 0.65s ease ${index * 120}ms`,
        background: hovered ? founder.bg : 'rgba(255,255,255,0.018)',
        border: `1px solid ${hovered ? founder.border : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 22,
        padding: isMobile ? '24px 20px' : '28px 26px',
        position: 'relative',
        overflow: 'hidden',
        transition: `opacity 0.65s ease ${index * 120}ms, transform 0.65s ease ${index * 120}ms, background 0.3s, border-color 0.3s`,
      }}
    >
      {/* Subtle corner glow */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${founder.color}18 0%, transparent 70%)`, opacity: hovered ? 1 : 0, transition: 'opacity 0.4s', pointerEvents: 'none' }} />

      {/* Avatar + name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {founder.image ? (
            <>
              {!imageLoaded && (
                <div className="skeleton skeleton-avatar" style={{ position: 'absolute', top: 0, left: 0 }} />
              )}
              <img
                src={founder.image}
                alt={founder.name}
                onLoad={() => setImageLoaded(true)}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  boxShadow: `0 0 0 3px ${founder.color}28, 0 8px 24px ${founder.color}33`,
                  opacity: imageLoaded ? 1 : 0,
                  transition: 'opacity 0.3s'
                }}
              />
            </>
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${founder.color}, ${founder.color}77)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', boxShadow: `0 0 0 3px ${founder.color}28, 0 8px 24px ${founder.color}33` }}>
              {founder.initials}
            </div>
          )}
          {/* Online dot */}
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: founder.color, border: '2px solid #07080F', boxShadow: `0 0 8px ${founder.color}` }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: isMobile ? 15 : 16, color: '#fff', marginBottom: 4, lineHeight: 1.2 }}>{founder.name}</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: `${founder.color}14`, border: `1px solid ${founder.color}30` }}>
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: founder.color, fontWeight: 500 }}>{founder.roleShort}</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.72, marginBottom: 18 }}>{founder.bio}</p>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {founder.tag.split(' · ').map(t => (
          <span key={t} style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: '#475569' }}>{t}</span>
        ))}
      </div>
    </div>
  );
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [wordIdx, setWordIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 40, y: 40 });
  const [notification, setNotification] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [barsAnimated, setBarsAnimated] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  const [statsRef, statsInView] = useInView(0.2);
  const [credibilityRef, credibilityInView] = useInView(0.1);
  const [featuresRef, featuresInView] = useInView(0.05);
  const [stepsRef, stepsInView] = useInView(0.1);
  const [testiRef, testiInView] = useInView(0.1);
  const [storyRef, storyInView] = useInView(0.1);
  const [foundersRef, foundersInView] = useInView(0.08);
  const heroRef = useRef(null);
  const windowWidth = useWindowWidth();

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  useEffect(() => {
    const iv = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => { setWordIdx(i => (i + 1) % ROTATING_WORDS.length); setWordVisible(true); }, 320);
    }, 2800);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e) => {
      if (!heroRef.current) return;
      const r = heroRef.current.getBoundingClientRect();
      setMousePos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isMobile]);

  useEffect(() => { const t = setTimeout(() => setNotification(true), 4000); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  useEffect(() => { const t = setTimeout(() => setBarsAnimated(true), 700); return () => clearTimeout(t); }, []);

  // Close mobile menu on resize
  useEffect(() => { if (!isMobile) setMenuOpen(false); }, [isMobile]);

  const S = { fontFamily: 'Syne,sans-serif' };
  const M = { fontFamily: 'JetBrains Mono,monospace' };

  return (
    <main style={{ background: '#07080F', color: '#fff', fontFamily: 'Manrope,sans-serif', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Global Styles & Media Queries ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes grain {
          0%,100%{transform:translate(0,0)} 10%{transform:translate(-2%,-3%)} 20%{transform:translate(3%,2%)}
          30%{transform:translate(-1%,3%)} 40%{transform:translate(2%,-2%)} 50%{transform:translate(-3%,1%)}
          60%{transform:translate(1%,-1%)} 70%{transform:translate(-2%,2%)} 80%{transform:translate(3%,-3%)}
        }
        @keyframes orbFloat {
          0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-24px) scale(1.04)}
        }
        @keyframes slideUp {
          from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)}
        }
        @keyframes slideInRight {
          from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1}
        }
        @keyframes pulseRing {
          0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.2);opacity:0}
        }
        @keyframes progressFill {
          from{width:0} to{width:var(--w)}
        }
        @keyframes shimmer {
          0%{background-position:-400px 0} 100%{background-position:400px 0}
        }
        @keyframes fadeSlideDown {
          from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)}
        }

        .noise-layer {
          position:fixed;inset:-50%;width:200%;height:200%;z-index:999;pointer-events:none;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity:0.025;animation:grain 8s steps(1) infinite;
        }

        .glow-btn {
          position:relative;overflow:hidden;border:none;cursor:pointer;
          transition:transform 0.2s,box-shadow 0.2s;
        }
        .glow-btn::after {
          content:'';position:absolute;inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 60%);
          opacity:0;transition:opacity 0.3s;
        }
        .glow-btn:hover { transform:translateY(-2px); }
        .glow-btn:hover::after { opacity:1; }
        .glow-btn:active { transform:translateY(0); }

        .ghost-btn {
          background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
          color:#94A3B8;cursor:pointer;transition:all 0.2s;
        }
        .ghost-btn:hover { background:rgba(255,255,255,0.07);color:#fff;transform:translateY(-2px); }
        .ghost-btn:active { transform:translateY(0); }

        .section-label { font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#3D7EFF;margin-bottom:12px;display:block; }
        .divider { height:1px;background:linear-gradient(90deg,transparent,rgba(61,126,255,0.18),transparent); }

        .active-dot {
          width:8px;height:8px;border-radius:50%;background:#3D7EFF;
          position:relative;box-shadow:0 0 8px #3D7EFF;display:inline-block;flex-shrink:0;
        }
        .active-dot::after {
          content:'';position:absolute;inset:0;border-radius:50%;
          background:#3D7EFF;animation:pulseRing 2s ease-out infinite;
        }

        .stat-shimmer {
          background:linear-gradient(90deg,#3D7EFF 0%,#a78bfa 45%,#3D7EFF 80%);
          background-size:400px 100%;
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          animation:shimmer 3s linear infinite;
        }

        .progress-fill { animation:progressFill 1.4s cubic-bezier(0.16,1,0.3,1) forwards; }

        .mobile-menu-dropdown {
          animation:fadeSlideDown 0.22s ease forwards;
        }

        /* ── Responsive Layout Classes ── */

        /* Hero */
        .hero-grid { display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center; }
        @media(max-width:1023px) { .hero-grid { grid-template-columns:1fr;gap:40px; } }

        /* Hero card — hide on small mobile, show on tablet+ */
        .hero-card-wrap { position:relative; }
        @media(max-width:767px) { .hero-card-wrap { display:none; } }

        /* Stats */
        .stats-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:14px; }
        @media(max-width:767px) { .stats-grid { grid-template-columns:repeat(2,1fr);gap:10px; } }

        /* Credibility */
        .credibility-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:14px; }
        @media(max-width:1023px) { .credibility-grid { grid-template-columns:repeat(2,1fr); } }
        @media(max-width:559px) { .credibility-grid { grid-template-columns:1fr; } }

        /* Features */
        .features-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:14px; }
        @media(max-width:1023px) { .features-grid { grid-template-columns:repeat(2,1fr); } }
        @media(max-width:559px) { .features-grid { grid-template-columns:1fr; } }

        /* Steps */
        .steps-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:40px;position:relative; }
        @media(max-width:767px) { .steps-grid { grid-template-columns:1fr;gap:32px; } }

        /* Testimonials */
        .testi-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:14px; }
        @media(max-width:1023px) { .testi-grid { grid-template-columns:repeat(2,1fr); } }
        @media(max-width:559px) { .testi-grid { grid-template-columns:1fr; } }

        /* Footer */
        .footer-grid { display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:36px;margin-bottom:36px; }
        @media(max-width:767px) { .footer-grid { grid-template-columns:1fr 1fr;gap:28px; } }
        @media(max-width:399px) { .footer-grid { grid-template-columns:1fr; } }

        /* CTA buttons */
        .cta-btns { display:flex;gap:12px;justify-content:center;flex-wrap:wrap; }
        @media(max-width:479px) { .cta-btns { flex-direction:column;align-items:stretch; } }

        /* Hero buttons */
        .hero-btns { display:flex;gap:12px;margin-bottom:32px; }
        @media(max-width:479px) { .hero-btns { flex-direction:column; } }

        /* Sections padding */
        .section-pad { padding:80px 24px; }
        @media(max-width:767px) { .section-pad { padding:56px 18px; } }
        @media(max-width:479px) { .section-pad { padding:44px 16px; } }

        /* How it works inner card padding */
        .steps-inner { padding:56px 48px; }
        @media(max-width:767px) { .steps-inner { padding:36px 24px; } }
        @media(max-width:479px) { .steps-inner { padding:28px 18px; } }

        /* Hero section padding */
        .hero-section { padding:64px 24px 80px; }
        @media(max-width:767px) { .hero-section { padding:40px 18px 56px; } }
        @media(max-width:479px) { .hero-section { padding:32px 16px 48px; } }

        /* Container */
        .container { max-width:1280px;margin:0 auto; }

        /* Nav desktop links */
        .nav-desktop-links { display:flex;align-items:center;gap:28px; }
        @media(max-width:767px) { .nav-desktop-links { display:none; } }

        /* Nav desktop auth */
        .nav-desktop-auth { display:flex;gap:10px;align-items:center; }
        @media(max-width:767px) { .nav-desktop-auth { display:none; } }

        /* Hamburger */
        .hamburger { display:none; }
        @media(max-width:767px) { .hamburger { display:flex; } }

        /* Step connector line — hide on mobile */
        .step-connector { position:absolute;top:24px;left:20%;right:20%;height:1px;background:linear-gradient(90deg,transparent,rgba(61,126,255,0.35),rgba(61,126,255,0.35),transparent); }
        @media(max-width:767px) { .step-connector { display:none; } }

        /* Founders */
        .founders-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:16px; }
        @media(max-width:1023px) { .founders-grid { grid-template-columns:repeat(2,1fr); } }
        @media(max-width:559px)  { .founders-grid { grid-template-columns:1fr; } }

        /* Mission banner */
        .mission-banner { display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center; }
        @media(max-width:767px) { .mission-banner { grid-template-columns:1fr;gap:24px; } }

        /* Footer bottom */
        .footer-bottom { display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px; }
        @media(max-width:479px) { .footer-bottom { flex-direction:column;align-items:flex-start; } }

        /* Word swap animation */
        .word-swap { display:inline-block;transition:opacity 0.32s ease,transform 0.32s ease; }

        /* Hero badge entrance */
        .hero-badge { animation:slideUp 0.8s ease both; }
        .hero-h1    { animation:slideUp 0.8s ease 0.1s both; }
        .hero-p     { animation:slideUp 0.8s ease 0.2s both; }
        .hero-btns-anim { animation:slideUp 0.8s ease 0.3s both; }
        .hero-social { animation:slideUp 0.8s ease 0.4s both; }
        .hero-card-anim { animation:slideUp 0.9s ease 0.2s both; }

        /* Notification */
        .notif-pop { animation:slideInRight 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @media(max-width:479px) {
          .notif-pop {
            right:12px !important;bottom:12px !important;left:12px !important;
            animation:slideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
          }
        }

        /* Touch-friendly tap targets */
        @media(hover:none) {
          .glow-btn:hover, .ghost-btn:hover { transform:none; }
        }
      `}</style>

      <div className="noise-layer" />

      {/* ── Top Announcement Bar ── */}
      <div style={{
        position: 'relative',
        zIndex: 50,
        background: 'linear-gradient(135deg, rgba(61,126,255,0.12) 0%, rgba(110,74,255,0.08) 50%, rgba(16,185,129,0.06) 100%)',
        borderBottom: '1px solid rgba(61,126,255,0.15)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        overflow: 'hidden',
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 200,
          height: 60,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(61,126,255,0.25) 0%, transparent 70%)',
          animation: 'orbFloat 4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', position: 'relative', zIndex: 1 }}>
          🚀 Built by MBBS students to help students study smarter.
        </span>
      </div>

      {/* ── Floating Notification ── */}
      {notification && (
        <div className="notif-pop" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 998 }}>
          <div style={{ background: '#0D0E18', border: '1px solid rgba(16,185,129,0.28)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 20px 48px rgba(0,0,0,0.5)', maxWidth: 280 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trophy style={{ width: 15, height: 15, color: '#10B981' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Achievement Unlocked!</p>
              <p style={{ fontSize: 12, color: '#475569' }}>First Login Badge earned 🎉</p>
            </div>
            <button onClick={() => setNotification(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0 }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav aria-label="Main navigation" style={{
        position: 'sticky', top: 0, zIndex: 40,
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        background: isScrolled ? 'rgba(7,8,15,0.88)' : 'transparent',
        borderBottom: isScrolled ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <div className="container" style={{ padding: '0 24px' }}>
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Logo */}
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
              <img
                src="/images/logo.png"
                alt="Scholar's Circle"
                style={{ height: 40, width: 'auto', objectFit: 'contain' }}
              />
              <span style={{ ...S, fontWeight: 800, fontSize: 17, color: '#fff' }}>Scholar's Circle</span>
            </Link>

            {/* Desktop links */}
            <div className="nav-desktop-links">
              {[
                { label: 'Features', href: '#features' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Pricing', href: '#pricing' }
              ].map(l => (
                <a
                  key={l.label}
                  href={l.href}
                  style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 0, transition: 'color 0.2s', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#64748B'}
                >
                  {l.label}
                </a>
              ))}
            </div>

            {/* Desktop auth */}
            <div className="nav-desktop-auth">
              <Link to="/login" style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '0 14px', height: 38, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Sign In</Link>
              <Link to="/signup" className="glow-btn" style={{ padding: '0 18px', height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#3D7EFF,#6E4AFF)', fontSize: 14, fontWeight: 600, color: '#fff', boxShadow: '0 0 18px rgba(61,126,255,0.28)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                Get Started Free
              </Link>
            </div>

            {/* Hamburger */}
            <button className="hamburger" onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '7px', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Menu style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="mobile-menu-dropdown" style={{ background: '#0D0E18', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
              {[
                { label: 'Features', href: '#features' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Pricing', href: '#pricing' }
              ].map(l => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 15, fontWeight: 500, cursor: 'pointer', padding: '11px 8px', textAlign: 'left', borderRadius: 8, transition: 'background 0.15s', textDecoration: 'none', display: 'block' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 11, padding: '12px', fontSize: 15, fontWeight: 600, color: '#94A3B8', cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
                Sign In
              </Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)} className="glow-btn" style={{ padding: '12px', borderRadius: 11, background: 'linear-gradient(135deg,#3D7EFF,#6E4AFF)', fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none', textAlign: 'center' }}>
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} aria-labelledby="hero-heading" className="hero-section container" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Spotlight (desktop only) */}
        {!isMobile && (
          <div style={{ position: 'absolute', left: `${mousePos.x}%`, top: `${mousePos.y}%`, transform: 'translate(-50%,-50%)', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(61,126,255,0.09) 0%,transparent 65%)', pointerEvents: 'none', transition: 'left 0.6s ease,top 0.6s ease', zIndex: 0 }} />
        )}
        {/* BG orbs */}
        <div style={{ position: 'absolute', top: -60, right: isMobile ? -80 : -60, width: isMobile ? 280 : 440, height: isMobile ? 280 : 440, borderRadius: '50%', background: 'radial-gradient(circle,rgba(110,74,255,0.1) 0%,transparent 70%)', animation: 'orbFloat 9s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: isMobile ? -60 : -80, width: isMobile ? 200 : 360, height: isMobile ? 200 : 360, borderRadius: '50%', background: 'radial-gradient(circle,rgba(61,126,255,0.07) 0%,transparent 70%)', animation: 'orbFloat 11s ease-in-out infinite reverse', pointerEvents: 'none' }} />

        <div className="hero-grid" style={{ position: 'relative', zIndex: 1 }}>

          {/* Left */}
          <div>
            <div className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(61,126,255,0.08)', border: '1px solid rgba(61,126,255,0.22)', marginBottom: isMobile ? 22 : 28 }}>
              <div className="active-dot" />
              <span style={{ ...M, fontSize: 11, color: '#3D7EFF', letterSpacing: '0.05em' }}>AI-Powered Study Platform</span>
            </div>

            <h1 id="hero-heading" className="hero-h1" style={{ ...S, fontSize: isMobile ? '2.4rem' : 'clamp(3rem,6vw,4.6rem)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.025em', marginBottom: isMobile ? 18 : 24 }}>
              Master Every<br />
              <span className="word-swap" style={{ color: '#3D7EFF', opacity: wordVisible ? 1 : 0, transform: wordVisible ? 'translateY(0)' : 'translateY(10px)' }}>
                {ROTATING_WORDS[wordIdx]}
              </span>
              <br />with Confidence
            </h1>

            <p className="hero-p" style={{ color: '#64748B', fontSize: isMobile ? 15 : 17, lineHeight: 1.72, maxWidth: 460, marginBottom: isMobile ? 28 : 36 }}>
              Scholar's Circle combines smart spaced repetition, gamified learning, and AI-generated questions to transform how you study.
            </p>

            <div className="hero-btns hero-btns-anim">
              <Link to="/signup" className="glow-btn" style={{ padding: isMobile ? '13px 22px' : '14px 28px', borderRadius: 13, background: 'linear-gradient(135deg,#3D7EFF,#6E4AFF)', fontSize: 15, fontWeight: 700, color: '#fff', boxShadow: '0 0 28px rgba(61,126,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: isMobile ? '100%' : 'auto', textDecoration: 'none' }}>
                Start Studying Free <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
              <button
                className="ghost-btn"
                onClick={() => setVideoModalOpen(true)}
                style={{ padding: isMobile ? '13px 22px' : '14px 28px', borderRadius: 13, fontSize: 15, fontWeight: 600, width: isMobile ? '100%' : 'auto' }}
              >
                Watch Demo
              </button>
            </div>

            <div className="hero-social" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: isMobile ? 24 : 32 }}>
              <div style={{ display: 'flex' }}>
                {['#3D7EFF', '#10B981', '#F5A623', '#EC4899'].map((c, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${c},${c}77)`, border: '2px solid #07080F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', marginLeft: i === 0 ? 0 : -9 }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <p style={{ color: '#475569', fontSize: 13 }}>
                <span style={{ color: '#94A3B8', fontWeight: 600 }}>1,000+</span> students studying smarter
              </p>
            </div>
          </div>

          {/* Right — Dashboard card (tablet/desktop only) */}
          <div className="hero-card-wrap hero-card-anim">
            {/* Floating top badge */}
            <div style={{ position: 'absolute', top: -16, right: -12, background: '#0D0E18', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 13, padding: '9px 14px', boxShadow: '0 10px 28px rgba(0,0,0,0.4)', zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy style={{ width: 14, height: 14, color: '#F5A623' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Top 10% 🏆</span>
            </div>
            {/* Floating bottom badge */}
            <div style={{ position: 'absolute', bottom: -16, left: -12, background: '#0D0E18', border: '1px solid rgba(61,126,255,0.3)', borderRadius: 13, padding: '9px 14px', boxShadow: '0 10px 28px rgba(0,0,0,0.4)', zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="active-dot" style={{ width: 7, height: 7 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8' }}><span style={{ color: '#3D7EFF' }}>24</span> studying now</span>
            </div>

            <div style={{ background: '#0D0E18', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 22, padding: 26, boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                <div>
                  <p style={{ ...M, fontSize: 10, color: '#334155', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Live Dashboard</p>
                  <p style={{ ...S, fontWeight: 700, fontSize: 17, color: '#fff' }}>BIO 111 Progress</p>
                </div>
                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 8, padding: '4px 10px' }}>
                  <span style={{ ...M, fontSize: 11, color: '#10B981' }}>Week 3 ↑ +14%</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
                {PROGRESS_BARS.map((bar, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#94A3B8' }}>{bar.label}</span>
                      <span style={{ ...M, fontSize: 12, color: bar.color }}>{bar.pct}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                      {barsAnimated && (
                        <div className="progress-fill" style={{ '--w': `${bar.pct}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg,${bar.color},${bar.color}88)`, animationDelay: `${bar.delay}ms` }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[{ l: 'XP Today', v: '+240', c: '#F5A623' }, { l: 'Streak', v: '7d 🔥', c: '#EF4444' }, { l: 'Accuracy', v: '89%', c: '#10B981' }].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 13, padding: '13px 8px', textAlign: 'center' }}>
                    <div style={{ ...S, color: s.c, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{s.v}</div>
                    <div style={{ color: '#475569', fontSize: 11 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Credibility Section ── */}
      <section ref={credibilityRef} aria-labelledby="credibility-heading" className="container" style={{ padding: isMobile ? '0 18px 56px' : '0 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 44 }}>
          <span className="section-label" style={{ ...M }}>Why Students Trust Scholar's Circle</span>
          <h2 id="credibility-heading" style={{ ...S, fontSize: 'clamp(1.8rem,4vw,2.7rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Built on Science and Experience
          </h2>
          <p style={{ color: '#475569', maxWidth: 420, margin: '0 auto', lineHeight: 1.7, fontSize: 15 }}>
            Our platform combines proven learning techniques with real student insights.
          </p>
        </div>
        <div className="credibility-grid" role="list">
          {CREDIBILITY_CARDS.map((c, i) => <CredibilityCard key={i} card={c} index={i} visible={credibilityInView} />)}
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="divider container" style={{ padding: '0 24px' }} />
      <section ref={statsRef} className="container section-pad">
        <div className="stats-grid">
          {STATS.map((s, i) => (
            <div key={i} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 18, padding: isMobile ? '20px 12px' : '26px 16px' }}>
              <div className="stat-shimmer" style={{ ...S, fontSize: isMobile ? 32 : 38, fontWeight: 800, lineHeight: 1, marginBottom: 8 }}>
                <AnimatedCounter target={s.target} suffix={s.suffix} start={statsInView} />
              </div>
              <p style={{ color: '#475569', fontSize: 12 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="divider container" style={{ padding: '0 24px' }} />

      {/* ── Features ── */}
      <section id="features" ref={featuresRef} aria-labelledby="features-heading" className="container section-pad">
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 36 : 48 }}>
          <span className="section-label" style={{ ...M }}>Features</span>
          <h2 id="features-heading" style={{ ...S, fontSize: 'clamp(1.8rem,4vw,2.7rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Everything You Need to Succeed
          </h2>
          <p style={{ color: '#475569', maxWidth: 400, margin: '0 auto', lineHeight: 1.7, fontSize: 15 }}>
            Powerful tools designed by students, for students.
          </p>
        </div>
        <div className="features-grid" role="list">
          {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} index={i} visible={featuresInView} isMobile={isMobile} />)}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" ref={stepsRef} aria-labelledby="how-it-works-heading" className="container" style={{ padding: isMobile ? '0 18px 56px' : '0 24px 80px' }}>
        <div className="steps-inner" style={{ background: 'rgba(61,126,255,0.04)', border: '1px solid rgba(61,126,255,0.1)', borderRadius: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 36 : 48 }}>
            <span className="section-label" style={{ ...M }}>How It Works</span>
            <h2 id="how-it-works-heading" style={{ ...S, fontSize: 'clamp(1.8rem,4vw,2.7rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Three Steps to Mastery
            </h2>
          </div>
          <div className="steps-grid" role="list">
            <div className="step-connector" aria-hidden="true" />
            {STEPS.map((item, i) => (
              <article key={i} role="listitem" style={{ opacity: stepsInView ? 1 : 0, transform: stepsInView ? 'translateY(0)' : 'translateY(24px)', transition: `all 0.7s ease ${i * 150}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(61,126,255,0.1)', border: '1px solid rgba(61,126,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D7EFF', flexShrink: 0 }} aria-hidden="true">
                    {item.icon}
                  </div>
                  <span style={{ ...M, color: 'rgba(61,126,255,0.45)', fontSize: 13 }}>{item.step}</span>
                </div>
                <h3 style={{ ...S, fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{item.title}</h3>
                <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 14 }}>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section ref={testiRef} aria-labelledby="testimonials-heading" className="container" style={{ padding: isMobile ? '0 18px 56px' : '0 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 44 }}>
          <span className="section-label" style={{ ...M }}>Student Stories</span>
          <h2 id="testimonials-heading" style={{ ...S, fontSize: 'clamp(1.8rem,4vw,2.7rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Loved by Students
          </h2>
        </div>
        <div className="testi-grid" role="list">
          {TESTIMONIALS.map((t, i) => <TestimonialCard key={i} t={t} visible={testiInView} delay={i * 110} />)}
        </div>
      </section>

      {/* ── Founder Story Section ── */}
      <section ref={storyRef} aria-labelledby="story-heading" className="container" style={{ padding: isMobile ? '0 18px 56px' : '0 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 36 : 52 }}>
          <span className="section-label" style={{ ...M }}>Our Story</span>
          <h2 id="story-heading" style={{ ...S, fontSize: 'clamp(1.8rem,4vw,2.7rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Why We Built Scholar's Circle
          </h2>
          <p style={{ color: '#475569', maxWidth: 520, margin: '0 auto', lineHeight: 1.75, fontSize: 15 }}>
            From struggling students to building a solution that actually works.
          </p>
        </div>

        {/* Timeline */}
        <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto' }} role="list">
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: isMobile ? 24 : 40, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg, rgba(61,126,255,0.3), rgba(61,126,255,0.1), rgba(61,126,255,0.3))' }} aria-hidden="true" />

          {FOUNDER_STORY.map((item, i) => (
            <article key={i} role="listitem" style={{
              display: 'flex',
              gap: isMobile ? 20 : 32,
              marginBottom: isMobile ? 32 : 48,
              opacity: storyInView ? 1 : 0,
              transform: storyInView ? 'translateX(0)' : 'translateX(-20px)',
              transition: `all 0.7s ease ${i * 150}ms`,
            }}>
              {/* Year badge */}
              <div style={{ flexShrink: 0, position: 'relative' }}>
                <div style={{
                  width: isMobile ? 48 : 56,
                  height: isMobile ? 48 : 56,
                  borderRadius: '50%',
                  background: `${item.color}18`,
                  border: `2px solid ${item.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  <span style={{ ...M, fontSize: isMobile ? 12 : 13, color: item.color, fontWeight: 700 }}>{item.year}</span>
                </div>
                {/* Dot on line */}
                <div style={{
                  position: 'absolute',
                  left: isMobile ? 23 : 39,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: item.color,
                  boxShadow: `0 0 12px ${item.color}`,
                  zIndex: 2,
                }} aria-hidden="true" />
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingTop: isMobile ? 4 : 8 }}>
                <h3 style={{ ...S, fontSize: isMobile ? 18 : 20, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{item.title}</h3>
                <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.75 }}>{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Founders ── */}
      <section ref={foundersRef} className="container" style={{ padding: isMobile ? '0 18px 56px' : '0 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 36 : 52 }}>
          <span className="section-label" style={{ fontFamily: 'JetBrains Mono,monospace' }}>Meet the Founders</span>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 'clamp(1.8rem,4vw,2.7rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Built by Students, for Students
          </h2>
          <p style={{ color: '#475569', maxWidth: 520, margin: '0 auto', lineHeight: 1.75, fontSize: 15 }}>
            Scholar's Circle was founded by three MBBS students who understand the realities of academic life — from managing demanding coursework to finding reliable study resources and collaborating with peers.
          </p>
        </div>

        {/* Founder Cards */}
        <div className="founders-grid" style={{ marginBottom: isMobile ? 32 : 48 }}>
          {FOUNDERS.map((f, i) => (
            <FounderCard key={i} founder={f} index={i} visible={foundersInView} isMobile={isMobile} />
          ))}
        </div>

        {/* Mission Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(61,126,255,0.07), rgba(110,74,255,0.05))',
          border: '1px solid rgba(61,126,255,0.15)',
          borderRadius: 22,
          padding: isMobile ? '28px 20px' : '40px 48px',
          position: 'relative',
          overflow: 'hidden',
          opacity: foundersInView ? 1 : 0,
          transform: foundersInView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.7s ease 360ms, transform 0.7s ease 360ms',
        }}>
          {/* Glow */}
          <div style={{ position: 'absolute', top: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(61,126,255,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div className="mission-banner">
            {/* Left: mission label + text */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: 'rgba(61,126,255,0.1)', border: '1px solid rgba(61,126,255,0.25)', marginBottom: 16 }}>
                <Sparkles style={{ width: 13, height: 13, color: '#3D7EFF' }} />
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#3D7EFF', letterSpacing: '0.06em' }}>Our Mission</span>
              </div>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: isMobile ? 20 : 24, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 14, color: '#fff' }}>
                A Connected Academic Ecosystem
              </h3>
              <p style={{ color: '#475569', lineHeight: 1.78, fontSize: 14, maxWidth: 420 }}>
                To build a connected academic ecosystem where students can access resources, collaborate with peers, and unlock their full potential through technology-driven learning.
              </p>
            </div>

            {/* Right: 3 mission pillars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '🎯', label: 'Access', desc: 'Quality resources available to every student, everywhere.' },
                { icon: '🤝', label: 'Collaborate', desc: 'Peer-to-peer learning that multiplies individual effort.' },
                { icon: '🚀', label: 'Achieve', desc: 'Unlock full academic potential through intelligent tools.' },
              ].map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{p.icon}</span>
                  <div>
                    <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 3 }}>{p.label}</p>
                    <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.55 }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Mobile App Section ── */}
      <MobileAppSection />

      {/* ── Pricing Section ── */}
      <PricingSection />

      {/* ── CTA ── */}
      <section className="container" style={{ padding: isMobile ? '0 18px 56px' : '0 24px 80px' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(61,126,255,0.08),rgba(110,74,255,0.05))', border: '1px solid rgba(61,126,255,0.14)', borderRadius: 24, padding: isMobile ? '40px 20px' : 'clamp(48px,8vw,72px) clamp(24px,6vw,64px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(61,126,255,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <span className="section-label" style={{ ...M }}>Get Started</span>
          <h2 style={{ ...S, fontSize: 'clamp(1.6rem,4vw,2.7rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 14, position: 'relative' }}>
            Ready to Transform Your Study Game?
          </h2>
          <p style={{ color: '#475569', maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.7, fontSize: 15, position: 'relative' }}>
            Join hundreds of students achieving better grades with smarter, science-backed studying.
          </p>
          <div className="cta-btns" style={{ position: 'relative' }}>
            <Link to="/signup" className="glow-btn" style={{ padding: '13px 26px', borderRadius: 13, background: 'linear-gradient(135deg,#3D7EFF,#6E4AFF)', fontSize: 15, fontWeight: 700, color: '#fff', boxShadow: '0 0 26px rgba(61,126,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
              Create Free Account <ArrowRight style={{ width: 15, height: 15 }} />
            </Link>
            <button className="ghost-btn" style={{ padding: '13px 26px', borderRadius: 13, fontSize: 15, fontWeight: 600 }}>
              Schedule a Demo
            </button>
          </div>
          <p style={{ color: '#1E293B', fontSize: 13, marginTop: 18, position: 'relative' }}>No credit card required · Instant access · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: isMobile ? '36px 18px' : '48px 24px', maxWidth: 1280, margin: '0 auto' }}>
        <div className="footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#3D7EFF,#6E4AFF)' }} />
              <span style={{ ...S, fontWeight: 800, fontSize: 16 }}>Scholar's Circle</span>
            </div>
            <p style={{ color: '#334155', fontSize: 13, lineHeight: 1.65, maxWidth: 210 }}>Empowering students to study smarter with science and AI.</p>
          </div>
          {[
            { title: 'Product', links: ['Features', 'Pricing', 'How it Works', 'Roadmap'] },
            { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
            { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies'] },
          ].map(col => (
            <div key={col.title}>
              <p style={{ ...S, color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>{col.title}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(l => (
                  <a key={l} href="#" style={{ color: '#334155', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.target.style.color = '#94A3B8'}
                    onMouseLeave={e => e.target.style.color = '#334155'}>{l}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 22 }}>
          <div className="footer-bottom">
            <p style={{ color: '#1E293B', fontSize: 13 }}>© 2025 Scholar's Circle. All rights reserved.</p>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Twitter', 'GitHub', 'Discord'].map(s => (
                <a key={s} href="#" style={{ color: '#1E293B', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = '#3D7EFF'}
                  onMouseLeave={e => e.target.style.color = '#1E293B'}>{s}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      {videoModalOpen && (
        <div
          onClick={() => setVideoModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '800px',
              aspectRatio: '16 / 9',
              background: '#000',
              borderRadius: '12px',
              overflow: 'hidden'
            }}
          >
            <button
              onClick={() => setVideoModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/P3sB7zhRGNs?autoplay=1"
              title="Scholar's Circle Demo"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 'none' }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
