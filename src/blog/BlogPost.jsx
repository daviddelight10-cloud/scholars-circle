import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPostBySlug, formatDate, posts } from './blogData';

const ink = '#0a0a0a';
const inkSoft = '#121212';
const line = 'rgba(255,255,255,0.08)';
const lineStrong = 'rgba(255,255,255,0.14)';
const text = '#EDEFF5';
const textDim = '#9AA3B5';
const textFaint = '#646E84';
const gold = '#F5A623';
const blue = '#FFD700';
const SITE = 'https://scholarscircle.com.ng';
const DEFAULT_OG = `${SITE}/og-image.jpg`;

// Wrapper keeps the not-found redirect out of the hook-bearing component so
// hook order is stable across renders (fixes rules-of-hooks violation).
export default function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

  if (!post) return <Navigate to="/blog" replace />;

  return <BlogPostView post={post} slug={slug} />;
}

function setMeta(selector, attr, key, value) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
  return el;
}

function BlogPostView({ post, slug }) {
  const [copied, setCopied] = useState(false);
  const postUrl = `${SITE}/blog/${slug}`;
  const ogImageAbs = post.ogImage ? `${SITE}${post.ogImage}` : DEFAULT_OG;

  const related = posts.filter(p => p.slug !== slug && p.tags.some(t => post.tags.includes(t))).slice(0, 2);

  // Split content ~40% in at an h2 boundary for the mid-article CTA.
  const [beforeCta, afterCta] = useMemo(() => {
    const h2s = [...post.content.matchAll(/\n## /g)].map(m => m.index);
    const target = post.content.length * 0.4;
    const cut = h2s.find(i => i > target) ?? null;
    if (!cut) return [post.content, null];
    return [post.content.slice(0, cut), post.content.slice(cut)];
  }, [post.content]);

  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');

    document.title = `${post.title} — Scholar's Circle Blog`;
    setMeta('meta[name="description"]', 'name', 'description', post.excerpt);
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'article');
    setMeta('meta[property="og:title"]', 'property', 'og:title', post.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', post.excerpt);
    setMeta('meta[property="og:url"]', 'property', 'og:url', postUrl);
    setMeta('meta[property="og:image"]', 'property', 'og:image', ogImageAbs);
    setMeta('meta[property="twitter:title"]', 'property', 'twitter:title', post.title);
    setMeta('meta[property="twitter:description"]', 'property', 'twitter:description', post.excerpt);
    setMeta('meta[property="twitter:image"]', 'property', 'twitter:image', ogImageAbs);

    // Article structured data — enables rich snippets (headline/date in search).
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.dataset.blogPost = '1';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt,
      image: ogImageAbs,
      datePublished: post.date,
      author: { '@type': 'Organization', name: "Scholar's Circle" },
      publisher: {
        '@type': 'Organization',
        name: "Scholar's Circle",
        logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` },
      },
      mainEntityOfPage: postUrl,
    });
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      if (prevDesc) setMeta('meta[name="description"]', 'name', 'description', prevDesc);
      setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
      setMeta('meta[property="og:title"]', 'property', 'og:title', "Scholar's Circle — Turn lecture PDFs into practice questions");
      setMeta('meta[property="og:description"]', 'property', 'og:description', "Circle anything in your notes to ask AI. Timed exam sims. Live quiz rooms with friends. Free forever — built by MBBS students.");
      setMeta('meta[property="og:url"]', 'property', 'og:url', SITE);
      setMeta('meta[property="og:image"]', 'property', 'og:image', DEFAULT_OG);
      setMeta('meta[property="twitter:title"]', 'property', 'twitter:title', "Scholar's Circle — Turn lecture PDFs into practice questions");
      setMeta('meta[property="twitter:description"]', 'property', 'twitter:description', "Circle anything in your notes to ask AI. Timed exam sims. Live quiz rooms with friends. Free forever — built by MBBS students.");
      setMeta('meta[property="twitter:image"]', 'property', 'twitter:image', DEFAULT_OG);
      ld.remove();
    };
  }, [post, postUrl, ogImageAbs]);

  const waShare = `https://wa.me/?text=${encodeURIComponent(`${post.title} — ${postUrl}`)}`;
  const xShare = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(postUrl)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const shareBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '8px 15px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700,
    border: `1px solid ${lineStrong}`, background: 'rgba(255,255,255,0.04)',
    color: textDim, cursor: 'pointer', textDecoration: 'none', fontFamily: 'Manrope, sans-serif',
  };

  const ShareRow = () => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <a href={waShare} target="_blank" rel="noopener noreferrer" style={{ ...shareBtn, color: '#3DD68C', borderColor: 'rgba(61,214,140,0.35)' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp
      </a>
      <a href={xShare} target="_blank" rel="noopener noreferrer" style={shareBtn}>Share on X</a>
      <button onClick={copyLink} style={shareBtn}>{copied ? '✓ Copied' : 'Copy link'}</button>
    </div>
  );

  const CtaCard = ({ compact }) => (
    <div style={{ background: `linear-gradient(135deg, ${inkSoft}, ${ink})`, border: `1px solid ${line}`, borderLeft: `3px solid ${gold}`, borderRadius: 14, padding: compact ? '20px 22px' : '32px 28px', margin: compact ? '28px 0' : 0, textAlign: compact ? 'left' : 'center' }}>
      <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: compact ? '1.05rem' : '1.4rem', fontWeight: 700, marginBottom: 8 }}>{compact ? 'Try this on your own notes' : 'Ready to study smarter?'}</h2>
      <p style={{ color: textDim, fontSize: compact ? '0.88rem' : '0.95rem', marginBottom: 14 }}>Upload a lecture PDF and get practice questions in seconds. 2 days of full access — no card.</p>
      <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: gold, color: '#1A1300', fontWeight: 800, borderRadius: 999, fontSize: '0.9rem' }}>Start free →</Link>
    </div>
  );

  return (
    <main style={{ background: ink, color: text, fontFamily: 'Manrope, sans-serif', fontSize: 17, lineHeight: 1.7, minHeight: '100dvh' }}>
      <style>{`
        a { color: inherit; text-decoration: none; }
        .prose h1 { font-family: 'Sora', sans-serif; font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 800; margin: 0 0 16px; line-height: 1.15; }
        .prose h2 { font-family: 'Sora', sans-serif; font-size: 1.5rem; font-weight: 700; margin: 40px 0 14px; color: ${text}; }
        .prose h3 { font-family: 'Sora', sans-serif; font-size: 1.2rem; font-weight: 700; margin: 32px 0 10px; color: ${text}; }
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
        .prose img { max-width: 100%; max-height: 560px; object-fit: contain; border-radius: 12px; margin: 18px auto; display: block; border: 1px solid ${line}; }
        .prose em { color: ${textFaint}; font-size: 0.85rem; display: block; text-align: center; margin-top: -8px; }
        @media (max-width: 760px) { .wrap { padding: 0 20px !important; } .prose { font-size: 16px !important; } }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,0.78)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: text }}>
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
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, marginBottom: 14, lineHeight: 1.15 }}>{post.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: textDim }}>Scholar's Circle team</span>
            <time dateTime={post.date} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: textFaint }}>{formatDate(post.date)}</time>
            {post.readingTime && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: textFaint }}>· {post.readingTime} min read</span>}
          </div>
          <div style={{ marginBottom: 40 }}>
            <ShareRow />
          </div>

          <div className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{beforeCta}</ReactMarkdown>
          </div>

          {afterCta && (
            <>
              <CtaCard compact />
              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{afterCta}</ReactMarkdown>
              </div>
            </>
          )}

          <div style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${line}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: textFaint, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>Share this post</p>
            <ShareRow />
          </div>

          <div style={{ marginTop: 40 }}>
            <CtaCard />
          </div>

          {related.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>Related posts</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {related.map(rp => (
                  <Link key={rp.slug} to={`/blog/${rp.slug}`} style={{ background: inkSoft, border: `1px solid ${line}`, borderRadius: 12, padding: 20, display: 'block' }}>
                    <h4 style={{ fontFamily: 'Sora, sans-serif', fontSize: '1rem', fontWeight: 600, marginBottom: 6, color: text }}>{rp.title}</h4>
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
