import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { Star, Sparkles, Users } from 'lucide-react';

const SuccessStoriesPage = () => {
  const navigate = useNavigate();

  const successMetrics = [
    { label: 'Candidate success rate', value: '95%' },
    { label: 'Avg. time to hire', value: '-75%' },
    { label: 'Interviews delivered', value: '50K+' }
  ];

  const candidateStories = [
    {
      name: 'Dilini Perera',
      role: 'Software Engineer',
      company: 'Virtusa',
      quote: 'The AI feedback helped me fix my structure and deliver crisp answers.'
    },
    {
      name: 'Kasun Fernando',
      role: 'Business Analyst',
      company: 'Dialog Axiata',
      quote: 'I practiced daily and felt confident walking into every interview.'
    },
    {
      name: 'Thisara Weerasinghe',
      role: 'Product Manager',
      company: 'CodeGen',
      quote: 'The industry prompts felt real and helped me pivot into tech.'
    }
  ];

  const companyStories = [
    {
      company: 'WSO2',
      leader: 'Head of Talent',
      quote: 'We reduced screening time while improving candidate quality.'
    },
    {
      company: 'John Keells Holdings',
      leader: 'HR Director',
      quote: 'Analytics finally gave us a clear view of hiring performance.'
    }
  ];

  const outcomes = [
    {
      title: 'Consistent scoring',
      description: 'Structured rubrics ensure every candidate gets the same evaluation.'
    },
    {
      title: 'Faster shortlists',
      description: 'Automated insights cut down decision cycles without losing quality.'
    },
    {
      title: 'Confident candidates',
      description: 'Practice sessions translate into stronger live interviews.'
    }
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
        <title>Success Stories - InterviewAI Pro</title>
        <meta
          name="description"
          content="Success stories from candidates and hiring teams using InterviewAI Pro."
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
                <Star className="h-8 w-8 xs:h-9 xs:w-9 lg:h-10 lg:w-10" />
                <div className="absolute inset-0 rounded-3xl border border-white/30" />
              </div>
            </div>
            <div className="space-y-3 xs:space-y-4">
              <div className="inline-flex items-center space-x-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 xs:px-4 py-1.5 xs:py-2 text-xs xs:text-sm font-medium text-blue-700 dark:text-blue-300">
                <Sparkles className="h-3 w-3 xs:h-4 xs:w-4" />
                <span>Success Stories</span>
              </div>
              <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100">
                Real results from real interviews
              </h1>
              <p className="text-sm xs:text-base sm:text-lg lg:text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Candidates land roles faster and hiring teams move with clarity. See how InterviewAI Pro
                delivers measurable outcomes at every stage.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-5 sm:gap-6">
              {successMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-5 xs:p-6 text-center shadow-lg dark:shadow-slate-900/50"
                >
                  <p className="text-2xl xs:text-3xl font-bold text-gray-900 dark:text-slate-100">{metric.value}</p>
                  <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400 mt-1">{metric.label}</p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section variants={sectionReveal} viewport={viewportConfig}>
            <motion.div variants={fadeUpChild} className="text-center mb-6 xs:mb-8 sm:mb-10">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                Candidate wins
              </h2>
              <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto mt-2">
                Practice with AI coaching, then deliver confident answers in live interviews.
              </p>
            </motion.div>
            <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-5 sm:gap-6" variants={staggeredChildren}>
              {candidateStories.map((story) => (
                <motion.div
                  key={story.name}
                  variants={fadeUpChild}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50"
                >
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300">
                    <Icon name="MessageSquare" size={18} />
                    <span className="text-xs uppercase tracking-wide">Candidate</span>
                  </div>
                  <p className="text-sm xs:text-base text-gray-700 dark:text-slate-300 mt-3">
                    "{story.quote}"
                  </p>
                  <div className="mt-4">
                    <p className="text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100">{story.name}</p>
                    <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400">
                      {story.role} at {story.company}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          <motion.section variants={sectionReveal} viewport={viewportConfig}>
            <motion.div variants={fadeUpChild} className="text-center mb-6 xs:mb-8 sm:mb-10">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                Hiring team impact
              </h2>
              <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto mt-2">
                Teams scale interviews while staying consistent, fair, and data-driven.
              </p>
            </motion.div>
            <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4 xs:gap-5 sm:gap-6" variants={staggeredChildren}>
              {companyStories.map((story) => (
                <motion.div
                  key={story.company}
                  variants={fadeUpChild}
                  className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50"
                >
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-300">
                    <Users className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">Hiring team</span>
                  </div>
                  <p className="text-sm xs:text-base text-gray-700 dark:text-slate-300 mt-3">
                    "{story.quote}"
                  </p>
                  <div className="mt-4">
                    <p className="text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100">{story.company}</p>
                    <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400">{story.leader}</p>
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6">
                {outcomes.map((outcome) => (
                  <div key={outcome.title} className="rounded-xl xs:rounded-2xl bg-white/90 dark:bg-slate-800/80 p-4 xs:p-5">
                    <h3 className="text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100">
                      {outcome.title}
                    </h3>
                    <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400 mt-2">
                      {outcome.description}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col xs:flex-row gap-3 xs:gap-4 justify-center mt-6">
                <Button
                  onClick={() => navigate('/register')}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm xs:text-base font-semibold shadow-lg shadow-blue-500/30"
                >
                  Start your story
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/contact')}
                  className="rounded-full border border-gray-200 dark:border-slate-700 text-sm xs:text-base font-semibold text-gray-700 dark:text-slate-300"
                >
                  Talk to us
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

export default SuccessStoriesPage;
