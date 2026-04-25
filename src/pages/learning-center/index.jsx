import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import BrandBrainIcon from '../../components/BrandBrainIcon';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { BookOpen, GraduationCap, Target, Clock } from 'lucide-react';

const LearningCenterPage = () => {
  const navigate = useNavigate();

  const learningPaths = [
    {
      title: 'Candidate Foundations',
      description: 'Build interview confidence with structured practice and clear feedback loops.',
      duration: '4 modules',
      icon: 'User',
      color: 'from-blue-600 to-purple-600'
    },
    {
      title: 'Technical Readiness',
      description: 'Sharpen technical answers with AI-guided practice and rubric-based scoring.',
      duration: '6 modules',
      icon: 'Code2',
      color: 'from-emerald-600 to-cyan-500'
    },
    {
      title: 'Hiring Team Playbook',
      description: 'Learn to run consistent, bias-aware interviews with structured evaluation.',
      duration: '5 modules',
      icon: 'Users',
      color: 'from-purple-600 to-pink-500'
    }
  ];

  const focusAreas = [
    {
      title: 'Behavioral Excellence',
      description: 'Master STAR storytelling and adaptive follow-up techniques.',
      icon: 'MessageSquare'
    },
    {
      title: 'Analytics Literacy',
      description: 'Turn interview insights into measurable hiring improvements.',
      icon: 'BarChart3'
    },
    {
      title: 'Live Interview Setup',
      description: 'Go from role definition to live-ready sessions in minutes.',
      icon: 'PlayCircle'
    }
  ];

  const workshops = [
    {
      title: 'Mock Interview Sprint',
      time: 'Every Tuesday, 6:00 PM IST',
      detail: 'Rapid practice sessions with AI coaching and a live recap.'
    },
    {
      title: 'Hiring Ops Roundtable',
      time: 'First Friday of each month',
      detail: 'Collaborate with recruiting leaders on structured hiring workflows.'
    },
    {
      title: 'Analytics Lab',
      time: 'On-demand',
      detail: 'Deep dives into scorecards, benchmarks, and improvement tracking.'
    }
  ];

  const stats = [
    { label: 'Guided practice hours', value: '120K+' },
    { label: 'Playbooks shipped', value: '75+' },
    { label: 'Hiring teams trained', value: '1.2K' }
  ];

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
        <title>Learning Center - InterviewAI Pro</title>
        <meta
          name="description"
          content="Learning Center for InterviewAI Pro with structured paths, workshops, and guided practice."
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
                <BrandBrainIcon className="h-3 w-3 xs:h-4 xs:w-4" />
                <span>Learning Center</span>
              </div>
              <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100">
                Structured learning for modern interviews
              </h1>
              <p className="text-sm xs:text-base sm:text-lg lg:text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Explore guided paths, live workshops, and targeted practice modules crafted for candidates
                and hiring teams. Every lesson ends with clear actions you can take today.
              </p>
            </div>
            <div className="flex flex-col xs:flex-row gap-3 xs:gap-4 justify-center">
              <Button
                onClick={() => navigate('/register')}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm xs:text-base font-semibold shadow-lg shadow-blue-500/30"
              >
                Start learning
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/help-center')}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-sm xs:text-base font-semibold text-gray-700 dark:text-slate-300"
              >
                Visit Help Center
              </Button>
            </div>
          </motion.section>

          <motion.section variants={fadeUpChild} className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-5 sm:gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-5 xs:p-6 text-center shadow-lg dark:shadow-slate-900/50"
              >
                <p className="text-2xl xs:text-3xl font-bold text-gray-900 dark:text-slate-100">{stat.value}</p>
                <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.section>

          <motion.section variants={sectionReveal} viewport={viewportConfig}>
            <motion.div variants={fadeUpChild} className="text-center mb-6 xs:mb-8 sm:mb-10">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                Guided learning paths
              </h2>
              <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto mt-2">
                Follow a curated path with clear milestones, practice sessions, and progress tracking.
              </p>
            </motion.div>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-5 sm:gap-6"
              variants={staggeredChildren}
            >
              {learningPaths.map((path) => (
                <motion.div
                  key={path.title}
                  variants={fadeUpChild}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50"
                >
                  <div className={`w-12 h-12 xs:w-14 xs:h-14 rounded-2xl bg-gradient-to-br ${path.color} flex items-center justify-center text-white shadow-lg shadow-blue-500/20`}>
                    <Icon name={path.icon} size={22} />
                  </div>
                  <div className="mt-4 space-y-2">
                    <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {path.title}
                    </h3>
                    <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400">
                      {path.description}
                    </p>
                    <div className="inline-flex items-center gap-2 text-xs xs:text-sm text-blue-600 dark:text-blue-300 font-medium">
                      <Clock className="h-4 w-4" />
                      {path.duration}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          <motion.section variants={sectionReveal} viewport={viewportConfig}>
            <motion.div variants={fadeUpChild} className="text-center mb-6 xs:mb-8 sm:mb-10">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                Focus areas
              </h2>
              <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto mt-2">
                Target the exact skills you need with short, high-impact learning sprints.
              </p>
            </motion.div>
            <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-5 sm:gap-6" variants={staggeredChildren}>
              {focusAreas.map((area) => (
                <motion.div
                  key={area.title}
                  variants={fadeUpChild}
                  className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300">
                      <Icon name={area.icon} size={18} />
                    </div>
                    <div>
                      <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100">
                        {area.title}
                      </h3>
                      <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400 mt-1">
                        {area.description}
                      </p>
                    </div>
                  </div>
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
                  <div className="inline-flex items-center space-x-2 rounded-full bg-white/80 dark:bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <GraduationCap className="h-4 w-4" />
                    <span>Workshops and labs</span>
                  </div>
                  <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                    Live learning, on your schedule
                  </h2>
                  <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-xl">
                    Join live sessions or explore on-demand labs to go deeper on interview readiness,
                    hiring operations, and analytics.
                  </p>
                </div>
                <div className="grid gap-3 xs:gap-4">
                  {workshops.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl xs:rounded-2xl border border-blue-100 dark:border-blue-800/50 bg-white/90 dark:bg-slate-800/80 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Target className="h-5 w-5 text-blue-600 dark:text-blue-300 mt-0.5" />
                        <div>
                          <h3 className="text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100">
                            {item.title}
                          </h3>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{item.time}</p>
                          <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400 mt-1">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.section>
        </motion.main>

        <PublicFooter />
      </div>
    </>
  );
};

export default LearningCenterPage;
