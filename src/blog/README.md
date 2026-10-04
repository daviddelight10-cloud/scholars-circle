# Blog — how to publish a post

Posts are plain Markdown files in `src/blog/posts/`. `blogPlugin.js` picks up every
`.md` in that folder at build time — no registration needed. The filename (minus
`.md`) becomes the URL slug: `/blog/<slug>`.

## Frontmatter template

```yaml
---
title: "The Headline That Shows in Google"
date: "2026-10-02"                    # YYYY-MM-DD — sort order + datePublished schema
excerpt: "One or two sentences. Becomes the meta description, OG description, and card text — write it for a skimmer."
tags: ["anatomy", "study-tips"]       # related posts are auto-matched by shared tags
ogImage: "/blog/images/my-post.png"   # must be a real file under public/ — a broken ref = no WhatsApp preview
---
```

**Don't set `readingTime`** — auto-computed at ~200 wpm by the plugin.

## Automatic (don't hand-build these)

- Bottom signup CTA + share buttons (WhatsApp / X / copy link)
- Mid-article CTA — auto-inserted at the first `##` heading past ~40% of the post.
  No `##` headings = no mid-CTA, so structure longer posts with them.
- Related posts (shared tags), per-post OG/Twitter meta, Article JSON-LD

## Body images

```markdown
![Alt text — this is the SEO text](/images/showcase/circle-mark.jpg)

*Italic line right after the image renders as a caption.*
```

Images live under `public/` and are referenced from root (`/images/...`,
`/blog/images/...`). Portrait phone screenshots are centered and capped at
560px tall automatically.

## OG image spec

- **1200×630 px**, JPG/PNG, saved in `public/blog/images/`
- No image? Reuse a `/images/showcase/` shot or omit `ogImage` — falls back to
  the site og-image.

## Publish checklist

1. Write `src/blog/posts/<slug>.md` with frontmatter above
2. Drop the og image in `public/blog/images/` — verify it exists (typo = silent broken preview)
3. Add a `<url>` entry in `public/sitemap.xml` (loc + today's `lastmod`)
4. `npm run build`, push to `dev`
