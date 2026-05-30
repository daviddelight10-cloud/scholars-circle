import React, { useState } from 'react';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: 'What is Scholar\'s Circle?',
      answer: 'Scholar\'s Circle is an all-in-one study platform designed to help students learn more effectively. It includes practice exams, AI tutoring, flashcards, progress tracking, and gamification features to make learning engaging and efficient.'
    },
    {
      question: 'How much does it cost?',
      answer: 'We offer both free and premium plans. The free plan includes basic practice modes and limited questions. Premium plans unlock unlimited questions, AI features, advanced analytics, and gamification elements. Contact us for institutional pricing.'
    },
    {
      question: 'Can teachers use Scholar\'s Circle?',
      answer: 'Absolutely! Teachers can create and manage question banks, assign homework, track student progress, and use campus communication tools. We offer special features and pricing for educational institutions.'
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, we take data security seriously. All data is encrypted, and we follow industry best practices for data protection. We never share your personal information with third parties without your consent.'
    },
    {
      question: 'Can I use Scholar\'s Circle offline?',
      answer: 'While an internet connection is required for most features, we offer offline access to downloaded questions and flashcards. Your progress syncs automatically when you reconnect.'
    },
    {
      question: 'How do I get started?',
      answer: 'Simply click "Get Started Free" to create your account. You can sign up with your email or through your institution if they have a partnership with us. Once registered, you can immediately start practicing with our question bank.'
    },
    {
      question: 'What subjects are available?',
      answer: 'We currently offer 50+ subjects across various disciplines including sciences, mathematics, humanities, languages, and professional courses. We continuously add new subjects based on user demand.'
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your premium subscription at any time. You\'ll continue to have access to premium features until the end of your current billing period.'
    }
  ];

  return (
    <section id="faq" style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #0D0E18 0%, #07080F 100%)'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{
            fontSize: 'clamp(1.875rem, 4vw, 3rem)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '16px'
          }}>
            Frequently Asked Questions
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Find answers to common questions about Scholar's Circle.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {faqs.map((faq, index) => (
            <div key={index} style={{
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5))',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>
                  {faq.question}
                </span>
                <span style={{
                  color: '#94a3b8',
                  transition: 'transform 0.3s',
                  transform: openIndex === index ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                  ▼
                </span>
              </button>
              <div style={{
                padding: openIndex === index ? '0 24px 16px' : '0 24px',
                overflow: 'hidden',
                transition: 'all 0.3s',
                maxHeight: openIndex === index ? '500px' : '0'
              }}>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6 }}>
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
