import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import BrandBrainIcon from '../../components/BrandBrainIcon';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { ClipboardList, CheckCircle } from 'lucide-react';

const InterviewGuidesPage = () => {
  const navigate = useNavigate();

  const guideCollections = [
    {
      title: 'Behavioral Interviews',
      description: 'Structured story frameworks and follow-up strategies.',
      duration: '12 guides',
      icon: 'MessageSquare',
      color: 'from-blue-600 to-purple-600'
    },
    {
      title: 'Technical Interviews',
      description: 'Prompt breakdowns, reasoning paths, and live coding tips.',
      duration: '16 guides',
      icon: 'Code2',
      color: 'from-emerald-600 to-cyan-500'
    },
    {
      title: 'Leadership Interviews',
      description: 'Executive narratives, stakeholder alignment, and strategic clarity.',
      duration: '9 guides',
      icon: 'Briefcase',
      color: 'from-purple-600 to-pink-500'
    }
  ];

  const playbookSteps = [
    {
      title: 'Define the role',
      detail: 'Align expectations, competencies, and the interview loop.'
    },
    {
      title: 'Practice with intent',
      detail: 'Use AI sessions to rehearse the moments that matter most.'
    },
    {
      title: 'Refine and repeat',
      detail: 'Review feedback, update answers, and track progress.'
    }
  ];

  const readinessChecks = [
    'Clarify role goals and success metrics',
    'Prepare a concise introduction and impact story',
    'Practice with timed responses and feedback notes',
    'Review scorecards and strengthen weak areas'
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
        <title>Interview Guides - InterviewAI Pro</title>
        <meta
          name="description"
          content="Interview guides and playbooks for candidates and hiring teams using InterviewAI Pro."
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
                <ClipboardList className="h-8 w-8 xs:h-9 xs:w-9 lg:h-10 lg:w-10" />
                <div className="absolute inset-0 rounded-3xl border border-white/30" />
              </div>
            </div>
            <div className="space-y-3 xs:space-y-4">
              <div className="inline-flex items-center space-x-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 xs:px-4 py-1.5 xs:py-2 text-xs xs:text-sm font-medium text-blue-700 dark:text-blue-300">
                <BrandBrainIcon className="h-3 w-3 xs:h-4 xs:w-4" />
                <span>Interview Guides</span>
              </div>
              <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100">
                Playbooks built for high-impact interviews
              </h1>
              <p className="text-sm xs:text-base sm:text-lg lg:text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Step-by-step guidance for every interview format. Build confidence, refine answers, and
                stay consistent across every round.
              </p>
            </div>
            <div className="flex flex-col xs:flex-row gap-3 xs:gap-4 justify-center">
              <Button
                onClick={() => navigate('/practice-interview-setup')}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm xs:text-base font-semibold shadow-lg shadow-blue-500/30"
              >
                Start practice session
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/register')}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-sm xs:text-base font-semibold text-gray-700 dark:text-slate-300"
              >
                Create an account
              </Button>
            </div>
          </motion.section>

          <motion.section variants={sectionReveal} viewport={viewportConfig}>
            <motion.div variants={fadeUpChild} className="text-center mb-6 xs:mb-8 sm:mb-10">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                Guide collections
              </h2>
              <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto mt-2">
                Browse targeted collections for every stage of the interview journey.
              </p>
            </motion.div>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-5 sm:gap-6"
              variants={staggeredChildren}
            >
              {guideCollections.map((collection) => (
                <motion.div
                  key={collection.title}
                  variants={fadeUpChild}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50"
                >
                  <div className={`w-12 h-12 xs:w-14 xs:h-14 rounded-2xl bg-gradient-to-br ${collection.color} flex items-center justify-center text-white shadow-lg shadow-blue-500/20`}>
                    <Icon name={collection.icon} size={22} />
                  </div>
                  <div className="mt-4 space-y-2">
                    <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {collection.title}
                    </h3>
                    <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400">
                      {collection.description}
                    </p>
                    <p className="text-xs xs:text-sm text-blue-600 dark:text-blue-300 font-medium">
                      {collection.duration}
                    </p>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xs:gap-8">
                <div className="space-y-4">
                  <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                    Your interview playbook in three steps
                  </h2>
                  <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300">
                    Follow a simple, repeatable approach to keep every interview focused and effective.
                  </p>
                  <div className="space-y-3">
                    {playbookSteps.map((step, index) => (
                      <div key={step.title} className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100">
                            {step.title}
                          </h3>
                          <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400">
                            {step.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/90 dark:bg-slate-800/80 p-5 xs:p-6">
                  <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100">
                    Readiness checklist
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {readinessChecks.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span className="text-xs xs:text-sm text-gray-600 dark:text-slate-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/help-center')}
                    className="mt-6 rounded-full border border-gray-200 dark:border-slate-700 text-sm xs:text-base font-semibold text-gray-700 dark:text-slate-300"
                  >
                    Explore help resources
                  </Button>
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

export default InterviewGuidesPage;
