import React from 'react';

interface BadgeProps {
  count: number;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ count, className = '' }) => {
  if (count === 0) return null;
  return (
    <span
      className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center px-1 ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};
