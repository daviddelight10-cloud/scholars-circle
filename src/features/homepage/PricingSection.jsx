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
        'Access to basic practice modes',
        'Limited questions per day',
        'Community forum access',
        'Basic progress tracking',
        'Mobile access'
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
        'AI Tutor access',
        'Advanced flashcards with spaced repetition',
        'Detailed analytics & insights',
        'Weak area focus mode',
        'Gamification (XP, streaks, badges)',
        'Priority support',
        'Offline access'
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
        'Teacher dashboard',
        'Question bank management',
        'Campus communication tools',
        'Assignment management',
        'Custom branding',
        'Dedicated support',
        'API access'
      ],
      highlight: false,
      ctaText: 'Contact Sales'
    }
  ];

  return (
    <section id="pricing" style={{
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
            Simple, Transparent Pricing
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto 32px'
          }}>
            Choose the plan that works best for you. Upgrade or downgrade anytime.
          </p>

          {/* Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px'
          }}>
            <span style={{
              fontSize: '14px',
              color: !isAnnual ? '#fff' : '#94a3b8'
            }}>
              Weekly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              style={{
                position: 'relative',
                width: '56px',
                height: '28px',
                borderRadius: '14px',
                transition: 'background 0.3s',
                background: isAnnual ? '#3D7EFF' : '#334155',
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
              color: isAnnual ? '#fff' : '#94a3b8'
            }}>
              Annual
            </span>
            {isAnnual && (
              <span style={{ fontSize: '12px', color: '#22c55e', marginLeft: '8px' }}>
                Save 15%
              </span>
            )}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          {plans.map((plan, index) => (
            <div key={index} style={{
              position: 'relative',
              background: 'linear-gradient(145deg, rgba(20, 20, 20, 0.5), rgba(10, 10, 10, 0.5))',
              border: plan.highlight 
                ? '1px solid rgba(255, 215, 0, 0.5)' 
                : '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '16px',
              padding: '32px',
              transition: 'all 0.3s',
              boxShadow: plan.highlight 
                ? '0 10px 40px rgba(255, 215, 0, 0.2)' 
                : 'none'
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #3D7EFF, #6E4AFF)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 16px',
                  borderRadius: '20px'
                }}>
                  MOST POPULAR
                </div>
              )}
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                {plan.title}
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '24px' }}>
                <span style={{ fontSize: '36px', fontWeight: 700, color: '#fff' }}>
                  {plan.price}
                </span>
                <span style={{ color: '#94a3b8' }}>/ {plan.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', lineHeight: 2 }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#cbd5e1', fontSize: '14px' }}>
                    <span style={{ color: '#22c55e', marginTop: '2px' }}>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.title === 'Institution' ? (
                <button
                  onClick={() => {
                    const contactSection = document.querySelector('#pricing');
                    if (contactSection) {
                      contactSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    transition: 'all 0.3s',
                    border: 'none',
                    cursor: 'pointer',
                    background: '#334155',
                    color: '#fff',
                    textDecoration: 'none',
                    textAlign: 'center'
                  }}
                >
                  {plan.ctaText}
                </button>
              ) : (
                <Link to="/signup" style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  transition: 'all 0.3s',
                  border: 'none',
                  cursor: 'pointer',
                  background: plan.highlight
                    ? 'linear-gradient(135deg, #3D7EFF, #6E4AFF)'
                    : '#334155',
                  color: '#fff',
                  textDecoration: 'none',
                  textAlign: 'center'
                }}>
                  {plan.ctaText}
                </Link>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
            Need a custom plan for your institution?
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/2349028617178"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: '10px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px'
              }}
            >
              WhatsApp
            </a>
            <a
              href="mailto:dsilearn1@gmail.com"
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #3D7EFF, #6E4AFF)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: '10px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px'
              }}
            >
              Email Us
            </a>
          </div>
          <p style={{ color: '#64748b', fontSize: '12px' }}>
            All prices are in Nigerian Naira (₦). Taxes may apply.
          </p>
        </div>
      </div>
    </section>
  );
}
