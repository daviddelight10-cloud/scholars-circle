import React from 'react';

export default function FeaturesSection() {
  const features = [
    {
      icon: '📚',
      title: 'Practice Exams',
      description: 'Access thousands of practice questions across all subjects with instant feedback and detailed explanations.'
    },
    {
      icon: '🤖',
      title: 'AI Tutor',
      description: 'Get personalized help from our AI tutor that adapts to your learning style and pace.'
    },
    {
      icon: '🎴',
      title: 'Smart Flashcards',
      description: 'Use spaced repetition to memorize concepts efficiently and retain information longer.'
    },
    {
      icon: '📊',
      title: 'Progress Tracking',
      description: 'Monitor your improvement with detailed analytics and performance insights.'
    },
    {
      icon: '🎯',
      title: 'Weak Areas Focus',
      description: 'Identify and focus on your weak areas with targeted practice recommendations.'
    },
    {
      icon: '🏆',
      title: 'Gamification',
      description: 'Stay motivated with XP, streaks, leaderboards, and achievement badges.'
    },
    {
      icon: '📅',
      title: 'Study Planner',
      description: 'Create personalized study schedules and track your daily progress.'
    },
    {
      icon: '💬',
      title: 'Discussion Board',
      description: 'Connect with peers, ask questions, and share knowledge in subject-specific forums.'
    },
    {
      icon: '📱',
      title: 'Mobile Access',
      description: 'Study anywhere with our mobile-friendly platform optimized for all devices.'
    }
  ];

  return (
    <section id="features" style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #07080F 0%, #0D0E18 100%)'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{
            fontSize: 'clamp(1.875rem, 4vw, 3rem)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '16px'
          }}>
            Powerful Features for Effective Learning
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Everything you need to excel in your studies, all in one platform.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}>
          {features.map((feature, index) => (
            <div key={index} style={{
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5))',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '16px',
              padding: '24px',
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #3D7EFF, #6E4AFF)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                fontSize: '24px'
              }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                {feature.title}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6 }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
