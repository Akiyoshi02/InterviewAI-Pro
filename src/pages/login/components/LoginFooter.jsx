import React from 'react';
import Button from '../../../components/ui/Button';

const LoginFooter = ({ onNavigateToRegister }) => {
  return (
    <div className="mt-4 lg:mt-5 pt-3 lg:pt-4 border-t border-white/30 space-y-3">
      <div className="text-center space-y-1.5 lg:space-y-2">
        <p className="text-xs lg:text-sm text-gray-500 dark:text-slate-400">Don&apos;t have an account?</p>
        <Button
          variant="outline"
          fullWidth
          onClick={onNavigateToRegister}
          className="h-10 lg:h-11 rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 font-semibold hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 text-sm lg:text-base"
        >
          Create Account
        </Button>
      </div>
      <div className="text-center text-[10px] lg:text-xs text-gray-400 dark:text-slate-500">
        <p>
          © {new Date()?.getFullYear()} InterviewAI Pro ·
          <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Privacy</a>·
          <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Terms</a>·
          <a href="/support" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Support</a>
        </p>
      </div>
    </div>
  );
};

export default LoginFooter;