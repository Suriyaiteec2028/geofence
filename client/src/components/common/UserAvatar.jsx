import React from 'react';
import { User } from 'lucide-react';

export const UserAvatar = ({ gender = 'Male', role = 'DOCTOR', name = '', size = 'md', className = '' }) => {
  const isFemale = gender && gender.trim().toLowerCase() === 'female';

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  // Female Lady Doctor / Female Officer Badge Styling
  if (isFemale) {
    return (
      <div className={`relative flex-shrink-0 rounded-2xl p-0.5 bg-gradient-to-tr from-pink-500 via-rose-400 to-purple-500 shadow-md ${className}`}>
        <div className={`${currentSizeClass} rounded-[14px] bg-[#1E1B2E] border border-pink-500/30 flex items-center justify-center font-bold text-pink-300 overflow-hidden relative group`}>
          {/* Female Avatar SVG Illustration */}
          <svg className="w-full h-full p-1" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="14" fill="#2A1B3D"/>
            {/* Lady Hair & Face */}
            <path d="M20 22C20 14 24 10 32 10C40 10 44 14 44 22V28C44 28 42 32 32 32C22 32 20 28 20 28V22Z" fill="#701A75"/>
            <circle cx="32" cy="22" r="9" fill="#FBCFE8"/>
            {/* Hair Side Locks */}
            <path d="M21 17C20 21 21 27 24 29C23 24 23 19 25 16C23 16 21 17 21 17Z" fill="#4C1D95"/>
            <path d="M43 17C44 21 43 27 40 29C41 24 41 19 39 16C41 16 43 17 43 17Z" fill="#4C1D95"/>
            {/* White Doctor Coat & Stethoscope */}
            <path d="M16 52C16 41 22 36 32 36C42 36 48 41 48 52V54H16V52Z" fill="#F8FAFC"/>
            <path d="M28 36L32 44L36 36" fill="#F43F5E"/>
            <path d="M26 36V46M38 36V46" stroke="#9333EA" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="32" cy="46" r="2.5" fill="#E11D48"/>
          </svg>
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-pink-500 border-2 border-[#0F172A] rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">
          ♀
        </span>
      </div>
    );
  }

  // Male Doctor / Male Officer Badge Styling
  return (
    <div className={`relative flex-shrink-0 rounded-2xl p-0.5 bg-gradient-to-tr from-blue-600 via-sky-400 to-emerald-400 shadow-md ${className}`}>
      <div className={`${currentSizeClass} rounded-[14px] bg-[#172554] border border-blue-500/30 flex items-center justify-center font-bold text-sky-300 overflow-hidden relative group`}>
        {/* Male Avatar SVG Illustration */}
        <svg className="w-full h-full p-1" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#0F172A"/>
          {/* Male Short Hair & Face */}
          <path d="M22 18C22 13 26 10 32 10C38 10 42 13 42 18V20H22V18Z" fill="#1E293B"/>
          <circle cx="32" cy="22" r="9" fill="#BAE6FD"/>
          {/* White Doctor Coat & Blue Tie / Stethoscope */}
          <path d="M16 52C16 41 22 36 32 36C42 36 48 41 48 52V54H16V52Z" fill="#F8FAFC"/>
          <path d="M30 36L32 45L34 36" fill="#0284C7"/>
          <path d="M25 36V46M39 36V46" stroke="#0284C7" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="32" cy="46" r="2.5" fill="#0284C7"/>
        </svg>
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 border-2 border-[#0F172A] rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">
        ♂
      </span>
    </div>
  );
};
