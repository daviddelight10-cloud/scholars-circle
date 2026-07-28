import React from 'react';

export default function PricingCard({ 
  title, 
  price, 
  period, 
  features, 
  highlight = false, 
  ctaText,
  onCtaClick 
}) {
  return (
    <div className={`relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border rounded-2xl p-8 transition-all duration-300 hover:transform hover:-translate-y-1 ${
      highlight 
        ? 'border-blue-500/50 shadow-lg shadow-blue-500/20' 
        : 'border-slate-700/50 hover:border-blue-500/30'
    }`}>
      {highlight && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full">
          MOST POPULAR
        </div>
      )}
      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl font-bold text-white">{price}</span>
        <span className="text-slate-400">/{period}</span>
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3 text-slate-300 text-sm">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onCtaClick}
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
          highlight
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/30'
            : 'bg-slate-700 text-white hover:bg-slate-600'
        }`}
      >
        {ctaText}
      </button>
    </div>
  );
}
