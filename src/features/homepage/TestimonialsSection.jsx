import React from 'react';

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Computer Science Student',
      content: 'Scholar\'s Circle completely changed how I study. The AI tutor helped me understand complex concepts, and my grades improved by 40% in just one semester!',
      rating: 5,
      avatar: 'S'
    },
    {
      name: 'Michael Chen',
      role: 'Medical Student',
      content: 'The spaced repetition flashcards are incredible. I can now memorize hundreds of medical terms and retain them long-term. Best study tool I\'ve ever used.',
      rating: 5,
      avatar: 'M'
    },
    {
      name: 'Dr. Emily Roberts',
      role: 'University Professor',
      content: 'As a teacher, I love the question bank management features. I can easily create and share practice materials with my students. The analytics help me identify who needs extra help.',
      rating: 5,
      avatar: 'E'
    },
    {
      name: 'David Okonkwo',
      role: 'Engineering Student',
      content: 'The gamification features keep me motivated to study every day. I\'ve maintained a 30-day streak and earned multiple badges. It makes learning fun!',
      rating: 5,
      avatar: 'D'
    },
    {
      name: 'Aisha Ibrahim',
      role: 'Law Student',
      content: 'The practice exams are exactly what I needed. The detailed explanations help me understand not just the answer, but the reasoning behind it.',
      rating: 5,
      avatar: 'A'
    },
    {
      name: 'Prof. James Thompson',
      role: 'Department Head',
      content: 'Our university adopted Scholar\'s Circle campus-wide. The student engagement and performance metrics have been outstanding. Highly recommended for any institution.',
      rating: 5,
      avatar: 'J'
    }
  ];

  return (
    <section id="testimonials" style={{
      padding: '80px 16px',
      background: 'linear-gradient(180deg, #0D0E18 0%, #07080F 100%)'
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
            Join thousands of students and educators who have transformed their learning experience with Scholar's Circle.
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
