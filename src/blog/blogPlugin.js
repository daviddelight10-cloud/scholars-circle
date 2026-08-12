import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.resolve(process.cwd(), 'src/blog/posts');

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  return files.map(filename => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
    const { data: frontmatter, content } = matter(raw);
    const slug = filename.replace(/\.md$/, '');
    return {
      slug,
      title: frontmatter.title || slug,
      date: frontmatter.date || new Date().toISOString().split('T')[0],
      excerpt: frontmatter.excerpt || '',
      tags: frontmatter.tags || [],
      ogImage: frontmatter.ogImage || null,
      readingTime: frontmatter.readingTime || null,
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
  };
}
