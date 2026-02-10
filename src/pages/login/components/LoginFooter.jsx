import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/ui/Button';

const LoginFooter = ({ onNavigateToRegister }) => {
  return (
    <div className="mt-4 lg:mt-5 pt-3 lg:pt-4 border-t border-white/30 dark:border-slate-700/50 space-y-3">
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
          <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Privacy</Link>·
          <Link to="/terms" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Terms</Link>·
          <Link to="/help-center" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Help Center</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginFooter;