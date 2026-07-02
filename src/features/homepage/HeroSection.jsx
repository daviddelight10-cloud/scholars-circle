import React from 'react';
import { Link } from 'react-router-dom';

export default function HeroSection() {
  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #07080F 0%, #0D0E18 50%, #07080F 100%)',
      position: 'relative'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: '0.3'
      }}>
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '25%',
          width: '384px',
          height: '384px',
          background: 'rgba(61, 126, 255, 0.2)',
          borderRadius: '50%',
          filter: 'blur(96px)',
          animation: 'orbFloat 9s ease-in-out infinite'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '25%',
          right: '25%',
          width: '384px',
          height: '384px',
          background: 'rgba(110, 74, 255, 0.2)',
          borderRadius: '50%',
          filter: 'blur(96px)',
          animation: 'orbFloat 9s ease-in-out infinite',
          animationDelay: '2s'
        }}></div>
      </div>

      <div style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '16px',
        textAlign: 'center'
      }}>
        <div style={{ animation: 'slideUp 0.8s ease both' }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '24px',
            lineHeight: 1.2
          }}>
            Transform Your Study Experience with
            <span style={{
              display: 'block',
              background: 'linear-gradient(135deg, #3D7EFF, #6E4AFF, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Scholar's Circle
            </span>
          </h1>
          
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: '#94a3b8',
            marginBottom: '32px',
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.6
          }}>
            The all-in-one study platform that helps students learn smarter, not harder. 
            Practice exams, AI tutoring, flashcards, and more – all in one place.
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '48px'
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
              to="/login"
              style={{
                padding: '16px 32px',
                background: 'rgba(20, 20, 20, 0.8)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: '12px',
                textDecoration: 'none',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s',
                cursor: 'pointer'
              }}
            >
              Sign In
            </Link>
          </div>

          {/* Social proof */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '32px',
            color: '#94a3b8',
            fontSize: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>📚</span>
              <span>10,000+ Questions</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🎓</span>
              <span>50+ Subjects</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>⭐</span>
              <span>4.9 Rating</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position: 'absolute',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        animation: 'bounce 2s infinite'
      }}>
        <div style={{
          width: '24px',
          height: '40px',
          border: '2px solid #475569',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '8px'
        }}>
          <div style={{
            width: '4px',
            height: '12px',
            background: '#94a3b8',
            borderRadius: '2px'
          }}></div>
        </div>
      </div>
    </section>
  );
}
