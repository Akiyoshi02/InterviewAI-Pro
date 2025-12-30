import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { 
  Star, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Users, 
  MessageSquare, 
  BarChart3, 
  Scale, 
  Eye, 
  Target, 
  Award,
  PlayCircle,
  Calendar,
  FileText,
  Phone,
  Twitter,
  Linkedin,
  Github,
  Menu,
  X,
  Mail,
  PhoneCall,
  ShieldCheck,
  ArrowUpRight
} from 'lucide-react';
import Button from '../../components/ui/Button';

const HomePage = () => {
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

  // Check if this is an OAuth callback redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // This is an OAuth callback, redirect to verify-email
      console.log('OAuth callback detected on home page, redirecting to verify-email');
      navigate(`/verify-email${hash}`);
    }
  }, [navigate]);

  const navLinks = [
    { label: 'Platform', href: '#platform', icon: 'Layers' },
    { label: 'Features', href: '#features', icon: 'Zap' },
    { label: 'Testimonials', href: '#testimonials', icon: 'MessageSquare' },
    { label: 'Enterprise', href: '#enterprise', icon: 'Building2' },
    { label: 'Support', href: '/support', icon: 'HelpCircle' }
  ];

  const highlightSignals = [
    { icon: Sparkles, title: 'AI Interview Coach', meta: 'Adaptive prompts & scoring' },
    { icon: Scale, title: 'Bias-Resistant Hiring', meta: 'SOC 2 & GDPR aligned' },
    { icon: Clock, title: '< 2 min setup', meta: 'Live-ready interview rooms' }
  ];

  const footerHighlights = [
    { icon: Users, label: 'Professionals coached', value: '50K+' },
    { icon: Clock, label: 'Avg. setup time', value: '< 4 mins' },
    { icon: Award, label: 'Success rate', value: '95%' }
  ];

  const contactChannels = [
    { icon: Mail, label: 'Email', value: 'hello@interviewai.pro', href: 'mailto:hello@interviewai.pro' },
    { icon: PhoneCall, label: 'Partnerships', value: '+1 (415) 555-0134', href: 'tel:+14155550134' }
  ];

  const socialLinks = [
    { icon: Twitter, label: 'Twitter', href: '#' },
    { icon: Linkedin, label: 'LinkedIn', href: '#' },
    { icon: Github, label: 'GitHub', href: '#' }
  ];

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

  const floatPulse = {
    animate: {
      y: [0, -8, 0],
      transition: {
        duration: 4,
        ease: 'easeInOut',
        repeat: Infinity
      }
    }
  };

  const handleNavLink = (href) => {
    setIsNavOpen(false);
    if (href.startsWith('#') && typeof document !== 'undefined') {
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
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
      console.error('Instant sign-in check failed', error);
    }

    navigate('/login');
  };

  const stats = [
    { icon: Award, value: '95%', label: 'Job Offer Success Rate' },
    { icon: TrendingUp, value: '40%', label: 'Average Salary Increase' },
    { icon: Clock, value: '75%', label: 'Reduced Screening Time' },
    { icon: Users, value: '50K+', label: 'Successful Interviews' }
  ];

  const candidateTestimonials = [
    {
      name: 'Sarah Chen',
      role: 'Software Engineer at Tech Startup',
      image: '👩‍💻',
      rating: 5,
      text: 'InterviewAI Pro transformed my interview anxiety into confidence. I practiced for 2 weeks and landed my dream job with a 40% salary increase!'
    },
    {
      name: 'Marcus Johnson',
      role: 'Marketing Manager at Fortune 500',
      image: '👨‍💼',
      rating: 5,
      text: 'The AI feedback was incredibly detailed. It helped me identify weak points I never knew I had. Got 3 job offers after using this platform.'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Product Manager at SaaS Company',
      image: '👩‍💼',
      rating: 5,
      text: 'As someone changing careers, this platform gave me the confidence to transition from finance to tech. The industry-specific questions were perfect.'
    }
  ];

  const corporateTestimonials = [
    {
      name: 'David Park',
      role: 'Head of Talent at TechCorp',
      image: '👨‍💻',
      rating: 5,
      text: 'We reduced our initial screening time by 75% while improving candidate quality. The bias reduction features are game-changing for fair hiring.'
    },
    {
      name: 'Lisa Thompson',
      role: 'HR Director at Global Inc',
      image: '👩‍💼',
      rating: 5,
      text: 'Our hiring efficiency improved dramatically. The collaborative assessment tools help our team make better decisions faster.'
    }
  ];

  const features = [
    {
      icon: MessageSquare,
      title: 'AI-Powered Interview Simulation',
      description: 'Practice with our advanced AI that adapts to your responses and provides real-time feedback on your performance.',
      highlights: [
        'Natural conversation flow',
        'Instant performance feedback',
        'Personalized improvement suggestions',
        'Industry-specific questions'
      ]
    },
    {
      icon: Scale,
      title: 'Bias-Free Hiring Process',
      description: 'Eliminate unconscious bias with our structured evaluation system that focuses on skills and competencies.',
      highlights: [
        'Standardized evaluation criteria',
        'Anonymous initial screening',
        'Objective scoring system',
        'Compliance tracking'
      ]
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics Dashboard',
      description: 'Track your progress with detailed analytics that show improvement areas and benchmark against industry standards.',
      highlights: [
        'Performance tracking',
        'Industry benchmarking',
        'Skill gap analysis',
        'Progress visualization'
      ]
    }
  ];

  const companies = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple'];

  const footerLinks = {
    platform: [
      { name: 'Practice Mode', path: '/practice-interview-setup' },
      { name: 'Hiring Portal', path: '/company-dashboard' },
      { name: 'AI Interview', path: '/live-interview-session' },
      { name: 'Analytics', path: '/candidate-dashboard' }
    ],
    resources: [
      { name: 'Learning Center', path: '/support' },
      { name: 'Success Stories', path: '#testimonials' },
      { name: 'Interview Tips', path: '/support' },
      { name: 'Career Guides', path: '/support' }
    ],
    company: [
      { name: 'About Us', path: '#about' },
      { name: 'Careers', path: '#careers' },
      { name: 'Press', path: '#press' },
      { name: 'Contact', path: '/support' }
    ],
    support: [
      { name: 'Help Center', path: '/support' },
      { name: 'API Docs', path: '#api' },
      { name: 'Status', path: '#status' },
      { name: 'Privacy Policy', path: '/privacy' }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Navigation - Matching Dashboard Header Style */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-gray-200/50 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between h-14 xs:h-16 px-3 xs:px-4 sm:px-6 lg:px-8 xl:px-10 max-w-[1920px] mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 xs:gap-3 flex-shrink-0">
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
            {navLinks.map((item) => (
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
            <nav className="space-y-1">
              {navLinks.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavLink(item.href)}
                  className="flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 transition-all duration-200 min-h-touch"
                >
                  <Icon name={item.icon} size={20} className="text-gray-400 dark:text-slate-500" />
                  <span className="font-medium text-base">{item.label}</span>
                </button>
              ))}
            </nav>
            
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
                className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 border-none text-base py-3.5 shadow-md shadow-blue-500/30 min-h-touch"
              >
                Get Started Free
              </Button>
            </div>

            {/* Quick Links for Mobile */}
            <div className="pt-4 border-t border-gray-200 dark:border-slate-700/50">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-500 mb-3 px-1">Quick Links</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleNavLink('/support')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Icon name="HelpCircle" size={16} />
                  <span>Help</span>
                </button>
                <button
                  onClick={() => handleNavLink('/privacy')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Icon name="Shield" size={16} />
                  <span>Privacy</span>
                </button>
                <button
                  onClick={() => handleNavLink('/terms')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Icon name="FileText" size={16} />
                  <span>Terms</span>
                </button>
                <button
                  onClick={() => handleNavLink('mailto:hello@interviewai.pro')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Icon name="Mail" size={16} />
                  <span>Contact</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16 md:h-18" />

      {/* Hero Section - Uses animate instead of whileInView for immediate render */}
      <motion.section
        id="platform"
        variants={sectionReveal}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden mx-4 xs:mx-5 sm:mx-6 lg:mx-8 xl:mx-auto max-w-7xl py-8 xs:py-10 sm:py-12 md:py-16 lg:py-20 xl:py-24 px-4 xs:px-5 sm:px-6 md:px-8 lg:px-10 xl:px-12 mt-4 xs:mt-5 sm:mt-6 md:mt-8 lg:mt-10 rounded-2xl xs:rounded-3xl sm:rounded-[32px] lg:rounded-[40px] bg-white/80 dark:bg-slate-800/80 shadow-[0_25px_80px_rgba(15,23,42,0.08)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.5)] border border-white/40 dark:border-slate-700/40"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
        >
          <div className="absolute -top-16 xs:-top-20 sm:-top-24 -right-8 xs:-right-10 h-48 w-48 xs:h-56 xs:w-56 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80 bg-gradient-to-br from-blue-500/30 via-purple-500/20 to-transparent blur-3xl" />
          <div className="absolute bottom-0 -left-12 xs:-left-16 sm:-left-20 h-56 w-56 xs:h-64 xs:w-64 sm:h-72 sm:w-72 md:h-80 md:w-80 lg:h-96 lg:w-96 bg-gradient-to-tr from-indigo-400/20 via-cyan-300/25 to-transparent blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
        </div>
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ duration: 1.2, delay: 0.3 }}
        >
          <div className="absolute inset-2 xs:inset-3 sm:inset-4 rounded-2xl xs:rounded-3xl border border-white/30 bg-[linear-gradient(120deg,rgba(59,130,246,0.08)_0%,rgba(14,165,233,0.05)_45%,rgba(147,51,234,0.08)_100%)]" />
        </motion.div>
        
        {/* Hero Grid - Stack on mobile, side-by-side on tablet+ */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 xs:gap-10 sm:gap-12 lg:gap-10 xl:gap-16 items-center">
          <motion.div variants={staggeredChildren} initial="hidden" animate="visible" className="order-2 lg:order-1">
            <motion.div
              variants={fadeUpChild}
              className="inline-flex items-center space-x-1.5 xs:space-x-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 xs:px-4 py-1.5 xs:py-2 rounded-full text-[11px] xs:text-xs sm:text-sm font-medium mb-4 xs:mb-5 sm:mb-6"
            >
              <Sparkles className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
              <span>AI-Powered Interview Revolution</span>
            </motion.div>
            
            <motion.h1
              variants={fadeUpChild}
              className="text-2xl xs:text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-5 sm:mb-6 leading-tight"
            >
              Transform Interview{' '}
              <span className="text-blue-600 dark:text-blue-400">Anxiety</span>
              <br className="hidden xs:block" />
              <span className="xs:hidden"> </span>into Career{' '}
              <span className="text-green-500 dark:text-green-400">Confidence</span>
            </motion.h1>
            
            <motion.p
              variants={fadeUpChild}
              className="text-sm xs:text-base sm:text-lg md:text-lg lg:text-xl text-gray-600 dark:text-slate-300 mb-6 xs:mb-7 sm:mb-8 leading-relaxed max-w-xl"
            >
              Where AI meets human potential. Practice with our intelligent interview simulator, 
              eliminate bias in hiring, and level the playing field for career advancement.
            </motion.p>
            
            <motion.div variants={fadeUpChild} className="flex flex-col xs:flex-row flex-wrap gap-3 xs:gap-4 mb-6 xs:mb-7 sm:mb-8">
              <motion.div whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full xs:w-auto">
                <Button
                  onClick={() => navigate('/register')}
                  className="w-full xs:w-auto rounded-xl xs:rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-5 xs:px-6 sm:px-7 md:px-8 lg:px-9 py-3 xs:py-3.5 sm:py-4 text-sm xs:text-base sm:text-base md:text-lg font-semibold text-white shadow-md shadow-blue-500/30 transition flex items-center justify-center gap-2 hover:from-blue-700 hover:to-purple-700 min-h-touch"
                >
                  <Sparkles className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" />
                  Start Practicing Free
                  <svg className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
          
          {/* Video/Media Section */}
          <motion.div
            className="relative order-1 lg:order-2"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={viewportConfig}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          >
            <motion.div
              className="relative bg-white dark:bg-slate-800 rounded-xl xs:rounded-2xl shadow-2xl overflow-hidden"
              variants={floatPulse}
              animate="animate"
            >
              <div className="absolute top-2 right-2 xs:top-3 xs:right-3 sm:top-4 sm:right-4 bg-green-500 text-white px-2.5 xs:px-3 sm:px-4 py-1 xs:py-1.5 sm:py-2 rounded-full flex items-center space-x-1.5 xs:space-x-2 z-10 shadow-lg text-[10px] xs:text-xs sm:text-sm">
                <Star className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-4 sm:w-4 fill-current" />
                <span className="font-semibold">95% Success Rate</span>
              </div>
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-48 xs:h-56 sm:h-64 md:h-72 lg:h-80 xl:h-96 object-cover"
                aria-label="Professional interview setting video"
              >
                <source src="/assets/videos/interview-video.mp4" type="video/mp4" />
              </video>
            </motion.div>
            
            {/* Floating Stats Card */}
            <motion.div
              className="hidden sm:block absolute -bottom-3 -left-3 xs:-bottom-4 xs:-left-4 sm:-bottom-5 sm:-left-5 lg:-bottom-6 lg:-left-6 bg-blue-600 text-white p-2.5 xs:p-3 sm:p-4 rounded-lg xs:rounded-xl shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportConfig}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="flex items-center space-x-2 xs:space-x-2.5 sm:space-x-3">
                <MessageSquare className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
                <div>
                  <div className="text-base xs:text-lg sm:text-xl lg:text-2xl font-bold">50K+</div>
                  <div className="text-[10px] xs:text-xs sm:text-sm opacity-90">Successful Interviews</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section
        className="bg-white dark:bg-slate-900 py-10 xs:py-12 sm:py-14 md:py-16 lg:py-20 border-y border-gray-200 dark:border-slate-800 mt-6 xs:mt-8 sm:mt-10 md:mt-12 lg:mt-14"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
      >
        <div className="max-w-7xl mx-auto px-4 xs:px-5 sm:px-6 lg:px-8">
          <motion.div variants={fadeUpChild} className="text-center mb-8 xs:mb-10 sm:mb-12 md:mb-14">
            <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-3 xs:mb-4">
              Trusted by Thousands of Professionals
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Join the community that's transforming careers and revolutionizing hiring processes
            </p>
          </motion.div>
          
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-5 md:gap-6 lg:gap-8"
            variants={staggeredChildren}
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  variants={fadeUpChild}
                  whileHover={{ y: -6, scale: 1.02, boxShadow: '0 15px 30px rgba(15, 23, 42, 0.08)' }}
                  className="text-center p-3 xs:p-4 sm:p-5 md:p-6 bg-gray-50 dark:bg-slate-800 rounded-xl xs:rounded-2xl transition will-change-transform"
                >
                  <div className="inline-flex items-center justify-center w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg xs:rounded-xl mb-2 xs:mb-3 sm:mb-4">
                    <Icon className="h-4 w-4 xs:h-5 xs:w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-1 xs:mb-2">{stat.value}</div>
                  <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-tight">{stat.label}</div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </motion.section>

      {/* Testimonials Section */}
      <motion.section
        className="py-10 xs:py-12 sm:py-14 md:py-16 lg:py-20 bg-gray-50 dark:bg-slate-900/50"
        id="testimonials"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
      >
        <div className="max-w-7xl mx-auto px-4 xs:px-5 sm:px-6 lg:px-8">
          {/* Candidate Success Stories */}
          <motion.div className="mb-10 xs:mb-12 sm:mb-14 md:mb-16" variants={fadeUpChild}>
            <div className="flex items-center justify-center mb-6 xs:mb-8 sm:mb-10 md:mb-12">
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportConfig}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center space-x-1.5 xs:space-x-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-3 xs:px-4 py-1.5 xs:py-2 rounded-full text-[11px] xs:text-xs sm:text-sm font-medium mb-3 xs:mb-4">
                  <Award className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                  <span>Candidate Success Stories</span>
                </div>
                <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-2">Real results from job seekers like you</h2>
              </motion.div>
            </div>
            
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6 md:gap-8"
              variants={staggeredChildren}
            >
              {candidateTestimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  variants={fadeUpChild}
                  whileHover={{ y: -6, scale: 1.01, boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)' }}
                  className="bg-white dark:bg-slate-800 p-4 xs:p-5 sm:p-6 rounded-xl xs:rounded-2xl shadow-md dark:shadow-slate-900/50 transition"
                >
                  <div className="flex items-center space-x-0.5 xs:space-x-1 mb-3 xs:mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 xs:h-4 xs:w-4 sm:h-5 sm:w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-xs xs:text-sm sm:text-base text-gray-700 dark:text-slate-300 mb-4 xs:mb-5 sm:mb-6 italic leading-relaxed">"{testimonial.text}"</p>
                  <div className="flex items-center space-x-2 xs:space-x-3">
                    <div className="text-xl xs:text-2xl sm:text-3xl">{testimonial.image}</div>
                    <div>
                      <div className="font-semibold text-xs xs:text-sm sm:text-base text-gray-900 dark:text-slate-100">{testimonial.name}</div>
                      <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-slate-400">{testimonial.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
          
          {/* Corporate Success */}
          <motion.div variants={fadeUpChild}>
            <div className="flex items-center justify-center mb-6 xs:mb-8 sm:mb-10 md:mb-12">
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportConfig}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center space-x-1.5 xs:space-x-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 xs:px-4 py-1.5 xs:py-2 rounded-full text-[11px] xs:text-xs sm:text-sm font-medium mb-3 xs:mb-4">
                  <FileText className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                  <span>Corporate Success</span>
                </div>
                <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-2">Trusted by leading companies</h2>
              </motion.div>
            </div>
            
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 xs:gap-5 sm:gap-6 md:gap-8 mb-8 xs:mb-10 sm:mb-12"
              variants={staggeredChildren}
            >
              {corporateTestimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  variants={fadeUpChild}
                  whileHover={{ y: -6, scale: 1.01, boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)' }}
                  className="bg-white dark:bg-slate-800 p-4 xs:p-5 sm:p-6 rounded-xl xs:rounded-2xl shadow-md dark:shadow-slate-900/50 transition"
                >
                  <div className="flex items-center space-x-0.5 xs:space-x-1 mb-3 xs:mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 xs:h-4 xs:w-4 sm:h-5 sm:w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-xs xs:text-sm sm:text-base text-gray-700 dark:text-slate-300 mb-4 xs:mb-5 sm:mb-6 italic leading-relaxed">"{testimonial.text}"</p>
                  <div className="flex items-center space-x-2 xs:space-x-3">
                    <div className="text-xl xs:text-2xl sm:text-3xl">{testimonial.image}</div>
                    <div>
                      <div className="font-semibold text-xs xs:text-sm sm:text-base text-gray-900 dark:text-slate-100">{testimonial.name}</div>
                      <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 dark:text-slate-400">{testimonial.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Industry Recognition */}
      <motion.section
        className="py-10 xs:py-12 sm:py-14 md:py-16 lg:py-20 bg-white dark:bg-slate-900"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
      >
        <div className="max-w-7xl mx-auto px-4 xs:px-5 sm:px-6 lg:px-8">
          <motion.div
            className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl xs:rounded-3xl p-5 xs:p-6 sm:p-8 md:p-10"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={viewportConfig}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="text-center text-white mb-6 xs:mb-7 sm:mb-8">
              <h3 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold mb-2">Industry Recognition</h3>
            </div>
            <motion.div
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 xs:gap-5 sm:gap-6 text-white"
              variants={staggeredChildren}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
            >
              <motion.div className="text-center p-2 xs:p-3" variants={fadeUpChild}>
                <Award className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 mx-auto mb-2" />
                <div className="font-semibold text-[10px] xs:text-xs sm:text-sm md:text-base">AI Innovation Award 2024</div>
              </motion.div>
              <motion.div className="text-center p-2 xs:p-3" variants={fadeUpChild}>
                <Award className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 mx-auto mb-2" />
                <div className="font-semibold text-[10px] xs:text-xs sm:text-sm md:text-base">HR Tech Certified</div>
              </motion.div>
              <motion.div className="text-center p-2 xs:p-3" variants={fadeUpChild}>
                <Star className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 mx-auto mb-2" />
                <div className="font-semibold text-[10px] xs:text-xs sm:text-sm md:text-base">Top Rated Platform</div>
              </motion.div>
              <motion.div className="text-center p-2 xs:p-3" variants={fadeUpChild}>
                <Award className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 mx-auto mb-2" />
                <div className="font-semibold text-[10px] xs:text-xs sm:text-sm md:text-base">Privacy Compliant</div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        className="py-10 xs:py-12 sm:py-14 md:py-16 lg:py-20 xl:py-24"
        id="features"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
      >
        <div className="max-w-7xl mx-auto px-4 xs:px-5 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-10 xs:mb-12 sm:mb-14 md:mb-16"
            variants={fadeUpChild}
          >
            <div className="inline-flex items-center space-x-1.5 xs:space-x-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 xs:px-4 py-1.5 xs:py-2 rounded-full text-[11px] xs:text-xs sm:text-sm font-medium mb-3 xs:mb-4">
              <Sparkles className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
              <span>Innovative Features</span>
            </div>
            <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-3 xs:mb-4">
              Where AI Meets Human Potential
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto">
              Our cutting-edge technology combines artificial intelligence with human insight 
              to create the most effective interview preparation and hiring platform.
            </p>
          </motion.div>

          <div className="space-y-10 xs:space-y-12 sm:space-y-14 md:space-y-16 lg:space-y-20">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isEven = index % 2 === 0;
              
              return (
                <motion.div
                  key={index}
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-6 xs:gap-8 sm:gap-10 lg:gap-12 xl:gap-16 items-center ${!isEven ? 'lg:grid-flow-dense' : ''}`}
                  variants={fadeUpChild}
                  initial="hidden"
                  whileInView="visible"
                  viewport={viewportConfig}
                  transition={{ duration: 0.65, delay: 0.1 }}
                >
                  <div className={`order-2 lg:order-1 ${isEven ? '' : 'lg:col-start-2'}`}>
                    <motion.div
                      className="inline-flex items-center justify-center w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-blue-100 dark:bg-blue-900/50 rounded-xl xs:rounded-2xl mb-4 xs:mb-5 sm:mb-6"
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={viewportConfig}
                      transition={{ duration: 0.4 }}
                    >
                      <Icon className="h-5 w-5 xs:h-6 xs:w-6 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-blue-600 dark:text-blue-400" />
                    </motion.div>
                    <h3 className="text-lg xs:text-xl sm:text-2xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2 xs:mb-3 sm:mb-4">{feature.title}</h3>
                    <p className="text-xs xs:text-sm sm:text-base md:text-lg text-gray-600 dark:text-slate-300 mb-4 xs:mb-5 sm:mb-6 leading-relaxed">{feature.description}</p>
                    <ul className="space-y-2 xs:space-y-2.5 sm:space-y-3">
                      {feature.highlights.map((highlight, i) => (
                        <motion.li
                          key={i}
                          className="flex items-center space-x-2 xs:space-x-2.5 sm:space-x-3"
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={viewportConfig}
                          transition={{ duration: 0.35, delay: i * 0.1 }}
                        >
                          <div className="flex-shrink-0 w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs xs:text-sm sm:text-base text-gray-700 dark:text-slate-300">{highlight}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className={`order-1 lg:order-2 ${isEven ? '' : 'lg:col-start-1 lg:row-start-1'}`}>
                    <motion.div
                      className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 rounded-xl xs:rounded-2xl p-3 xs:p-4 sm:p-6 md:p-8 shadow-xl dark:shadow-slate-900/50"
                      whileHover={{ boxShadow: '0 25px 60px rgba(37, 99, 235, 0.25)' }}
                    >
                      <motion.img
                        src={
                          index === 0 
                            ? "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop"
                            : index === 1
                            ? "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&auto=format&fit=crop"
                            : "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop"
                        }
                        alt={feature.title}
                        className="w-full h-40 xs:h-48 sm:h-56 md:h-64 lg:h-72 xl:h-80 object-cover rounded-lg xs:rounded-xl"
                        initial={{ scale: 1.05 }}
                        whileInView={{ scale: 1 }}
                        viewport={viewportConfig}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        className="py-10 xs:py-12 sm:py-14 md:py-16 lg:py-20 bg-gradient-to-r from-blue-600 to-purple-600"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
      >
        <div className="max-w-4xl mx-auto px-4 xs:px-5 sm:px-6 lg:px-8 text-center">
          <motion.h2
            className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 xs:mb-5 sm:mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            transition={{ duration: 0.6 }}
          >
            Ready to Transform Your Interview Experience?
          </motion.h2>
          <motion.p
            className="text-sm xs:text-base sm:text-lg md:text-xl text-blue-100 mb-3 xs:mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Join thousands of professionals who have already elevated their careers with InterviewAI Pro.
          </motion.p>
        </div>
      </motion.section>

      {/* Custom Solutions */}
      <motion.section
        id="enterprise"
        className="py-10 xs:py-12 sm:py-14 md:py-16 lg:py-20 bg-white dark:bg-slate-900"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
      >
        <div className="max-w-4xl mx-auto px-4 xs:px-5 sm:px-6 lg:px-8">
          <motion.div
            className="bg-gray-50 dark:bg-slate-800 rounded-2xl xs:rounded-3xl p-5 xs:p-6 sm:p-8 md:p-10 lg:p-12 text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={viewportConfig}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-3 xs:mb-4">Need a Custom Solution?</h2>
            <p className="text-xs xs:text-sm sm:text-base md:text-lg text-gray-600 dark:text-slate-300 mb-5 xs:mb-6 sm:mb-7 md:mb-8 max-w-2xl mx-auto">
              We work with organizations of all sizes to create tailored interview and hiring solutions. 
              Contact our team to discuss your specific requirements.
            </p>
            <motion.div
              className="flex flex-wrap justify-center gap-3 xs:gap-4"
              variants={staggeredChildren}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
            >
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} variants={fadeUpChild} className="w-full xs:w-auto">
                <Button
                  onClick={() => navigate('/support')}
                  className="w-full xs:w-auto rounded-xl xs:rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 px-4 xs:px-5 sm:px-6 py-2.5 xs:py-3 text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100 shadow-sm transition hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-2 min-h-touch"
                >
                  <FileText className="h-4 w-4 xs:h-5 xs:w-5" />
                  View Documentation
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Trusted By Section */}
      <motion.section
        className="py-8 xs:py-10 sm:py-12 md:py-14 bg-gray-50 dark:bg-slate-900/50 border-y border-gray-200 dark:border-slate-800"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
      >
        <div className="max-w-7xl mx-auto px-4 xs:px-5 sm:px-6 lg:px-8">
          <motion.p
            className="text-center text-xs xs:text-sm sm:text-base text-gray-600 dark:text-slate-400 mb-5 xs:mb-6 sm:mb-8"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            transition={{ duration: 0.4 }}
          >
            Trusted by professionals at
          </motion.p>
          <motion.div
            className="flex flex-wrap justify-center items-center gap-4 xs:gap-6 sm:gap-8 md:gap-10 lg:gap-12 opacity-60"
            variants={staggeredChildren}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            {companies.map((company, index) => (
              <motion.div
                key={index}
                variants={fadeUpChild}
                className="text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-400 dark:text-slate-600"
              >
                {company}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
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
              <div className="flex flex-col gap-3">
                <div className="flex flex-col xs:flex-row rounded-xl xs:rounded-2xl border border-gray-800 bg-gray-900 p-1 gap-2 xs:gap-0">
                  <input
                    type="email"
                    placeholder="Work Email"
                    className="flex-1 bg-transparent px-3 py-2.5 xs:py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none rounded-lg xs:rounded-none min-h-touch"
                  />
                  <Button className="rounded-xl xs:rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 xs:py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 transition hover:from-blue-700 hover:to-purple-700 min-h-touch">
                    Subscribe
                  </Button>
                </div>
              </div>
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
              <div className="flex flex-wrap gap-2 xs:gap-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      className="flex items-center gap-1.5 xs:gap-2 rounded-full border border-gray-800 dark:border-slate-700 bg-gray-900/70 dark:bg-slate-800/70 px-3 xs:px-4 py-2 xs:py-2.5 text-xs xs:text-sm text-gray-300 dark:text-slate-400 transition hover:border-blue-500/40 dark:hover:border-blue-600/40 hover:text-white dark:hover:text-slate-100 min-h-touch"
                    >
                      <Icon className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                      {social.label}
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 xs:gap-5 sm:gap-6 text-xs xs:text-sm">
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
            <p>© {new Date().getFullYear()} InterviewAI Pro. Crafted in SF & remote.</p>
            <div className="flex flex-wrap gap-3 xs:gap-4 text-gray-500 dark:text-slate-500">
              <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }} className="hover:text-white dark:hover:text-slate-200 transition">
                Terms
              </a>
              <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }} className="hover:text-white dark:hover:text-slate-200 transition">
                Privacy
              </a>
              <a href="#status" className="hover:text-white dark:hover:text-slate-200 transition">
                Status
              </a>
            </div>
          </motion.div>
        </div>
      </motion.footer>
    </div>
  );
};

export default HomePage;
