import React from 'react';
import { Link } from 'react-router-dom';
import { posts, formatDate } from './blogData';

const ink = '#0A0D13';
const inkSoft = '#11151E';
const inkCard = '#151A24';
const line = 'rgba(255,255,255,0.08)';
const lineStrong = 'rgba(255,255,255,0.14)';
const text = '#EDEFF5';
const textDim = '#9AA3B5';
const textFaint = '#646E84';
const gold = '#F5A623';
const blue = '#FFD700';

export default function BlogList() {
  return (
    <main style={{ background: ink, color: text, fontFamily: 'Manrope, sans-serif', fontSize: 16, lineHeight: 1.55, minHeight: '100vh' }}>
      <style>{`
        a { color: inherit; text-decoration: none; }
        .blog-card { transition: border-color 0.2s ease, transform 0.2s ease; }
        .blog-card:hover { border-color: ${lineStrong}; transform: translateY(-2px); }
        @media (max-width: 760px) { .blog-grid { grid-template-columns: 1fr !important; } .wrap { padding: 0 20px !important; } }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,13,19,0.78)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: text }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: gold, boxShadow: `0 0 0 4px rgba(245,166,35,0.14)` }} />
            Scholar's Circle
          </Link>
          <Link to="/signup" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1A1300', background: gold, padding: '8px 16px', borderRadius: 999 }}>Start free</Link>
        </div>
      </header>

      <section style={{ padding: '64px 0 32px' }}>
        <div className="wrap" style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 600, color: blue, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Scholar's Circle Blog</span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, fontFamily: 'Syne, sans-serif', marginBottom: 16 }}>Study smarter, not harder.</h1>
          <p style={{ color: textDim, fontSize: '1.1rem', maxWidth: 580 }}>Evidence-backed study tips, exam prep guides, and the science behind how your brain actually learns.</p>
        </div>
      </section>

      <section style={{ padding: '32px 0 96px' }}>
        <div className="wrap" style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div className="blog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 22 }}>
            {posts.map(post => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="blog-card" style={{ background: inkCard, border: `1px solid ${line}`, borderRadius: 18, padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {post.tags.map(tag => (
                    <span key={tag} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: textDim, border: `1px solid ${lineStrong}`, borderRadius: 999, padding: '3px 9px' }}>{tag}</span>
                  ))}
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: text }}>{post.title}</h2>
                <p style={{ color: textDim, fontSize: '0.92rem', flex: 1 }}>{post.excerpt}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${line}` }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: textFaint }}>{formatDate(post.date)}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: gold }}>Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${line}`, padding: '32px 0' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Link to="/" style={{ color: textDim, fontSize: '0.88rem' }}>← Back to home</Link>
          <Link to="/signup" style={{ color: textDim, fontSize: '0.88rem' }}>Try Scholar's Circle free →</Link>
        </div>
      </footer>
    </main>
  );
}
