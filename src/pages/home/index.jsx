import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import { 
  Star, 
  Sparkles, 
  Clock, 
  Users, 
  MessageSquare, 
  BarChart3, 
  Scale, 
  Award,
  FileText
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';

const HomePage = () => {
  const navigate = useNavigate();

  // Check if this is an OAuth callback redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // This is an OAuth callback, redirect to verify-email
      navigate(`/verify-email${hash}`);
    }
  }, [navigate]);

  const highlightSignals = [
    { icon: Sparkles, title: 'AI Interview Coach', meta: 'Adaptive prompts & scoring' },
    { icon: Scale, title: 'Bias-Resistant Hiring', meta: 'SOC 2 & GDPR aligned' },
    { icon: Clock, title: '< 2 min setup', meta: 'Live-ready interview rooms' }
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


  const stats = [
    { icon: Award, value: '95%', label: 'Candidate Success Rate' },
    { icon: Clock, value: '75%', label: 'Faster Hiring Process' },
    { icon: Scale, value: '100%', label: 'Bias-Free Assessments' },
    { icon: Users, value: '50K+', label: 'Interviews Conducted' }
  ];

  const candidateTestimonials = [
    {
      name: 'Dilini Perera',
      role: 'Software Engineer at Virtusa',
      image: 'https://ui-avatars.com/api/?name=Dilini+Perera&background=4F46E5&color=fff&size=128&bold=true',
      rating: 5,
      text: 'InterviewAI Pro හරහා මගේ interview anxiety confidence එකක් බවට හැරුණා. සති 2ක් practice කරලා 40% salary වැඩි කරගෙන dream job එක ගත්තා! This platform changed my life.'
    },
    {
      name: 'Kasun Fernando',
      role: 'Business Analyst at Dialog Axiata',
      image: 'https://ui-avatars.com/api/?name=Kasun+Fernando&background=7C3AED&color=fff&size=128&bold=true',
      rating: 5,
      text: 'The AI feedback was incredibly detailed and helped me identify weak points in my communication. Got 3 job offers including from IFS and hSenid within a month!'
    },
    {
      name: 'Thisara Weerasinghe',
      role: 'Product Manager at CodeGen',
      image: 'https://ui-avatars.com/api/?name=Thisara+Weerasinghe&background=2563EB&color=fff&size=128&bold=true',
      rating: 5,
      text: 'Transitioning from banking to tech seemed impossible, but this platform gave me the confidence I needed. The industry-specific questions prepared me perfectly for Sri Lankan tech companies.'
    }
  ];

  const corporateTestimonials = [
    {
      name: 'Rohan Jayasuriya',
      role: 'Head of Talent at WSO2',
      image: 'https://ui-avatars.com/api/?name=Rohan+Jayasuriya&background=059669&color=fff&size=128&bold=true',
      rating: 5,
      text: 'We reduced our initial screening time by 75% while significantly improving candidate quality. The bias-free assessment features ensure we hire the best talent based purely on merit.'
    },
    {
      name: 'Nadeesha Silva',
      role: 'HR Director at John Keells Holdings',
      image: 'https://ui-avatars.com/api/?name=Nadeesha+Silva&background=DC2626&color=fff&size=128&bold=true',
      rating: 5,
      text: 'Our hiring efficiency improved dramatically across all our subsidiaries. The analytics dashboard provides insights we never had before, helping us make data-driven recruitment decisions.'
    }
  ];

  const features = [
    {
      icon: MessageSquare,
      title: 'AI-Powered Interview Platform',
      description: 'Advanced AI that conducts realistic interviews for candidates to practice and helps companies screen applicants efficiently with consistent, intelligent questioning.',
      highlights: [
        'Natural conversation flow',
        'Instant performance feedback',
        'Automated candidate screening',
        'Industry-specific questions'
      ]
    },
    {
      icon: Scale,
      title: 'Bias-Free Evaluation System',
      description: 'Eliminate unconscious bias with our structured evaluation system that ensures fair assessments for candidates while helping companies focus purely on skills and competencies.',
      highlights: [
        'Standardized evaluation criteria',
        'Objective scoring system',
        'Anonymous screening options',
        'Compliance tracking & reporting'
      ]
    },
    {
      icon: BarChart3,
      title: 'Comprehensive Analytics Dashboard',
      description: 'Candidates track their improvement with detailed progress analytics. Companies gain insights into hiring pipelines, candidate quality, and team performance metrics.',
      highlights: [
        'Performance & progress tracking',
        'Industry benchmarking',
        'Hiring pipeline analytics',
        'Customizable reports & insights'
      ]
    }
  ];

  const companies = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple'];

  return (
    <>
      <Helmet>
        <title>InterviewAI Pro - AI-Powered Interview Preparation & Hiring Platform</title>
        <meta name="description" content="Practice interviews with AI coaches, eliminate hiring bias, and streamline your recruitment process. The smart way to prepare and hire." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 transition-colors duration-300">
        <PublicHeader />

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
              Revolutionize Interviews{' '}
              <span className="text-blue-600 dark:text-blue-400">with AI</span>
              <br className="hidden xs:block" />
              <span className="xs:hidden"> </span>for Candidates{' '}
              <span className="text-green-500 dark:text-green-400">&</span> Companies
            </motion.h1>
            
            <motion.p
              variants={fadeUpChild}
              className="text-sm xs:text-base sm:text-lg md:text-lg lg:text-xl text-gray-600 dark:text-slate-300 mb-6 xs:mb-7 sm:mb-8 leading-relaxed max-w-xl"
            >
              Where AI meets human potential. Candidates practice and build confidence with our intelligent interview simulator. 
              Companies streamline hiring, eliminate bias, and discover top talent faster than ever.
            </motion.p>
            
            <motion.div variants={fadeUpChild} className="flex flex-col xs:flex-row flex-wrap gap-3 xs:gap-4 mb-6 xs:mb-7 sm:mb-8">
              <motion.div whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full xs:w-auto">
                <Button
                  onClick={() => navigate('/register')}
                  className="w-full xs:w-auto rounded-xl xs:rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-5 xs:px-6 sm:px-7 md:px-8 lg:px-9 py-3 xs:py-3.5 sm:py-4 text-sm xs:text-base sm:text-base md:text-lg font-semibold text-white shadow-md shadow-blue-500/30 transition flex items-center justify-center gap-2 hover:from-blue-700 hover:to-purple-700 min-h-touch"
                >
                  <Sparkles className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" />
                  Get Started Free
                  <svg className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Button>
              </motion.div>
              <motion.div whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full xs:w-auto">
                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="w-full xs:w-auto rounded-xl xs:rounded-full border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 xs:px-6 sm:px-7 md:px-8 lg:px-9 py-3 xs:py-3.5 sm:py-4 text-sm xs:text-base sm:text-base md:text-lg font-semibold text-gray-700 dark:text-slate-200 transition flex items-center justify-center gap-2 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 min-h-touch"
                >
                  <Users className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" />
                  Sign In
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
              Trusted by Candidates & Companies Worldwide
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Join thousands of job seekers building confidence and companies discovering exceptional talent
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
                  className="text-center p-3 xs:p-4 sm:p-5 md:p-6 bg-gray-50 dark:bg-slate-800 rounded-xl xs:rounded-2xl transition"
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
                <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-2">Real results from candidates worldwide</h2>
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
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.name}
                      className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-full object-cover flex-shrink-0"
                    />
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
                <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-2">Trusted by hiring teams globally</h2>
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
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.name}
                      className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-full object-cover flex-shrink-0"
                    />
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
              to create the most effective platform for interview preparation, talent assessment, and smart hiring.
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
                            ? "/assets/images/feature-ai-interview.jpg"
                            : index === 1
                            ? "/assets/images/feature-bias-free.jpg"
                            : "/assets/images/feature-analytics.jpg"
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
            Ready to Transform Your Interview Process?
          </motion.h2>
          <motion.p
            className="text-sm xs:text-base sm:text-lg md:text-xl text-blue-100 mb-6 xs:mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Join thousands of professionals building interview confidence and companies discovering top talent with InterviewAI Pro.
          </motion.p>
          <motion.div
            className="flex flex-col xs:flex-row flex-wrap justify-center gap-3 xs:gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Button
              onClick={() => navigate('/register')}
              className="w-full xs:w-auto rounded-xl xs:rounded-full bg-white text-blue-600 px-6 xs:px-7 md:px-8 py-3 xs:py-3.5 text-sm xs:text-base md:text-lg font-semibold shadow-md transition hover:bg-gray-50 min-h-touch"
            >
              <Users className="h-4 w-4 xs:h-5 xs:w-5 mr-2" />
              For Candidates
            </Button>
            <Button
              onClick={() => navigate('/register')}
              className="w-full xs:w-auto rounded-xl xs:rounded-full bg-white text-purple-600 px-6 xs:px-7 md:px-8 py-3 xs:py-3.5 text-sm xs:text-base md:text-lg font-semibold shadow-md transition hover:bg-gray-50 min-h-touch"
            >
              <Icon name="Building2" className="h-4 w-4 xs:h-5 xs:w-5 mr-2" />
              For Companies
            </Button>
          </motion.div>
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
              We work with individuals and organizations of all sizes to create tailored interview preparation and hiring solutions. 
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
                  onClick={() => navigate('/help-center')}
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

        <PublicFooter />
      </div>
    </>
  );
};

export default HomePage;
