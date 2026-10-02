import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      title: 'Free',
      price: '₦0',
      period: 'forever',
      features: [
        'Basic practice modes',
        'Limited questions per day',
        'Community forum access',
        'Progress tracking',
        'Works on your phone'
      ],
      highlight: false,
      ctaText: 'Get Started'
    },
    {
      title: 'Premium',
      price: isAnnual ? '₦2,400' : '₦700',
      period: isAnnual ? 'month' : 'week',
      features: [
        'Unlimited practice questions',
        'AI Tutor with Circle to Ask',
        'Voice Tutor — learn hands-free',
        'Clinical case simulations',
        'Drug reference & lab values',
        'Smart review — remembers what you\'ll forget',
        'Detailed progress analytics',
        'Weak-area focus mode',
        'XP, streaks & study leaderboard',
        'Priority support',
        'Offline access for clinical rotations'
      ],
      highlight: true,
      ctaText: 'Start Free Trial'
    },
    {
      title: 'Institution',
      price: 'Custom',
      period: 'contact us',
      features: [
        'All Premium features',
        'Unlimited student accounts',
        'Educator dashboard',
        'Question bank management',
        'Clinical case authoring tools',
        'Campus communication tools',
        'Assignment management',
        'Custom branding',
        'Dedicated support'
      ],
      highlight: false,
      ctaText: 'Contact Us'
    }
  ];

  const gold = '#F5A623';

  return (
    <section id="pricing" style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #0a0a0a 0%, #0d0c08 100%)',
      fontFamily: 'Manrope, sans-serif'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
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
            Simple pricing, no surprises
          </h2>
          <p style={{
            color: '#A8B0C4',
            fontSize: '1.1rem',
            maxWidth: '560px',
            margin: '0 auto 32px',
            lineHeight: 1.65
          }}>
            Start free. Upgrade when you need unlimited practice — downgrade anytime.
          </p>

          {/* Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px'
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: !isAnnual ? '#fff' : '#707A90'
            }}>
              Weekly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              aria-label="Toggle annual billing"
              style={{
                position: 'relative',
                width: '54px',
                height: '28px',
                borderRadius: '14px',
                transition: 'background 0.3s',
                background: isAnnual ? gold : '#2c2c30',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '4px',
                width: '20px',
                height: '20px',
                background: '#fff',
                borderRadius: '50%',
                transition: 'transform 0.3s',
                transform: isAnnual ? 'translateX(28px)' : 'translateX(4px)'
              }}></div>
            </button>
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: isAnnual ? '#fff' : '#707A90'
            }}>
              Annual
            </span>
            {isAnnual && (
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#3DD68C', marginLeft: '6px' }}>
                Save 15%
              </span>
            )}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '22px',
          maxWidth: '960px',
          margin: '0 auto'
        }}>
          {plans.map((plan, index) => (
            <div key={index} style={{
              position: 'relative',
              background: 'linear-gradient(145deg, rgba(23, 23, 27, 0.9), rgba(13, 13, 14, 0.9))',
              border: plan.highlight
                ? `1px solid rgba(245, 166, 35, 0.55)`
                : '1px solid rgba(255, 255, 255, 0.09)',
              borderRadius: '18px',
              padding: '30px',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
              boxShadow: plan.highlight
                ? '0 12px 44px rgba(245, 166, 35, 0.14)'
                : 'none'
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute',
                  top: '-13px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: `linear-gradient(135deg, #FFD700, ${gold})`,
                  color: '#1A1300',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '5px 16px',
                  borderRadius: '20px'
                }}>
                  MOST POPULAR
                </div>
              )}
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '6px', fontFamily: 'Sora, sans-serif' }}>
                {plan.title}
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '24px' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 800, color: plan.highlight ? gold : '#fff', fontFamily: 'Sora, sans-serif' }}>
                  {plan.price}
                </span>
                <span style={{ color: '#707A90', fontSize: '0.9rem' }}>/ {plan.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', lineHeight: 1.9 }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#C6CCDC', fontSize: '0.92rem' }}>
                    <span style={{ color: '#3DD68C', marginTop: '2px', fontWeight: 800, flexShrink: 0 }}>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.title === 'Institution' ? (
                <a
                  href="https://wa.me/2349028617178"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '13px 24px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    transition: 'all 0.2s',
                    border: '1px solid rgba(255,255,255,0.14)',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontSize: '0.95rem'
                  }}
                >
                  {plan.ctaText} →
                </a>
              ) : (
                <Link to="/signup" style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 24px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  background: plan.highlight
                    ? `linear-gradient(135deg, #FFD700, ${gold})`
                    : 'rgba(255,255,255,0.06)',
                  border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.14)',
                  color: plan.highlight ? '#1A1300' : '#fff',
                  textDecoration: 'none',
                  textAlign: 'center',
                  fontSize: '0.95rem'
                }}>
                  {plan.ctaText}
                </Link>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '44px', textAlign: 'center' }}>
          <p style={{ color: '#A8B0C4', fontSize: '0.95rem', marginBottom: '16px' }}>
            Need a custom plan for your school or department?
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/2349028617178"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '11px 22px',
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                color: '#fff',
                fontWeight: 800,
                borderRadius: '10px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.9rem'
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
                color: '#fff',
                fontWeight: 800,
                borderRadius: '10px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.9rem'
              }}
            >
              Email Us
            </a>
          </div>
          <p style={{ color: '#707A90', fontSize: '0.78rem', marginTop: '18px' }}>
            All prices in Nigerian Naira (₦). Taxes may apply.
          </p>
        </div>
      </div>
    </section>
  );
}
