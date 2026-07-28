import React from 'react';

export default function TestimonialCard({ name, role, content, rating, avatar }) {
  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300">
      <div className="flex items-center gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <span key={i} className="text-yellow-400 text-lg">★</span>
        ))}
      </div>
      <p className="text-slate-300 text-sm leading-relaxed mb-4 italic">"{content}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold">
          {avatar || name.charAt(0)}
        </div>
        <div>
          <div className="text-white font-semibold text-sm">{name}</div>
          <div className="text-slate-400 text-xs">{role}</div>
        </div>
      </div>
    </div>
  );
}
