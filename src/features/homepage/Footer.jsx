import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      background: '#020617',
      borderTop: '1px solid #1e293b',
      padding: '48px 16px'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '32px',
          marginBottom: '32px'
        }}>
          {/* Brand */}
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
              Scholar's Circle
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
              Transform your study experience with AI-powered learning tools and comprehensive practice resources.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.3s' }}>
                <span style={{ fontSize: '20px' }}>𝕏</span>
              </a>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.3s' }}>
                <span style={{ fontSize: '20px' }}>📘</span>
              </a>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.3s' }}>
                <span style={{ fontSize: '20px' }}>📸</span>
              </a>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.3s' }}>
                <span style={{ fontSize: '20px' }}>💼</span>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '16px' }}>Product</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
              <li><Link to="/features" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Features</Link></li>
              <li><Link to="/pricing" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Pricing</Link></li>
              <li><Link to="/mobile" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Mobile App</Link></li>
              <li><Link to="/integrations" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Integrations</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '16px' }}>Resources</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
              <li><Link to="/blog" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Blog</Link></li>
              <li><Link to="/help" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Help Center</Link></li>
              <li><Link to="/guides" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Study Guides</Link></li>
              <li><Link to="/api" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>API Docs</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '16px' }}>Company</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
              <li><Link to="/about" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>About Us</Link></li>
              <li><Link to="/careers" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Careers</Link></li>
              <li><a href="https://wa.me/2349028617178" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>WhatsApp</a></li>
              <li><a href="mailto:dsilearn1@gmail.com" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Email</a></li>
              <li><Link to="/privacy" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Privacy Policy</Link></li>
              <li><Link to="/terms" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #1e293b',
          paddingTop: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center'
        }}>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            © 2024 Scholar's Circle. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link to="/privacy" style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Privacy</Link>
            <Link to="/terms" style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Terms</Link>
            <Link to="/cookies" style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}>Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
