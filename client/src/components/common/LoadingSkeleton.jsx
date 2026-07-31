import React from 'react';

export const LoadingSkeleton = ({ type = 'card', count = 3 }) => {
  if (type === 'table') {
    return (
      <div className="w-full space-y-3 animate-pulse">
        <div className="h-10 bg-slate-800/80 rounded-xl w-full" />
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-800/40 rounded-xl w-full border border-slate-700/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 bg-slate-800/60 rounded-2xl border border-slate-700/40 p-4 space-y-3">
          <div className="h-4 bg-slate-700/60 rounded w-1/2" />
          <div className="h-8 bg-slate-700/80 rounded w-3/4" />
          <div className="h-3 bg-slate-700/40 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
};
