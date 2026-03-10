import React from 'react';

import Button from '../../../components/ui/Button';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const OAUTH_REDIRECT_BASE = (
  import.meta.env.VITE_OAUTH_REDIRECT_BASE
  || `${API_BASE}/api/oauth`
).replace(/\/$/, '');

const SocialLogin = ({ onSocialLogin, isLoading }) => {
  const buildProviderRedirectUri = (providerId) => (
    `${OAUTH_REDIRECT_BASE}/${providerId}/callback`
  );

  const socialProviders = [
    {
      id: 'google',
      name: 'Continue with Google',
      icon: 'Chrome',
    },
    ...(GITHUB_CLIENT_ID ? [{
      id: 'github',
      name: 'Continue with GitHub',
      icon: 'Github',
    }] : []),
  ];

  const handleSocialLogin = (provider) => {
    if (provider.id === 'github') {
      const state = crypto.randomUUID();
      sessionStorage.setItem('oauth_state_github', state);
      const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: buildProviderRedirectUri('github'),
        scope: 'read:user user:email',
        state,
      });
      window.location.href = `https://github.com/login/oauth/authorize?${params}`;
      return;
    }

    if (onSocialLogin) {
      onSocialLogin(provider);
    }
  };

  return (
    <div className="space-y-2 lg:space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/50"></div>
        </div>
        <div className="relative flex justify-center text-xs lg:text-sm">
          <span className="px-2 bg-white/85 dark:bg-slate-800/85 text-gray-500 dark:text-slate-400">Or continue with</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {socialProviders?.map((provider) => (
          <Button
            key={provider?.id}
            variant="outline"
            fullWidth
            onClick={() => handleSocialLogin(provider)}
            disabled={isLoading}
            iconName={provider?.icon}
            iconPosition="left"
            className="h-9 lg:h-10 rounded-full border border-white/50 dark:border-slate-700/50 text-gray-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 text-xs lg:text-sm"
          >
            {provider?.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default SocialLogin;
