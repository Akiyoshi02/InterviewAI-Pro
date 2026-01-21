import React from 'react';
import { motion } from 'framer-motion';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import { 
  Newspaper, Download, Image as ImageIcon, Calendar, 
  TrendingUp, Users, Award, Clock, ExternalLink,
  Mail, PhoneCall
} from 'lucide-react';
import Button from '../../components/ui/Button';

const PressPage = () => {
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

  const pressReleases = [
    {
      date: 'January 15, 2026',
      title: 'InterviewAI Pro Launches Beta for Sri Lankan Market',
      excerpt: 'Revolutionary AI-powered interview platform now available to help candidates practice and companies hire more effectively across Sri Lanka.',
      category: 'Product Launch'
    },
    {
      date: 'December 2025',
      title: 'Introducing Bias-Free Interview Assessment Technology',
      excerpt: 'New evaluation system eliminates unconscious bias in hiring, ensuring fair assessments based purely on skills and competencies.',
      category: 'Technology'
    },
    {
      date: 'November 2025',
      title: 'Partnership with Leading Sri Lankan Tech Companies',
      excerpt: 'InterviewAI Pro announces collaborations with Virtusa, WSO2, and Dialog Axiata to revolutionize their hiring processes.',
      category: 'Partnership'
    }
  ];

  const mediaKit = [
    {
      icon: ImageIcon,
      title: 'Brand Assets',
      description: 'Logos, colors, and brand guidelines',
      action: 'Download ZIP'
    },
    {
      icon: Newspaper,
      title: 'Company Information',
      description: 'Fact sheet, executive bios, and company overview',
      action: 'Download PDF'
    },
    {
      icon: ImageIcon,
      title: 'Product Screenshots',
      description: 'High-resolution platform screenshots',
      action: 'Download ZIP'
    }
  ];

  const stats = [
    { icon: Users, value: '50K+', label: 'Interviews Conducted' },
    { icon: TrendingUp, value: '95%', label: 'Candidate Success Rate' },
    { icon: Award, value: '100%', label: 'Bias-Free Assessments' }
  ];

  const companyInfo = {
    name: 'InterviewAI Pro',
    founded: '2024',
    headquarters: 'Colombo, Sri Lanka',
    founder: 'Akiyoshi Yapa',
    description: 'AI-powered interview platform helping candidates practice and companies hire better through intelligent, bias-free assessments.'
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950">
      <PublicHeader />

      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 xs:py-16 sm:py-20 md:py-24 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Newspaper className="h-4 w-4" />
              <span>Press & Media</span>
            </div>
            <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              Latest News & <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Press Releases</span>
            </h1>
            <p className="text-base xs:text-lg sm:text-xl text-gray-600 dark:text-slate-300 mb-8 xs:mb-10">
              Stay updated with the latest developments, partnerships, and milestones from InterviewAI Pro.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 xs:gap-8 mt-12 xs:mt-16 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="bg-white dark:bg-slate-800 rounded-xl xs:rounded-2xl p-6 shadow-lg dark:shadow-slate-900/50 text-center"
                >
                  <Icon className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <div className="text-3xl xs:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {stat.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Press Releases */}
      <section className="py-12 xs:py-16 sm:py-20 bg-gray-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 xs:mb-16"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              Recent Announcements
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              The latest updates and news from our team.
            </p>
          </motion.div>

          <div className="space-y-6 xs:space-y-8">
            {pressReleases.map((release, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50 hover:shadow-xl transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-medium">
                        {release.category}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400">
                        <Calendar className="h-4 w-4" />
                        {release.date}
                      </span>
                    </div>
                    <h3 className="text-xl xs:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                      {release.title}
                    </h3>
                    <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 leading-relaxed">
                      {release.excerpt}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 min-h-touch whitespace-nowrap"
                  >
                    Read More
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Company Information */}
      <section className="py-12 xs:py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 xs:mb-16"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              Company Information
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Fast facts and key information about InterviewAI Pro.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-8 xs:p-12 shadow-lg dark:shadow-slate-900/50 max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 xs:gap-8 mb-8">
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Company Name</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{companyInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Founded</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{companyInfo.founded}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Headquarters</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{companyInfo.headquarters}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Founder</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{companyInfo.founder}</p>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">About</p>
              <p className="text-base text-gray-700 dark:text-slate-300 leading-relaxed">
                {companyInfo.description}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Media Kit */}
      <section className="py-12 xs:py-16 sm:py-20 bg-gray-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 xs:mb-16"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              Media Kit
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Download logos, brand assets, and company information for your articles.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xs:gap-8">
            {mediaKit.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50 hover:shadow-xl transition text-center"
                >
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 mb-6">
                    {item.description}
                  </p>
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full font-semibold shadow-md hover:from-blue-700 hover:to-purple-700 flex items-center gap-2 mx-auto min-h-touch"
                  >
                    <Download className="h-4 w-4" />
                    {item.action}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Press Contact */}
      <section className="py-12 xs:py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl xs:rounded-3xl p-8 xs:p-12 sm:p-16 text-center"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 xs:mb-6">
              Press Inquiries?
            </h2>
            <p className="text-base xs:text-lg text-blue-100 mb-8 xs:mb-10 max-w-2xl mx-auto">
              For media inquiries, interviews, or additional information, please contact our press team.
            </p>
            <div className="flex flex-col xs:flex-row gap-4 justify-center">
              <Button
                onClick={() => window.location.href = 'mailto:akiyoshiyapa@gmail.com?subject=Press Inquiry'}
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-full font-semibold text-base xs:text-lg shadow-lg flex items-center gap-2 justify-center min-h-touch"
              >
                <Mail className="h-5 w-5" />
                Email Us
              </Button>
              <Button
                onClick={() => window.location.href = 'tel:+94711214592'}
                className="bg-blue-800 text-white hover:bg-blue-900 px-8 py-4 rounded-full font-semibold text-base xs:text-lg shadow-lg flex items-center gap-2 justify-center min-h-touch"
              >
                <PhoneCall className="h-5 w-5" />
                Call Us
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default PressPage;
