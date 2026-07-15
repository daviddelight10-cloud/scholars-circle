import React from 'react';

export default function FeaturesSection() {
  const features = [
    {
      icon: '🩺',
      title: 'Clinical Case Simulations',
      description: 'Practice with interactive patient cases — from presenting complaint to differential diagnosis, investigations, and management plan.'
    },
    {
      icon: '🏥',
      title: 'OSCE Prep Stations',
      description: 'Prepare for Objective Structured Clinical Examinations with timed practice stations, checklists, and scoring rubrics.'
    },
    {
      icon: '💊',
      title: 'Drug Reference',
      description: 'Searchable drug database with indications, dosages, contraindications, interactions, and side effects at your fingertips.'
    },
    {
      icon: '🧪',
      title: 'Lab Values Reference',
      description: 'Quick access to normal ranges for CBC, LFT, RFT, electrolytes, and more with interpretation guidance.'
    },
    {
      icon: '🤖',
      title: 'AI Medical Tutor',
      description: 'Get personalized help from our AI tutor trained in clinical reasoning, anatomy, pharmacology, and pathology.'
    },
    {
      icon: '�',
      title: 'Spaced Repetition Flashcards',
      description: 'Memorize anatomy, drug names, and clinical protocols efficiently with SM-2 and FSRS algorithms.'
    },
    {
      icon: '�',
      title: 'Progress Tracking',
      description: 'Monitor your mastery across organ systems, clinical rotations, and exam topics with detailed analytics.'
    },
    {
      icon: '🏆',
      title: 'Gamification',
      description: 'Stay motivated with XP, streaks, medical badges, and a leaderboard of fellow medical students.'
    },
    {
      icon: '📱',
      title: 'Offline Access',
      description: 'Study on wards and clinical rotations with offline access to questions, flashcards, and drug reference.'
    }
  ];

  return (
    <section id="features" style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #0A0D13 0%, #0D0E18 100%)'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{
            fontSize: 'clamp(1.875rem, 4vw, 3rem)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '16px'
          }}>
            Powerful Features for Medical Education
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Everything you need to excel in medical school and clinical rotations, all in one platform.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}>
          {features.map((feature, index) => (
            <div key={index} style={{
              background: 'linear-gradient(145deg, rgba(20, 20, 20, 0.5), rgba(10, 10, 10, 0.5))',
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
