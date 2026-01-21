import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DEFAULT_TITLE = 'InterviewAI Pro - Master Your Interview Skills';

const TITLE_RULES = [
  { pattern: /^\/$/, title: DEFAULT_TITLE },
  { pattern: /^\/about$/, title: 'About Us - InterviewAI Pro' },
  { pattern: /^\/careers$/, title: 'Careers - InterviewAI Pro' },
  { pattern: /^\/press$/, title: 'Press - InterviewAI Pro' },
  { pattern: /^\/contact$/, title: 'Contact Us - InterviewAI Pro' },
  { pattern: /^\/help-center$/, title: 'Help Center - InterviewAI Pro' },
  { pattern: /^\/learning-center$/, title: 'Learning Center - InterviewAI Pro' },
  { pattern: /^\/success-stories$/, title: 'Success Stories - InterviewAI Pro' },
  { pattern: /^\/interview-guides$/, title: 'Interview Guides - InterviewAI Pro' },
  { pattern: /^\/help-articles$/, title: 'Help Articles - InterviewAI Pro' },
  { pattern: /^\/api-docs$/, title: 'API Docs - InterviewAI Pro' },
  { pattern: /^\/status$/, title: 'Status - InterviewAI Pro' },
  { pattern: /^\/privacy$/, title: 'Privacy Policy - InterviewAI Pro' },
  { pattern: /^\/terms$/, title: 'Terms of Service - InterviewAI Pro' },
  { pattern: /^\/register$/, title: 'Register - InterviewAI Pro' },
  { pattern: /^\/login$/, title: 'Sign In - InterviewAI Pro' },
  { pattern: /^\/reset-password$/, title: 'Reset Password - InterviewAI Pro' },
  { pattern: /^\/verify-email$/, title: 'Verify Email - InterviewAI Pro' },
  { pattern: /^\/onboarding$/, title: 'Complete Your Profile - InterviewAI Pro' },
  { pattern: /^\/jobs$/, title: 'Jobs - InterviewAI Pro' },
  { pattern: /^\/jobs\/[^/]+$/, title: 'Job Details - InterviewAI Pro' },
  { pattern: /^\/practice-interview-setup$/, title: 'Practice Interview Setup - InterviewAI Pro' },
  { pattern: /^\/live-interview-session$/, title: 'Live Interview Session - InterviewAI Pro' },
  { pattern: /^\/interview-lobby\/[^/]+$/, title: 'Interview Lobby - InterviewAI Pro' },
  { pattern: /^\/invite$/, title: 'Interview Invitation - InterviewAI Pro' },
  { pattern: /^\/accept-team-invite\/[^/]+$/, title: 'Accept Team Invite - InterviewAI Pro' },
  { pattern: /^\/candidate-dashboard$/, title: 'Candidate Dashboard - InterviewAI Pro' },
  { pattern: /^\/my-applications$/, title: 'My Applications - InterviewAI Pro' },
  { pattern: /^\/company-dashboard$/, title: 'Company Dashboard - InterviewAI Pro' },
  { pattern: /^\/company-jobs$/, title: 'Jobs - InterviewAI Pro' },
  { pattern: /^\/company-applications$/, title: 'Applications - InterviewAI Pro' },
  { pattern: /^\/company-interviews$/, title: 'Interviews - InterviewAI Pro' },
  { pattern: /^\/company-invitations$/, title: 'Invitations - InterviewAI Pro' },
  { pattern: /^\/company-candidates$/, title: 'Candidates - InterviewAI Pro' },
  { pattern: /^\/company-analytics$/, title: 'Analytics - InterviewAI Pro' },
  { pattern: /^\/company-team-members$/, title: 'Team Members - InterviewAI Pro' },
  { pattern: /^\/system-admin-dashboard$/, title: 'System Admin Dashboard - InterviewAI Pro' }
];

const normalizePathname = (pathname) => {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

const resolveTitle = (pathname) => {
  const normalized = normalizePathname(pathname);
  const match = TITLE_RULES.find(({ pattern }) => pattern.test(normalized));
  return match?.title || 'Page Not Found - InterviewAI Pro';
};

const PageTitleManager = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = resolveTitle(pathname);
  }, [pathname]);

  return null;
};

export default PageTitleManager;
