import React from 'react';

export default function UniversitySection() {
  return (
    <section id="universities" style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #0D0E18 0%, #0A0D13 100%)'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{
            fontSize: 'clamp(1.875rem, 4vw, 3rem)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '16px'
          }}>
            Why Universities Choose Scholar's Circle
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Empowering institutions with comprehensive learning management tools 
            that enhance student success and streamline faculty workflows.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
          marginBottom: '64px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(255, 215, 0, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🎓</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Comprehensive Question Bank
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Teachers can create, manage, and share question banks across departments. 
              Build a centralized repository of exam materials.
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(145deg, rgba(218, 165, 32, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(218, 165, 32, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Student Analytics
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Track student progress, identify at-risk learners, and provide targeted 
              interventions with detailed performance analytics.
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(145deg, rgba(236, 72, 153, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(236, 72, 153, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>📢</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Campus Communication
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Send announcements, share resources, and keep students informed with 
              integrated campus communication tools.
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>📝</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Assignment Management
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Create and distribute assignments, track submissions, and provide feedback 
              all within one unified platform.
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(145deg, rgba(250, 204, 21, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(250, 204, 21, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🤖</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              AI-Powered Assistance
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Leverage AI to generate questions, provide study assistance, and offer 
              personalized learning paths for students.
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(145deg, rgba(249, 115, 22, 0.1), rgba(13, 14, 24, 0.5))',
            border: '1px solid rgba(249, 115, 22, 0.2)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔐</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Secure & Scalable
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Enterprise-grade security with role-based access control. Scale from 
              small classes to entire universities seamlessly.
            </p>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.2), rgba(218, 165, 32, 0.2))',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '16px',
          padding: '32px 48px',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
            Partner With Us
          </h3>
          <p style={{
            color: '#cbd5e1',
            marginBottom: '24px',
            maxWidth: '600px',
            margin: '0 auto 24px'
          }}>
            Join the growing number of institutions transforming education with Scholar's Circle. 
            Contact us to learn about institutional licensing and custom integrations.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/2349028617178"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '12px 32px',
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(37, 211, 102, 0.4)',
                transition: 'all 0.3s',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              WhatsApp
            </a>
            <a
              href="mailto:dsilearn1@gmail.com"
              style={{
                padding: '12px 32px',
                background: 'linear-gradient(135deg, #3D7EFF, #6E4AFF)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(61, 126, 255, 0.4)',
                transition: 'all 0.3s',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              Email Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
