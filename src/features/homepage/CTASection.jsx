import React from 'react';
import { Link } from 'react-router-dom';

export default function CTASection() {
  return (
    <section style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #0D0E18 0%, #0A0D13 100%)'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.2), rgba(218, 165, 32, 0.2), rgba(236, 72, 153, 0.2))',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '24px',
          padding: '48px 32px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated background elements */}
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: '0.3'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '384px',
              height: '384px',
              background: 'rgba(255, 215, 0, 0.2)',
              borderRadius: '50%',
              filter: 'blur(96px)',
              animation: 'orbFloat 9s ease-in-out infinite'
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '384px',
              height: '384px',
              background: 'rgba(218, 165, 32, 0.2)',
              borderRadius: '50%',
              filter: 'blur(96px)',
              animation: 'orbFloat 9s ease-in-out infinite',
              animationDelay: '2s'
            }}></div>
          </div>

          <div style={{ position: 'relative', zIndex: 10 }}>
            <h2 style={{
              fontSize: 'clamp(1.875rem, 4vw, 3rem)',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '16px'
            }}>
              Ready to Transform Your Study Experience?
            </h2>
            <p style={{
              color: '#cbd5e1',
              fontSize: '1.125rem',
              marginBottom: '32px',
              maxWidth: '600px',
              margin: '0 auto 32px'
            }}>
              Join thousands of students who are already learning smarter with Scholar's Circle. 
              Start your journey today – it's free to get started.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Link
                to="/signup"
                style={{
                  padding: '16px 32px',
                  background: 'linear-gradient(135deg, #3D7EFF, #6E4AFF)',
                  color: '#fff',
                  fontWeight: 600,
                  borderRadius: '12px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 15px rgba(61, 126, 255, 0.4)',
                  transition: 'all 0.3s',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Get Started Free
              </Link>
              <Link
                to="/features"
                style={{
                  padding: '16px 32px',
                  background: 'rgba(20, 20, 20, 0.5)',
                  color: '#fff',
                  fontWeight: 600,
                  borderRadius: '12px',
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
              >
                Learn More
              </Link>
            </div>

            <p style={{
              color: '#94a3b8',
              fontSize: '14px',
              marginTop: '24px'
            }}>
              No credit card required • Cancel anytime • 24/7 support
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
