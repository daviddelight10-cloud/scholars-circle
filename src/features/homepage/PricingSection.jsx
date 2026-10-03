import React from 'react';
import { Link } from 'react-router-dom';
import { PLANS, naira } from '../../lib/plans.js';

const FREE_FEATURES = [
  '2 days of full Premium access',
  'Then free forever — no card',
  '5 AI Tutor chats a day',
  'Practice questions with streaks & XP',
  'Study live with friends',
  'Works offline once installed'
];

const PREMIUM_FEATURES = [
  'Unlimited AI Tutor & Circle to Ask',
  'Unlimited practice questions',
  'Voice Tutor — learn hands-free',
  'Exam simulator with topic breakdown',
  'Smart review — resurfaces what you\'ll forget',
  'Clinical case simulations',
  'Drug reference & lab values',
  'Detailed progress analytics',
  'Priority support'
];

export default function PricingSection() {
  const gold = '#F5A623';
  const goldBright = '#FFD700';
  const textDim = '#A8B0C4';
  const textFaint = '#707A90';
  const line = 'rgba(255,255,255,0.09)';

  return (
    <section id="pricing" style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #0a0a0a 0%, #0d0c08 100%)',
      fontFamily: 'Manrope, sans-serif'
    }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <span style={{
            fontFamily: 'Manrope, sans-serif', fontSize: '0.8rem', fontWeight: 800,
            color: gold, letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: 14, display: 'block'
          }}>Pricing</span>
          <h2 style={{
            fontSize: 'clamp(1.875rem, 4vw, 2.6rem)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '14px',
            fontFamily: 'Sora, sans-serif',
            letterSpacing: '-0.02em'
          }}>
            Less than one photocopied past-question pack
          </h2>
          <p style={{
            color: textDim,
            fontSize: '1.1rem',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.65
          }}>
            Start free — 2 days of everything, then a free tier that never expires. Upgrade when you're ready.
          </p>
        </div>

        {/* Free card + 4 paid plans — rendered from the real PLANS catalog */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          maxWidth: '1060px',
          margin: '0 auto'
        }}>
          {/* Free */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(23,23,27,0.9), rgba(13,13,14,0.9))',
            border: `1px solid ${line}`,
            borderRadius: '18px',
            padding: '26px 24px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '4px', fontFamily: 'Sora, sans-serif' }}>Free</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '18px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', fontFamily: 'Sora, sans-serif' }}>₦0</span>
              <span style={{ color: textFaint, fontSize: '0.85rem' }}>/ forever</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', flex: 1 }}>
              {FREE_FEATURES.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#C6CCDC', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: 8 }}>
                  <span style={{ color: '#3DD68C', fontWeight: 800, flexShrink: 0 }}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/signup" style={{
              display: 'block', padding: '12px 18px', borderRadius: '12px',
              fontWeight: 800, textAlign: 'center', fontSize: '0.88rem',
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)', color: '#fff', textDecoration: 'none'
            }}>
              Start free
            </Link>
          </div>

          {/* Paid plans from PLANS */}
          {PLANS.map((plan) => (
            <div key={plan.id} style={{
              position: 'relative',
              background: 'linear-gradient(145deg, rgba(23,23,27,0.9), rgba(13,13,14,0.9))',
              border: plan.best ? `1px solid rgba(245,166,35,0.55)` : `1px solid ${line}`,
              borderRadius: '18px',
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: plan.best ? '0 12px 44px rgba(245,166,35,0.14)' : 'none'
            }}>
              {plan.best && (
                <div style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  background: `linear-gradient(135deg, ${goldBright}, ${gold})`,
                  color: '#1A1300', fontSize: '10.5px', fontWeight: 800,
                  letterSpacing: '0.06em', padding: '4px 14px', borderRadius: '20px',
                  whiteSpace: 'nowrap'
                }}>
                  BEST VALUE
                </div>
              )}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '4px', fontFamily: 'Sora, sans-serif' }}>
                {plan.icon} {plan.label}
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: plan.best ? gold : '#fff', fontFamily: 'Sora, sans-serif' }}>
                  {naira(plan.price)}
                </span>
              </div>
              <p style={{ color: plan.best ? gold : textFaint, fontSize: '0.78rem', fontWeight: 700, marginBottom: '18px' }}>{plan.note}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', flex: 1 }}>
                {PREMIUM_FEATURES.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#C6CCDC', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: 8 }}>
                    <span style={{ color: '#3DD68C', fontWeight: 800, flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" style={{
                display: 'block', padding: '12px 18px', borderRadius: '12px',
                fontWeight: 800, textAlign: 'center', fontSize: '0.88rem',
                background: plan.best ? `linear-gradient(135deg, ${goldBright}, ${gold})` : 'rgba(255,255,255,0.06)',
                border: plan.best ? 'none' : '1px solid rgba(255,255,255,0.14)',
                color: plan.best ? '#1A1300' : '#fff', textDecoration: 'none'
              }}>
                {plan.id === 'week1' ? 'Try Premium' : 'Get Premium'}
              </Link>
            </div>
          ))}
        </div>

        {/* Institution line + contact */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <p style={{ color: textDim, fontSize: '0.95rem', marginBottom: '14px' }}>
            Lecturer or school admin? We do department-wide plans — talk to us.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/2349028617178"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '11px 22px',
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                color: '#fff', fontWeight: 800, borderRadius: '10px',
                textDecoration: 'none', display: 'inline-flex',
                alignItems: 'center', gap: '6px', fontSize: '0.9rem'
              }}
            >
              WhatsApp
            </a>
            <a
              href="mailto:dsilearn1@gmail.com"
              style={{
                padding: '11px 22px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: '#fff', fontWeight: 800, borderRadius: '10px',
                textDecoration: 'none', display: 'inline-flex',
                alignItems: 'center', gap: '6px', fontSize: '0.9rem'
              }}
            >
              Email Us
            </a>
          </div>
          <p style={{ color: textFaint, fontSize: '0.78rem', marginTop: '16px' }}>
            All prices in Nigerian Naira (₦). Pay via bank transfer or Paystack.
          </p>
        </div>
      </div>
    </section>
  );
}
