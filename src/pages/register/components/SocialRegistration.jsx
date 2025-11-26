import React from 'react';
import Button from '../../../components/ui/Button';

const SocialRegistration = ({ isLoading, className = '', onSocialRegister }) => {

  const socialProviders = [
    {
      id: 'google',
      name: 'Google',
      icon: 'Chrome',
      color: 'bg-red-500',
      description: 'Continue with Google account'
    }
  ];

  const handleSocialRegister = (provider) => {
    if (onSocialRegister) {
      onSocialRegister(provider);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/50"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-white/85 dark:bg-slate-800/85 text-gray-500 dark:text-slate-400">Or continue with</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {socialProviders?.map((provider) => (
          <Button
            key={provider?.id}
            variant="outline"
            fullWidth
            onClick={() => handleSocialRegister(provider)}
            disabled={isLoading}
            iconName={provider?.icon}
            iconPosition="left"
            className="h-10 rounded-full border border-white/50 dark:border-slate-700/50 text-gray-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
          >
            {provider?.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default SocialRegistration;