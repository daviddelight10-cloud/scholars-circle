import React from 'react';

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Dr. Aisha Mohammed',
      role: 'MBBS Final Year, Bayero University',
      content: 'The clinical case simulations are a game-changer. I practiced differential diagnoses for weeks before my OSCE and felt confident on exam day. Passed with flying colors!',
      rating: 5,
      avatar: 'A'
    },
    {
      name: 'Chidi Okafor',
      role: 'Medical Laboratory Science, 400 Level',
      content: 'The spaced repetition flashcards helped me memorize hundreds of lab values and microbiology facts. I retained everything for my professional exam. Best study tool ever.',
      rating: 5,
      avatar: 'C'
    },
    {
      name: 'Dr. Funke Adeyemi',
      role: 'Clinical Lecturer, OAUTH',
      content: 'As a clinician-educator, I love the question bank and clinical case authoring tools. I can create case scenarios for my students and track their clinical reasoning progress.',
      rating: 5,
      avatar: 'F'
    },
    {
      name: 'Ngozi Eze',
      role: 'Nursing Science, 300 Level',
      content: 'The drug reference tool is a lifesaver on clinical postings. I quickly look up drug interactions and dosages during ward rounds. My supervisors are impressed!',
      rating: 5,
      avatar: 'N'
    },
    {
      name: 'Ibrahim Suleiman',
      role: 'Radiography, 500 Level',
      content: 'The gamification keeps me motivated to study every day. I\'ve maintained a 45-day streak and earned the Anatomy Master badge. It makes learning fun!',
      rating: 5,
      avatar: 'I'
    },
    {
      name: 'Prof. Grace Okon',
      role: 'Head of Anatomy, University of Lagos',
      content: 'Our medical school adopted Scholar\'s Circle for all pre-clinical years. Student engagement and exam pass rates have improved significantly. Highly recommended.',
      rating: 5,
      avatar: 'G'
    }
  ];

  return (
    <section id="testimonials" style={{
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
            What Our Users Say
          </h2>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.125rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Join thousands of medical students and clinician-educators who have transformed their learning experience with Scholar's Circle.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}>
          {testimonials.map((testimonial, index) => (
            <div key={index} style={{
              background: 'linear-gradient(145deg, rgba(20, 20, 20, 0.5), rgba(10, 10, 10, 0.5))',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '16px',
              padding: '24px',
              transition: 'all 0.3s'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} style={{ color: '#fbbf24', fontSize: '18px' }}>★</span>
                ))}
              </div>
              <p style={{
                color: '#cbd5e1',
                fontSize: '14px',
                lineHeight: 1.6,
                marginBottom: '16px',
                fontStyle: 'italic'
              }}>
                "{testimonial.content}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #DAA520, #ec4899)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 600
                }}>
                  {testimonial.avatar || testimonial.name.charAt(0)}
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>
                    {testimonial.name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
