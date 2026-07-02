import React from 'react';

export default function MobileAppSection() {
  return (
    <section id="mobile" style={{
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
            Study Anywhere, Anytime
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Access Scholar's Circle on any device. Our mobile-friendly design ensures you can study 
            on the go, whether you're commuting, between classes, or relaxing at home.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '48px',
          alignItems: 'center'
        }}>
          <div style={{ order: 2 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #3D7EFF, #6E4AFF)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0
                }}>
                  📱
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                    Responsive Design
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                    Optimized for smartphones, tablets, and desktops. Study seamlessly across all your devices.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #DAA520, #ec4899)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0
                }}>
                  ⚡
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                    Fast Performance
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                    Lightning-fast load times and smooth interactions even on slower connections.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #ec4899, #f97316)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0
                }}>
                  🔄
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                    Sync Across Devices
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                    Your progress syncs automatically. Start on your phone, continue on your laptop.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #22c55e, #FFD700)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0
                }}>
                  🔔
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                    Study Reminders
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                    Get notified about your study schedule, streaks, and new practice materials.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ order: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
              {/* Phone mockup with image */}
              <img 
                src="/images/mobile-mockup.jpg" 
                alt="Scholar's Circle Mobile App"
                style={{
                  width: '256px',
                  height: '500px',
                  borderRadius: '48px',
                  border: '4px solid #334155',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.2)',
                  objectFit: 'cover'
                }}
              />
              
              {/* Floating elements */}
              <div style={{
                position: 'absolute',
                top: '-16px',
                right: '-16px',
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #3D7EFF, #6E4AFF)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                animation: 'bounce 2s infinite'
              }}>
                📚
              </div>
              <div style={{
                position: 'absolute',
                bottom: '-16px',
                left: '-16px',
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #DAA520, #ec4899)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                animation: 'bounce 2s infinite',
                animationDelay: '0.5s'
              }}>
                🎯
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
