import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPostBySlug, formatDate, posts } from './blogData';

const ink = '#0A0D13';
const inkSoft = '#11151E';
const line = 'rgba(255,255,255,0.08)';
const lineStrong = 'rgba(255,255,255,0.14)';
const text = '#EDEFF5';
const textDim = '#9AA3B5';
const textFaint = '#646E84';
const gold = '#F5A623';
const blue = '#FFD700';

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

  if (!post) return <Navigate to="/blog" replace />;

  const related = posts.filter(p => p.slug !== slug && p.tags.some(t => post.tags.includes(t))).slice(0, 2);

  useEffect(() => {
    if (post.ogImage) {
      let meta = document.querySelector('meta[property="og:image"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', 'og:image');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', `https://scholarscircle.com.ng${post.ogImage}`);
    }
    if (post.title) {
      document.title = `${post.title} — Scholar's Circle Blog`;
    }
    return () => { document.title = "Scholar's Circle"; };
  }, [post]);

  return (
    <main style={{ background: ink, color: text, fontFamily: 'Manrope, sans-serif', fontSize: 17, lineHeight: 1.7, minHeight: '100vh' }}>
      <style>{`
        a { color: inherit; text-decoration: none; }
        .prose h1 { font-family: 'Syne', sans-serif; font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 800; margin: 0 0 16px; line-height: 1.15; }
        .prose h2 { font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 700; margin: 40px 0 14px; color: ${text}; }
        .prose h3 { font-family: 'Syne', sans-serif; font-size: 1.2rem; font-weight: 700; margin: 32px 0 10px; color: ${text}; }
        .prose p { margin: 0 0 18px; color: ${textDim}; }
        .prose ul, .prose ol { margin: 0 0 18px; padding-left: 24px; color: ${textDim}; }
        .prose li { margin-bottom: 8px; }
        .prose a { color: ${gold}; text-decoration: underline; }
        .prose code { font-family: 'JetBrains Mono, monospace'; font-size: 0.88rem; background: ${inkSoft}; border: 1px solid ${line}; border-radius: 4px; padding: 2px 6px; }
        .prose pre { background: ${inkSoft}; border: 1px solid ${line}; border-radius: 10px; padding: 16px; overflow-x: auto; margin: 0 0 18px; }
        .prose pre code { background: none; border: none; padding: 0; }
        .prose blockquote { border-left: 3px solid ${gold}; padding-left: 16px; margin: 0 0 18px; color: ${textDim}; font-style: italic; }
        .prose table { width: 100%; border-collapse: collapse; margin: 0 0 18px; }
        .prose th, .prose td { border: 1px solid ${line}; padding: 10px 14px; text-align: left; color: ${textDim}; }
        .prose th { color: ${text}; font-weight: 600; }
        .prose hr { border: none; border-top: 1px solid ${line}; margin: 32px 0; }
        .prose img { max-width: 100%; border-radius: 12px; margin: 18px 0; }
        @media (max-width: 760px) { .wrap { padding: 0 20px !important; } .prose { font-size: 16px !important; } }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,13,19,0.78)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: text }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: gold, boxShadow: `0 0 0 4px rgba(245,166,35,0.14)` }} />
            Scholar's Circle
          </Link>
          <Link to="/blog" style={{ fontSize: '0.88rem', fontWeight: 600, color: textDim }}>← All posts</Link>
        </div>
      </header>

      <article style={{ padding: '64px 0 32px' }}>
        <div className="wrap" style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {post.tags.map(tag => (
              <span key={tag} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: textDim, border: `1px solid ${lineStrong}`, borderRadius: 999, padding: '3px 9px' }}>{tag}</span>
            ))}
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, marginBottom: 14, lineHeight: 1.15 }}>{post.title}</h1>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: textFaint, marginBottom: 40 }}>{formatDate(post.date)}{post.readingTime ? ` · ${post.readingTime} min read` : ''}</p>

          <div className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>

          <div style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${line}` }}>
            <div style={{ background: `linear-gradient(135deg, ${inkSoft}, ${ink})`, border: `1px solid ${line}`, borderRadius: 18, padding: '32px 28px', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.4rem', fontWeight: 700, marginBottom: 10 }}>Ready to study smarter?</h2>
              <p style={{ color: textDim, fontSize: '0.95rem', marginBottom: 20 }}>Try Scholar's Circle free for 2 days. No card needed.</p>
              <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: gold, color: '#1A1300', fontWeight: 700, borderRadius: 999, fontSize: '0.92rem' }}>Start free trial →</Link>
            </div>
          </div>

          {related.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>Related posts</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {related.map(rp => (
                  <Link key={rp.slug} to={`/blog/${rp.slug}`} style={{ background: inkSoft, border: `1px solid ${line}`, borderRadius: 12, padding: 20, display: 'block' }}>
                    <h4 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1rem', fontWeight: 600, marginBottom: 6, color: text }}>{rp.title}</h4>
                    <p style={{ fontSize: '0.85rem', color: textDim }}>{rp.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      <footer style={{ borderTop: `1px solid ${line}`, padding: '32px 0' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Link to="/blog" style={{ color: textDim, fontSize: '0.88rem' }}>← All posts</Link>
          <Link to="/" style={{ color: textDim, fontSize: '0.88rem' }}>Back to home →</Link>
        </div>
      </footer>
    </main>
  );
}
