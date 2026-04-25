import React from 'react';
import { useNavigate } from 'react-router-dom';

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
      className={`flex items-center gap-1.5 xs:gap-2 ${clickable ? 'cursor-pointer select-none' : ''} ${className}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`${iconWrapperClassName} flex items-center justify-center shrink-0`}
      >
        <img
          src="/assets/images/logo.svg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-contain drop-shadow-[0_10px_30px_rgba(59,130,246,0.3)]"
        />
      </div>
      <div className="flex min-h-full flex-col justify-center">
        <span className={`${textClassName} block font-semibold leading-none ${textColor}`}>
          <span>InterviewAI</span>{' '}
          <span className={proColor}>Pro</span>
        </span>
        {showTagline && (
          <span className={`${taglineClassName} mt-0.5 block leading-tight`}>
            Human-ready interviews, AI precision.
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandMark;

