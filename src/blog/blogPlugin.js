import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.resolve(process.cwd(), 'src/blog/posts');

const SITE_URL = 'https://scholarscircle.com.ng';
const SITE_NAME = "Scholar's Circle";
const OG_FALLBACK_IMAGE = `${SITE_URL}/og-image.jpg`;
const OG_FALLBACK_DESC =
  "Cram less, remember more. Upload your lecture PDFs, circle anything to ask AI, sit timed mock exams, and quiz friends live with voice.";

// Public, non-auth, indexable routes. Auth pages, the gated Research Hub,
// share links and ephemeral live-join pages stay out deliberately.
const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/features', priority: '0.8', changefreq: 'monthly' },
  { path: '/pricing', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog', priority: '0.8', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/copyright', priority: '0.3', changefreq: 'yearly' },
];

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildSitemap(posts) {
  const today = new Date().toISOString().split('T')[0];
  const urls = STATIC_ROUTES.map(
    (r) => `  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  );
  for (const p of posts) {
    urls.push(`  <url>
    <loc>${SITE_URL}/blog/${p.slug}</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

// Static crawler-facing OG page per post — same shape as the server's
// /og/* unfurl pages (noindex + meta-refresh for humans). Vercel rewrites
// /blog/:slug here for link-unfurl bots; real browsers get the SPA.
function buildOgPage({ title, description, canonical, image }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<link rel="canonical" href="${esc(canonical)}" />
<meta name="robots" content="noindex" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${esc(canonical)}" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0;url=${esc(canonical)}" />
</head>
<body>
<p>Opening <a href="${esc(canonical)}">${esc(title)}</a> on ${esc(SITE_NAME)}…</p>
</body>
</html>`;
}

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  return files.map(filename => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
    const { data: frontmatter, content } = matter(raw);
    const slug = filename.replace(/\.md$/, '');
    const words = content.trim().split(/\s+/).length;
    return {
      slug,
      title: frontmatter.title || slug,
      date: frontmatter.date || new Date().toISOString().split('T')[0],
      excerpt: frontmatter.excerpt || '',
      tags: frontmatter.tags || [],
      ogImage: frontmatter.ogImage || null,
      readingTime: frontmatter.readingTime || Math.max(1, Math.round(words / 200)),
      content,
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export default function blogPlugin() {
  const virtualId = 'virtual:blog-posts';
  const resolvedId = '\0' + virtualId;

  return {
    name: 'blog-posts',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        const posts = loadPosts();
        return `export default ${JSON.stringify(posts)}`;
      }
    },
    generateBundle() {
      const posts = loadPosts();
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: buildSitemap(posts),
      });
      for (const p of posts) {
        this.emitFile({
          type: 'asset',
          fileName: `og/blog/${p.slug}.html`,
          source: buildOgPage({
            title: `${p.title} — ${SITE_NAME}`,
            description: p.excerpt || OG_FALLBACK_DESC,
            canonical: `${SITE_URL}/blog/${p.slug}`,
            image: p.ogImage ? `${SITE_URL}${p.ogImage}` : OG_FALLBACK_IMAGE,
          }),
        });
      }
    },
  };
}
