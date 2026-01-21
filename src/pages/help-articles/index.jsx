import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { BookOpen, Search, Sparkles } from 'lucide-react';

const HelpArticlesPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    {
      title: 'Account and Security',
      description: 'Access, verification, and account settings.',
      icon: 'Shield',
      count: 12,
      color: 'from-blue-600 to-blue-500'
    },
    {
      title: 'Interview Practice',
      description: 'Practice workflows, AI feedback, and scoring.',
      icon: 'MessageSquare',
      count: 18,
      color: 'from-purple-600 to-purple-500'
    },
    {
      title: 'Hiring Teams',
      description: 'Hiring workflows, scorecards, and collaboration.',
      icon: 'Users',
      count: 9,
      color: 'from-emerald-600 to-emerald-500'
    },
    {
      title: 'Analytics',
      description: 'Dashboards, benchmarks, and exports.',
      icon: 'BarChart3',
      count: 7,
      color: 'from-cyan-600 to-cyan-500'
    }
  ];

  const featuredArticles = [
    {
      title: 'Getting started with AI interview practice',
      category: 'Interview Practice',
      readTime: '5 min read'
    },
    {
      title: 'Invite your team and assign roles',
      category: 'Hiring Teams',
      readTime: '6 min read'
    },
    {
      title: 'Understand scorecards and feedback',
      category: 'Analytics',
      readTime: '4 min read'
    },
    {
      title: 'Troubleshoot audio and video permissions',
      category: 'Account and Security',
      readTime: '3 min read'
    }
  ];

  const quickFixes = [
    'Camera permissions in Chrome',
    'Audio device setup checklist',
    'Resetting your password',
    'Managing notification settings'
  ];

  const filteredArticles = featuredArticles.filter((article) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      article.title.toLowerCase().includes(query)
      || article.category.toLowerCase().includes(query)
    );
  });

  const viewportConfig = { once: true, amount: 0.15 };

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

  return (
    <>
      <Helmet>
        <title>Help Articles - InterviewAI Pro</title>
        <meta
          name="description"
          content="Help articles and troubleshooting guides for InterviewAI Pro."
        />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 transition-colors duration-300">
        <PublicHeader />

        <div className="h-14 xs:h-16" />

        <motion.main
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 xs:px-5 sm:px-6 lg:px-8 py-8 xs:py-10 sm:py-12 md:py-16 space-y-10 xs:space-y-12 sm:space-y-14"
        >
          <motion.section variants={fadeUpChild} className="text-center space-y-4 xs:space-y-5">
            <div className="flex justify-center">
              <div className="relative w-16 h-16 xs:w-18 xs:h-18 lg:w-20 lg:h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-[0_20px_60px_rgba(59,130,246,0.35)]">
                <BookOpen className="h-8 w-8 xs:h-9 xs:w-9 lg:h-10 lg:w-10" />
                <div className="absolute inset-0 rounded-3xl border border-white/30" />
              </div>
            </div>
            <div className="space-y-3 xs:space-y-4">
              <div className="inline-flex items-center space-x-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 xs:px-4 py-1.5 xs:py-2 text-xs xs:text-sm font-medium text-blue-700 dark:text-blue-300">
                <Sparkles className="h-3 w-3 xs:h-4 xs:w-4" />
                <span>Help Articles</span>
              </div>
              <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100">
                Search for answers fast
              </h1>
              <p className="text-sm xs:text-base sm:text-lg lg:text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Explore guides, troubleshooting tips, and workflows to get the most out of InterviewAI Pro.
              </p>
            </div>
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search help articles"
                  className="!pl-12 !pr-4 py-3 text-sm lg:text-base"
                />
              </div>
            </div>
          </motion.section>

          <motion.section variants={sectionReveal} viewport={viewportConfig}>
            <motion.div variants={fadeUpChild} className="text-center mb-6 xs:mb-8 sm:mb-10">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                Browse by category
              </h2>
              <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto mt-2">
                Jump into a topic area or scan the most requested guides.
              </p>
            </motion.div>
            <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4 xs:gap-5 sm:gap-6" variants={staggeredChildren}>
              {categories.map((category) => (
                <motion.div
                  key={category.title}
                  variants={fadeUpChild}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 xs:w-14 xs:h-14 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center text-white shadow-lg shadow-blue-500/20`}>
                      <Icon name={category.icon} size={22} />
                    </div>
                    <div>
                      <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100">
                        {category.title}
                      </h3>
                      <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400 mt-1">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-xs xs:text-sm text-blue-600 dark:text-blue-300 font-medium">
                    {category.count} articles
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          <motion.section variants={sectionReveal} viewport={viewportConfig}>
            <motion.div variants={fadeUpChild} className="text-center mb-6 xs:mb-8 sm:mb-10">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                Featured articles
              </h2>
              <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto mt-2">
                Quick guides for the most common questions and workflows.
              </p>
            </motion.div>
            <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4 xs:gap-5 sm:gap-6" variants={staggeredChildren}>
              {filteredArticles.map((article) => (
                <motion.div
                  key={article.title}
                  variants={fadeUpChild}
                  className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50"
                >
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                    <span>{article.category}</span>
                    <span>{article.readTime}</span>
                  </div>
                  <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100 mt-3">
                    {article.title}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/contact')}
                    className="mt-4 rounded-full border border-gray-200 dark:border-slate-700 text-xs xs:text-sm font-semibold text-gray-700 dark:text-slate-300"
                  >
                    Ask support
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          <motion.section variants={sectionReveal} viewport={viewportConfig}>
            <motion.div
              variants={fadeUpChild}
              className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-3">
                  <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                    Quick fixes
                  </h2>
                  <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-xl">
                    Resolve common setup issues in a few minutes.
                  </p>
                </div>
                <div className="grid gap-2 xs:gap-3">
                  {quickFixes.map((item) => (
                    <div
                      key={item}
                      className="rounded-xl xs:rounded-2xl border border-blue-100 dark:border-blue-800/50 bg-white/90 dark:bg-slate-800/80 px-4 py-3 text-xs xs:text-sm text-gray-700 dark:text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col xs:flex-row gap-3 xs:gap-4 justify-center mt-6">
                <Button
                  onClick={() => navigate('/help-center')}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm xs:text-base font-semibold shadow-lg shadow-blue-500/30"
                >
                  Visit Help Center
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/contact')}
                  className="rounded-full border border-gray-200 dark:border-slate-700 text-sm xs:text-base font-semibold text-gray-700 dark:text-slate-300"
                >
                  Contact support
                </Button>
              </div>
            </motion.div>
          </motion.section>
        </motion.main>

        <PublicFooter />
      </div>
    </>
  );
};

export default HelpArticlesPage;
