import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Users, Clock, Award, Mail, PhoneCall, 
  Twitter, Linkedin, Github, Globe, ArrowUpRight 
} from 'lucide-react';
import Button from '../ui/Button';

const PublicFooter = () => {
  const navigate = useNavigate();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState({ type: '', message: '' });
  const [isSubmittingNewsletter, setIsSubmittingNewsletter] = useState(false);

  const footerHighlights = [
    { icon: Users, label: 'Professionals coached', value: '50K+' },
    { icon: Clock, label: 'Avg. setup time', value: '< 4 mins' },
    { icon: Award, label: 'Success rate', value: '95%' }
  ];

  const contactChannels = [
    { icon: Mail, label: 'Email', value: 'akiyoshiyapa@gmail.com', href: 'mailto:akiyoshiyapa@gmail.com' },
    { icon: PhoneCall, label: 'Phone', value: '+94 71 121 4592', href: 'tel:+94711214592' }
  ];

  const socialLinks = [
    { icon: Twitter, label: 'X', href: 'https://x.com/akiyapax' },
    { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/in/akiyoshi-yapa/' },
    { icon: Github, label: 'GitHub', href: 'https://github.com/Akiyoshi02' },
    { icon: Globe, label: 'Portfolio', href: 'https://akiyoshiyapa.netlify.app' }
  ];

  const footerLinks = {
    resources: [
      { name: 'Learning Center', path: '/learning-center' },
      { name: 'Success Stories', path: '/success-stories' },
      { name: 'Interview Guides', path: '/interview-guides' },
      { name: 'Help Articles', path: '/help-articles' }
    ],
    company: [
      { name: 'About Us', path: '/about' },
      { name: 'Careers', path: '/careers' },
      { name: 'Press', path: '/press' },
      { name: 'Contact', path: '/contact' }
    ],
    support: [
      { name: 'Help Center', path: '/help-center' },
      { name: 'API Docs', path: '/api-docs' },
      { name: 'Status', path: '/status' },
      { name: 'Privacy Policy', path: '/privacy' }
    ]
  };

  const viewportConfig = { once: true, amount: 0.15 };

  // Use transform instead of y to avoid layout recalculation
  const sectionReveal = {
    hidden: { opacity: 0, transform: 'translateY(32px)' },
    visible: {
      opacity: 1,
      transform: 'translateY(0px)',
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const staggeredChildren = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05
      }
    }
  };

  const fadeUpChild = {
    hidden: { opacity: 0, transform: 'translateY(20px)' },
    visible: {
      opacity: 1,
      transform: 'translateY(0px)',
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingNewsletter(true);
    setNewsletterStatus({ type: '', message: '' });

    try {
      const apiClient = (await import('../../services/apiClient.js')).default;
      const response = await apiClient.newsletter.subscribe(newsletterEmail);

      if (response.success) {
        setNewsletterStatus({
          type: 'success',
          message: response.alreadySubscribed 
            ? 'You are already subscribed!' 
            : 'Successfully subscribed! Check your email.'
        });
        if (!response.alreadySubscribed) {
          setNewsletterEmail('');
        }
      } else {
        setNewsletterStatus({
          type: 'error',
          message: response.message || 'Subscription failed. Please try again.'
        });
      }
    } catch (error) {
      setNewsletterStatus({
        type: 'error',
        message: error.message || 'Failed to subscribe. Please try again.'
      });
    } finally {
      setIsSubmittingNewsletter(false);
    }
  };

  return (
    <motion.footer
      className="bg-gray-900 dark:bg-slate-950 text-gray-300 dark:text-slate-400 border-t border-gray-800 dark:border-slate-800 py-10 xs:py-12 sm:py-14 md:py-16"
      variants={sectionReveal}
      initial="hidden"
      whileInView="visible"
      viewport={viewportConfig}
    >
      <div className="max-w-7xl mx-auto px-4 xs:px-5 sm:px-6 lg:px-8 space-y-8 xs:space-y-10 sm:space-y-12">
        <motion.div
          className="grid gap-6 xs:gap-8 lg:grid-cols-[1.2fr_0.8fr]"
          variants={staggeredChildren}
        >
          <motion.div
            variants={fadeUpChild}
            className="rounded-2xl xs:rounded-3xl border border-gray-800 bg-gray-900/60 p-5 xs:p-6 sm:p-8 shadow-2xl shadow-black/40"
          >
            <div className="flex items-center gap-2 xs:gap-3 mb-4 xs:mb-5 sm:mb-6">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 text-blue-400" />
                <div>
                  <p className="text-base xs:text-lg sm:text-xl font-semibold text-white">
                    InterviewAI <span className="text-blue-400">Pro</span>
                  </p>
                  <p className="text-[10px] xs:text-xs text-gray-400">Human-ready interviews, AI precision.</p>
                </div>
              </div>
            </div>
            <p className="text-xs xs:text-sm sm:text-base text-gray-400 dark:text-slate-400 mb-5 xs:mb-6 max-w-2xl leading-relaxed">
              We blend adaptive AI, structured scoring, and bias-aware workflows so candidates and talent teams
              share one consistent interview experience.
            </p>

            <motion.div className="grid gap-3 xs:gap-4 grid-cols-1 xs:grid-cols-3" variants={staggeredChildren}>
              {footerHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    variants={fadeUpChild}
                    className="rounded-xl xs:rounded-2xl border border-gray-800 dark:border-slate-700 bg-gray-800/70 dark:bg-slate-800/70 px-3 xs:px-4 py-2.5 xs:py-3 shadow-inner shadow-black/20"
                  >
                    <div className="flex items-center gap-1.5 xs:gap-2 text-[10px] xs:text-xs font-medium text-blue-300">
                      <Icon className="h-3 w-3 xs:h-4 xs:w-4" />
                      {item.label}
                    </div>
                    <p className="text-lg xs:text-xl sm:text-2xl font-semibold text-white mt-1.5 xs:mt-2">{item.value}</p>
                  </motion.div>
                );
              })}
            </motion.div>

            <motion.div className="mt-5 xs:mt-6 flex flex-col xs:flex-row flex-wrap gap-3 xs:gap-4" variants={fadeUpChild}>
              {contactChannels.map((channel) => {
                const Icon = channel.icon;
                return (
                  <a
                    key={channel.label}
                    href={channel.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 xs:gap-3 rounded-xl xs:rounded-2xl border border-gray-800 dark:border-slate-700 bg-gray-900/80 dark:bg-slate-800/80 px-3 xs:px-4 py-2.5 xs:py-3 text-xs xs:text-sm text-gray-300 dark:text-slate-400 shadow-sm transition hover:border-blue-500/40 dark:hover:border-blue-600/40 hover:bg-blue-950/30 dark:hover:bg-blue-900/30 hover:text-white dark:hover:text-slate-100 min-h-touch"
                  >
                    <span className="flex h-8 w-8 xs:h-9 xs:w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg xs:rounded-xl bg-blue-500/10 text-blue-300 flex-shrink-0">
                      <Icon className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] xs:text-xs uppercase tracking-wide text-gray-500">{channel.label}</p>
                      <p className="font-semibold text-white text-xs xs:text-sm truncate">{channel.value}</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-gray-500 group-hover:text-blue-300 flex-shrink-0" />
                  </a>
                );
              })}
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeUpChild}
            className="rounded-2xl xs:rounded-3xl border border-gray-800 bg-gray-900/60 p-5 xs:p-6 sm:p-8 shadow-2xl shadow-black/40"
          >
            <h4 className="text-base xs:text-lg font-semibold text-white mb-2">Stay in the loop</h4>
            <p className="text-xs xs:text-sm text-gray-400 mb-4 xs:mb-5">
              Monthly drops on AI interviewing, hiring benchmarks, and feature releases.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col xs:flex-row rounded-xl xs:rounded-2xl border border-gray-800 bg-gray-900 p-1 gap-2 xs:gap-0">
                <input
                  type="email"
                  aria-label="Email address for newsletter"
                  placeholder="Work Email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  required
                  disabled={isSubmittingNewsletter}
                  className="flex-1 bg-transparent px-3 py-2.5 xs:py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none rounded-lg xs:rounded-none min-h-touch disabled:opacity-50"
                />
                <Button 
                  type="submit"
                  disabled={isSubmittingNewsletter}
                  className="rounded-xl xs:rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 xs:py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 transition hover:from-blue-700 hover:to-purple-700 min-h-touch disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingNewsletter ? 'Subscribing...' : 'Subscribe'}
                </Button>
              </div>
              {newsletterStatus.message && (
                <p className={`text-xs ${newsletterStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {newsletterStatus.message}
                </p>
              )}
            </form>
            <div className="mt-6 xs:mt-8 grid grid-cols-2 gap-3 xs:gap-4 text-xs xs:text-sm text-gray-400">
              <div className="rounded-xl xs:rounded-2xl border border-gray-800 bg-blue-500/10 px-3 xs:px-4 py-2.5 xs:py-3">
                <p className="text-[10px] xs:text-xs uppercase tracking-wide text-blue-300">Live readiness</p>
                <p className="text-white text-sm xs:text-base sm:text-lg font-semibold">24/5 coaches</p>
              </div>
              <div className="rounded-xl xs:rounded-2xl border border-gray-800 bg-blue-500/10 px-3 xs:px-4 py-2.5 xs:py-3">
                <p className="text-[10px] xs:text-xs uppercase tracking-wide text-blue-300">Response SLA</p>
                <p className="text-white text-sm xs:text-base sm:text-lg font-semibold">&lt; 4 hrs avg</p>
              </div>
              <div className="rounded-xl xs:rounded-2xl border border-gray-800 bg-blue-500/10 px-3 xs:px-4 py-2.5 xs:py-3">
                <p className="text-[10px] xs:text-xs uppercase tracking-wide text-blue-300">Uptime</p>
                <p className="text-white text-sm xs:text-base sm:text-lg font-semibold">99.9%</p>
              </div>
              <div className="rounded-xl xs:rounded-2xl border border-gray-800 bg-blue-500/10 px-3 xs:px-4 py-2.5 xs:py-3">
                <p className="text-[10px] xs:text-xs uppercase tracking-wide text-blue-300">Support coverage</p>
                <p className="text-white text-sm xs:text-base sm:text-lg font-semibold">Global</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="grid gap-6 xs:gap-8 grid-cols-1 md:grid-cols-[1fr_2fr]"
          variants={fadeUpChild}
        >
          <div className="space-y-4 xs:space-y-5">
            <p className="text-xs xs:text-sm font-semibold text-gray-400">Follow the build</p>
            <div className="flex flex-nowrap gap-2 xs:gap-3 overflow-x-auto">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 xs:gap-2 rounded-full border border-gray-800 dark:border-slate-700 bg-gray-900/70 dark:bg-slate-800/70 px-3 xs:px-4 py-2 xs:py-2.5 text-xs xs:text-sm text-gray-300 dark:text-slate-400 transition hover:border-blue-500/40 dark:hover:border-blue-600/40 hover:text-white dark:hover:text-slate-100 min-h-touch"
                  >
                    <Icon className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                    {social.label}
                  </a>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-[repeat(3,minmax(180px,1fr))] gap-4 xs:gap-5 sm:gap-6 text-xs xs:text-sm md:w-max md:justify-self-end">
            {Object.entries(footerLinks).map(([section, links]) => (
              <div key={section} className="space-y-2 xs:space-y-3">
                <p className="text-[10px] xs:text-xs uppercase tracking-wide text-gray-500">{section}</p>
                <ul className="space-y-1.5 xs:space-y-2">
                  {links.map((link, linkIndex) => (
                    <li key={`${section}-${link.path}-${linkIndex}`}>
                      <a
                        href={link.path}
                        onClick={(e) => {
                          if (!link.path.startsWith('#')) {
                            e.preventDefault();
                            navigate(link.path);
                          }
                        }}
                        className="text-gray-400 dark:text-slate-500 transition hover:text-white dark:hover:text-slate-200"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="flex flex-col gap-3 xs:gap-4 border-t border-gray-800 dark:border-slate-800 pt-5 xs:pt-6 text-xs xs:text-sm text-gray-400 dark:text-slate-500 sm:flex-row sm:items-center sm:justify-between"
          variants={fadeUpChild}
        >
          <p>&copy; {new Date().getFullYear()} InterviewAI Pro. Crafted in Sri Lanka.</p>
          <div className="flex flex-wrap gap-3 xs:gap-4 text-gray-500 dark:text-slate-500">
            <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }} className="hover:text-white dark:hover:text-slate-200 transition">
              Terms
            </a>
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }} className="hover:text-white dark:hover:text-slate-200 transition">
              Privacy
            </a>
            <a href="/status" onClick={(e) => { e.preventDefault(); navigate('/status'); }} className="hover:text-white dark:hover:text-slate-200 transition">
              Status
            </a>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
};

export default PublicFooter;
