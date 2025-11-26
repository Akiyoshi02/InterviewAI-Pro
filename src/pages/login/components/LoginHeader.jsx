import React from 'react';

const LoginHeader = () => {
  return (
    <div className="text-center mb-4 lg:mb-5 space-y-2 lg:space-y-3">
      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 dark:text-slate-100">
          Welcome back
        </h1>
        <p className="mt-2 text-xs md:text-sm lg:text-base text-gray-600 dark:text-slate-300">
          Sign in to sync your practice history and live interview rooms.
        </p>
      </div>
    </div>
  );
};

export default LoginHeader;
