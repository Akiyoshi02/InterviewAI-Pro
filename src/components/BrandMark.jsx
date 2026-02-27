import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './AppIcon';

const BrandMark = ({
  showTagline = false,
  className = '',
  iconWrapperClassName = 'w-9 h-9 sm:w-10 sm:h-10',
  textClassName = 'text-base sm:text-lg md:text-xl',
  taglineClassName = 'text-xs text-gray-500 dark:text-slate-400',
  textColor = 'text-gray-900 dark:text-slate-100',
  proColor = 'text-blue-600 dark:text-blue-400',
  clickable = true,
}) => {
  const navigate = useNavigate?.();

  const handleActivate = (event) => {
    if (!clickable || !navigate) return;
    // Allow callers to prevent navigation
    if (event?.defaultPrevented) return;
    navigate('/');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate(event);
    }
  };

  return (
    <div
      className={`flex items-start space-x-2 ${clickable ? 'cursor-pointer select-none' : ''} ${className}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`${iconWrapperClassName} rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-[0_10px_30px_rgba(59,130,246,0.3)]`}
      >
        <Icon name="Brain" size={18} color="currentColor" />
      </div>
      <div className="leading-tight">
        <span className={`${textClassName} font-semibold ${textColor}`}>
          <span>InterviewAI</span>{' '}
          <span className={proColor}>Pro</span>
        </span>
        {showTagline && (
          <span className={`${taglineClassName} block`}>
            Human-ready interviews, AI precision.
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandMark;

