import React from 'react';

export default function ProblemSection() {
  return (
    <section id="problem" style={{
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
            The Problem We Solve
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Traditional study methods are inefficient. Students struggle with scattered resources, 
            lack of practice materials, and ineffective learning strategies.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
          marginBottom: '64px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>📖</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Scattered Resources
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Students waste time searching across multiple platforms for study materials, 
              notes, and practice questions.
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(145deg, rgba(249, 115, 22, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(249, 115, 22, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>😫</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Ineffective Practice
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Without targeted practice, students struggle to identify weak areas and 
              improve their understanding effectively.
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(145deg, rgba(250, 204, 21, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(250, 204, 21, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏰</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Poor Time Management
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Balancing multiple subjects and exam preparation becomes overwhelming without 
              proper planning and tracking.
            </p>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(145deg, rgba(255, 215, 0, 0.1), rgba(218, 165, 32, 0.1))',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          borderRadius: '16px',
          padding: '32px 48px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
                Scholar's Circle: The Solution
              </h3>
              <p style={{ color: '#cbd5e1', marginBottom: '24px' }}>
                We bring everything together in one powerful platform. No more switching between apps, 
                no more lost notes, no more ineffective study sessions.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1' }}>
                  <span style={{ color: '#22c55e' }}>✓</span>
                  All subjects in one place
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1' }}>
                  <span style={{ color: '#22c55e' }}>✓</span>
                  AI-powered personalized learning
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1' }}>
                  <span style={{ color: '#22c55e' }}>✓</span>
                  Smart practice with spaced repetition
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1' }}>
                  <span style={{ color: '#22c55e' }}>✓</span>
                  Progress tracking and analytics
                </li>
              </ul>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px'
            }}>
              <div style={{
                background: 'rgba(20, 20, 20, 0.5)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#3D7EFF', marginBottom: '8px' }}>10x</div>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>Faster Learning</div>
              </div>
              <div style={{
                background: 'rgba(20, 20, 20, 0.5)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#6E4AFF', marginBottom: '8px' }}>85%</div>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>Better Retention</div>
              </div>
              <div style={{
                background: 'rgba(20, 20, 20, 0.5)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#EC4899', marginBottom: '8px' }}>50+</div>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>Subjects</div>
              </div>
              <div style={{
                background: 'rgba(20, 20, 20, 0.5)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e', marginBottom: '8px' }}>24/7</div>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>Access</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
