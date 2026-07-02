import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

const BLOG_ARTICLES = [
  {
    id: 1,
    category: 'Study Tips',
    title: '10 Proven Techniques to Boost Your Memory for Exams',
    excerpt: 'Struggling to remember everything you study? These 10 science-backed techniques will help you retain information longer and recall it faster during exams. From the Feynman Technique to spaced repetition, learn how top students maximize their memory potential.',
    date: 'May 15, 2026',
    readTime: '5 min read',
    color: '#3D7EFF',
    image: null
  },
  {
    id: 2,
    category: 'Exam Prep',
    title: 'How to Create an Effective Study Schedule That Actually Works',
    excerpt: 'Stop cramming and start studying smart. This guide shows you how to build a personalized study schedule that balances all your subjects, includes proper breaks, and adapts to your energy levels throughout the day. Includes downloadable templates.',
    date: 'May 10, 2026',
    readTime: '7 min read',
    color: '#10B981',
    image: null
  },
  {
    id: 3,
    category: 'Learning Science',
    title: 'The Psychology of Effective Learning: What Research Tells Us',
    excerpt: 'Why do some study methods work better than others? Dive into the cognitive science behind learning. Discover how your brain processes information, the importance of sleep in memory consolidation, and why multitasking is killing your productivity.',
    date: 'May 5, 2026',
    readTime: '6 min read',
    color: '#EC4899',
    image: null
  }
];

export default function BlogSection() {
  return (
    <section id="blog" style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #07080F 0%, #0D0E18 100%)'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            color: '#3D7EFF',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '12px',
            display: 'block'
          }}>
            Resources
          </span>
          <h2 style={{
            fontSize: 'clamp(1.875rem, 4vw, 3rem)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '16px'
          }}>
            Latest Study Tips & Insights
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Expert advice and proven strategies to help you study smarter and achieve better results.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px'
        }}>
          {BLOG_ARTICLES.map((article) => (
            <article
              key={article.id}
              className="hover-lift hover-border"
              style={{
                background: 'linear-gradient(145deg, rgba(20, 20, 20, 0.5), rgba(10, 10, 10, 0.5))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '28px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {/* Category badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                background: `${article.color}15`,
                border: `1px solid ${article.color}30`,
                marginBottom: '20px',
                fontSize: '12px',
                fontWeight: 600,
                color: article.color
              }}>
                {article.category}
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '12px',
                lineHeight: 1.4
              }}>
                {article.title}
              </h3>

              {/* Excerpt */}
              <p style={{
                color: '#94a3b8',
                fontSize: '14px',
                lineHeight: 1.7,
                marginBottom: '20px'
              }}>
                {article.excerpt}
              </p>

              {/* Meta info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#64748b'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar style={{ width: 14, height: 14 }} />
                  {article.date}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock style={{ width: 14, height: 14 }} />
                  {article.readTime}
                </div>
              </div>

              {/* Read more link */}
              <Link
                to="/blog"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: article.color,
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'gap 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.gap = '12px'}
                onMouseLeave={(e) => e.currentTarget.style.gap = '8px'}
              >
                Read Article <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
            </article>
          ))}
        </div>

        {/* View all link */}
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <Link
            to="/blog"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 28px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            View All Articles <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </div>
    </section>
  );
}
