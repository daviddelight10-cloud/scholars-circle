import React from 'react';

export default function Section({ children, className = '', id = '', style = {} }) {
  return (
    <section 
      id={id}
      className={`py-20 px-4 md:px-8 lg:px-16 ${className}`}
      style={style}
    >
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </section>
  );
}
