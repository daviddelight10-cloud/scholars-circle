import posts from 'virtual:blog-posts';
import { Link } from 'react-router-dom';

export { posts };

export function getPostBySlug(slug) {
  return posts.find(p => p.slug === slug);
}

export function getAllTags() {
  const tagSet = new Set();
  posts.forEach(p => p.tags.forEach(t => tagSet.add(t)));
  return Array.from(tagSet);
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
