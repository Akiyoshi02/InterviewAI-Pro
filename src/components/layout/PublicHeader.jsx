import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Menu, X } from 'lucide-react';
import Icon from '../AppIcon';
import Button from '../ui/Button';

const PublicHeader = () => {
  const navigate = useNavigate();
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isNavOpen]);

  const navPrimaryLinks = [
    { label: 'About', href: '/about', icon: 'Info' },
    { label: 'Learning Center', href: '/learning-center', icon: 'BookOpen' },
    { label: 'Contact', href: '/contact', icon: 'MessageCircle' }
  ];

  const navSections = [
    {
      label: 'Company',
      groups: [
        {
          title: 'About',
          links: [
            { label: 'Press', href: '/press', icon: 'FileText', description: 'News, updates, and media' }
          ]
        },
        {
          title: 'Connect',
          links: [
            { label: 'Careers', href: '/careers', icon: 'Briefcase', description: 'Open roles and culture' }
          ]
        }
      ],
      highlight: {
        title: 'Built for fair hiring',
        description: 'See the story behind InterviewAI Pro.',
        ctaLabel: 'About InterviewAI',
        href: '/about',
        icon: 'Sparkles',
        tone: 'from-blue-600 to-purple-600'
      }
    },
    {
      label: 'Resources',
      groups: [
        {
          title: 'Learning',
          links: [
            { label: 'Interview Guides', href: '/interview-guides', icon: 'ClipboardList', description: 'Playbooks for every format' },
            { label: 'Help Articles', href: '/help-articles', icon: 'FileText', description: 'How-tos and troubleshooting' },
            { label: 'Success Stories', href: '/success-stories', icon: 'Star', description: 'Candidate and team outcomes' }
          ]
        },
        {
          title: 'Support',
          links: [
            { label: 'Help Center', href: '/help-center', icon: 'HelpCircle', description: 'FAQs and knowledge base' },
            { label: 'API Docs', href: '/api-docs', icon: 'Code', description: 'Developer reference' },
            { label: 'Status', href: '/status', icon: 'Activity', description: 'Uptime and incidents' },
            { label: 'Privacy', href: '/privacy', icon: 'Shield', description: 'Data and security' },
            { label: 'Terms', href: '/terms', icon: 'Scale', description: 'Service terms' }
          ]
        }
      ],
      highlight: {
        title: 'Launch a practice session',
        description: 'Get interview-ready in minutes.',
        ctaLabel: 'Start Practice',
        href: '/practice-interview-setup',
        icon: 'PlayCircle',
        tone: 'from-emerald-600 to-cyan-500'
      }
    }
  ];

  const navDirectLinks = [
    { label: 'Help Center', href: '/help-center', icon: 'HelpCircle' }
  ];

  const handleNavLink = (href) => {
    setIsNavOpen(false);
    navigate(href);
  };

  const handleInstantSignIn = async () => {
    try {
      const { authHelpers } = await import('../../config/firebase.js');
      const apiClient = (await import('../../services/apiClient.js')).default;
      const { data } = await authHelpers.getSession();
      const session = data?.session;

      if (session) {
        const userData = await apiClient.auth.getMe();
        if (userData.success && userData.user) {
          const accountType = userData.user.accountType?.toLowerCase();
          const dashboardRoute =
            accountType === 'candidate' ? '/candidate-dashboard' : '/company-dashboard';

          localStorage.setItem('user', JSON.stringify(userData.user));
          localStorage.setItem('isAuthenticated', 'true');
          navigate(dashboardRoute);
          return;
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Instant sign-in check failed', error);
      }
    }

    navigate('/login');
  };

  return (
    <>
      {/* Navigation - Matching Dashboard Header Style */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-gray-200/50 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between h-14 xs:h-16 px-3 xs:px-4 sm:px-6 lg:px-8 xl:px-10 max-w-[1920px] mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 xs:gap-3 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>
            <Sparkles className="h-5 w-5 xs:h-6 xs:w-6 text-blue-600" />
            <div>
              <p className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-slate-100">
                InterviewAI <span className="text-blue-600 dark:text-blue-400">Pro</span>
              </p>
              <p className="hidden sm:block text-[9px] xs:text-[10px] text-gray-500 dark:text-slate-400 leading-tight">
                Human-ready interviews, AI precision.
              </p>
            </div>
          </div>

          {/* Desktop Navigation - Center */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {navPrimaryLinks.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavLink(item.href)}
                className="flex items-center gap-1.5 xl:gap-2 text-xs xl:text-sm font-medium transition-all duration-200 px-2.5 xl:px-3 py-2 rounded-full text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60 min-h-touch"
              >
                {item.label}
              </button>
            ))}
            {navSections.map((section) => (
              <div key={section.label} className="relative group">
                <button
                  type="button"
                  className="flex items-center gap-1.5 xl:gap-2 text-xs xl:text-sm font-medium transition-all duration-200 px-2.5 xl:px-3 py-2 rounded-full text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60 min-h-touch"
                >
                  {section.label}
                  <Icon
                    name="ChevronDown"
                    size={14}
                    className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-slate-300 transition-transform duration-200 group-hover:rotate-180"
                  />
                </button>
                <div className="absolute left-1/2 top-full z-20 w-[680px] max-w-[90vw] -translate-x-1/2 pt-3 opacity-0 translate-y-1 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto">
                  <div className="rounded-3xl border border-gray-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl">
                    <div className="grid gap-6 p-5 lg:p-6 lg:grid-cols-[1fr_1fr_0.9fr]">
                    {section.groups.map((group) => (
                      <div key={group.title} className="space-y-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                          {group.title}
                        </p>
                        <div className="space-y-2">
                          {group.links.map((link) => (
                            <button
                              key={link.href}
                              type="button"
                              onClick={() => handleNavLink(link.href)}
                              className="flex w-full items-start gap-3 rounded-2xl px-2.5 py-2.5 text-left text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100/80 dark:hover:bg-slate-800/70 transition"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100/80 dark:bg-slate-800/80 text-gray-500 dark:text-slate-400">
                                <Icon name={link.icon} size={18} />
                              </span>
                              <span className="flex flex-col">
                                <span className="font-semibold text-gray-900 dark:text-slate-100">
                                  {link.label}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-slate-400">
                                  {link.description}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {section.highlight && (
                      <div className="rounded-2xl border border-gray-200/80 dark:border-slate-700/70 bg-gradient-to-br from-white/60 to-white/20 dark:from-slate-900/70 dark:to-slate-800/40 p-4 shadow-inner">
                        <div className="flex h-full flex-col justify-between gap-4">
                          <div>
                            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${section.highlight.tone} text-white shadow-lg`}>
                              <Icon name={section.highlight.icon} size={18} />
                            </div>
                            <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-slate-100">
                              {section.highlight.title}
                            </h3>
                            <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">
                              {section.highlight.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleNavLink(section.highlight.href)}
                            className="inline-flex items-center justify-center rounded-full bg-gray-900 text-white text-xs font-semibold px-4 py-2 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition"
                          >
                            {section.highlight.ctaLabel}
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {navDirectLinks.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavLink(item.href)}
                className="flex items-center gap-1.5 xl:gap-2 text-xs xl:text-sm font-medium transition-all duration-200 px-2.5 xl:px-3 py-2 rounded-full text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60 min-h-touch"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* CTA Buttons - Right */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            <Button
              onClick={handleInstantSignIn}
              variant="ghost"
              className="rounded-full border border-gray-200/60 dark:border-slate-700 text-xs lg:text-sm px-3 lg:px-4 text-gray-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 min-h-touch"
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate('/register')}
              className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-xs lg:text-sm px-3 lg:px-5 shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 min-h-touch"
            >
              Get Started
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsNavOpen((prev) => !prev)}
            className="md:hidden flex items-center justify-center w-10 h-10 xs:w-11 xs:h-11 rounded-xl border border-gray-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80"
            aria-label={isNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isNavOpen}
          >
            {isNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Panel - Slides in from right below the header */}
      <div 
        className={`fixed top-14 xs:top-16 right-0 bottom-0 z-[101] w-full md:hidden transform transition-transform duration-300 ease-out ${
          isNavOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-gray-200/50 dark:border-slate-800 shadow-2xl overflow-y-auto">
          <div className="px-4 py-5 space-y-4">
            {/* Navigation Items */}
            <nav className="space-y-4">
              <div className="space-y-1">
                {navPrimaryLinks.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleNavLink(item.href)}
                    className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 transition-all duration-200 min-h-touch"
                  >
                    <Icon name={item.icon} size={20} className="text-gray-400 dark:text-slate-500" />
                    <span className="font-medium text-base">{item.label}</span>
                  </button>
                ))}
              </div>
              {navSections.map((section) => (
                <div key={section.label} className="space-y-3">
                  <p className="px-4 text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    {section.label}
                  </p>
                  {section.groups.map((group) => (
                    <div key={group.title} className="space-y-1">
                      <p className="px-4 text-[10px] uppercase tracking-wide text-gray-400/80 dark:text-slate-500/80">
                        {group.title}
                      </p>
                      <div className="space-y-1">
                        {group.links.map((link) => (
                          <button
                            key={link.href}
                            onClick={() => handleNavLink(link.href)}
                            className="flex items-start gap-3 w-full text-left px-4 py-3 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 transition-all duration-200 min-h-touch"
                          >
                            <Icon name={link.icon} size={18} className="mt-0.5 text-gray-400 dark:text-slate-500" />
                            <span className="flex flex-col">
                              <span className="font-medium text-base">{link.label}</span>
                              <span className="text-xs text-gray-500 dark:text-slate-400">{link.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {section.highlight && (
                    <div className="px-4">
                      <button
                        type="button"
                        onClick={() => handleNavLink(section.highlight.href)}
                        className="w-full rounded-2xl border border-gray-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/80 p-4 text-left shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${section.highlight.tone} text-white shadow-lg`}>
                            <Icon name={section.highlight.icon} size={18} />
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                              {section.highlight.title}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                              {section.highlight.description}
                            </span>
                          </span>
                        </div>
                        <span className="mt-3 inline-flex text-xs font-semibold text-blue-600 dark:text-blue-300">
                          {section.highlight.ctaLabel}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="space-y-2">
              {navDirectLinks.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavLink(item.href)}
                  className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 transition-all duration-200 min-h-touch"
                >
                  <Icon name={item.icon} size={20} className="text-gray-400 dark:text-slate-500" />
                  <span className="font-medium text-base">{item.label}</span>
                </button>
              ))}
            </div>
            
            {/* Auth Actions */}
            <div className="pt-4 border-t border-gray-200 dark:border-slate-700/50 space-y-3">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  setIsNavOpen(false);
                  handleInstantSignIn();
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-700 text-base py-3.5 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 min-h-touch"
              >
                Sign In
              </Button>
              <Button
                variant="default"
                fullWidth
                onClick={() => {
                  setIsNavOpen(false);
                  navigate('/register');
                }}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-base py-3.5 text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 min-h-touch"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PublicHeader;
