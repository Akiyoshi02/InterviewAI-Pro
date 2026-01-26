import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { Search, BookOpen, HelpCircle } from 'lucide-react';

const HelpCenterPage = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const popularArticles = [
    {
      title: 'Getting Started with AI Interviews',
      category: 'Getting Started',
      views: '12.5K',
      icon: 'Rocket',
      href: '#'
    },
    {
      title: 'Understanding Performance Analytics',
      category: 'Features',
      views: '8.2K',
      icon: 'BarChart3',
      href: '#'
    },
    {
      title: 'Troubleshooting Video Issues',
      category: 'Technical',
      views: '6.8K',
      icon: 'Video',
      href: '#'
    },
    {
      title: 'Best Practices for Interview Practice',
      category: 'Tips',
      views: '5.4K',
      icon: 'Lightbulb',
      href: '#'
    },
    {
      title: 'Setting Up Your Profile',
      category: 'Account',
      views: '4.9K',
      icon: 'User',
      href: '#'
    },
    {
      title: 'Understanding Interview Feedback',
      category: 'Features',
      views: '4.2K',
      icon: 'MessageSquare',
      href: '#'
    }
  ];

  const quickLinks = [
    { title: 'Account Setup', icon: 'User', href: '#', colorClass: 'from-blue-600 to-blue-500' },
    { title: 'Payment & Billing', icon: 'CreditCard', href: '#', colorClass: 'from-purple-600 to-purple-500' },
    { title: 'Privacy & Security', icon: 'Shield', href: '#', colorClass: 'from-emerald-600 to-emerald-500' },
    { title: 'API Documentation', icon: 'Code', href: '#', colorClass: 'from-cyan-600 to-cyan-500' },
    { title: 'System Status', icon: 'Activity', href: '#', colorClass: 'from-orange-600 to-orange-500' },
    { title: 'Release Notes', icon: 'FileText', href: '#', colorClass: 'from-pink-600 to-pink-500' }
  ];

  const knowledgeBaseCategories = [
    {
      title: 'Getting Started',
      icon: 'Rocket',
      count: 12,
      description: 'Learn the basics and set up your account',
      color: 'from-blue-600 to-blue-500'
    },
    {
      title: 'Interview Features',
      icon: 'Zap',
      count: 18,
      description: 'Master all interview features and tools',
      color: 'from-purple-600 to-purple-500'
    },
    {
      title: 'Account Management',
      icon: 'User',
      count: 8,
      description: 'Manage your profile and settings',
      color: 'from-emerald-600 to-emerald-500'
    },
    {
      title: 'Technical Support',
      icon: 'Settings',
      count: 15,
      description: 'Troubleshoot technical issues',
      color: 'from-cyan-600 to-cyan-500'
    },
    {
      title: 'Billing & Plans',
      icon: 'CreditCard',
      count: 6,
      description: 'Payment, subscriptions, and plans',
      color: 'from-orange-600 to-orange-500'
    },
    {
      title: 'Best Practices',
      icon: 'Award',
      count: 10,
      description: 'Tips and strategies for success',
      color: 'from-pink-600 to-pink-500'
    }
  ];

  const faqCategories = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: 'Rocket',
      faqs: [
        {
          q: 'How do I create an account?',
          a: 'Click on "Create Account" on the login page, fill in your details, choose your account type (Job Seeker or Employer), and complete the registration process. You\'ll receive a confirmation email to verify your account.'
        },
        {
          q: 'What are the different account types?',
          a: 'We offer two account types: Job Seeker for individuals practicing interviews, and Employer for companies conducting interviews. Choose the one that best fits your needs during registration.'
        },
        {
          q: 'How do I verify my email?',
          a: 'After registration, check your email inbox for the 8-digit verification code and enter it on the verification screen. If you don\'t see the email, check your spam folder.'
        },
        {
          q: 'Can I use InterviewAI Pro for free?',
          a: 'Yes! We offer a free tier that includes basic interview practice features. You can upgrade to a premium plan for advanced analytics, unlimited practice sessions, and more features.'
        }
      ]
    },
    {
      id: 'features',
      title: 'Features & Usage',
      icon: 'Zap',
      faqs: [
        {
          q: 'How does the AI interview practice work?',
          a: 'Our AI-powered system conducts realistic interview sessions based on your selected role and industry. You answer questions, receive real-time feedback, and get detailed performance analytics to improve your interview skills.'
        },
        {
          q: 'Can I practice different types of interviews?',
          a: 'Yes! You can practice various interview types including technical interviews, behavioral interviews, case studies, and role-specific interviews. Select your preferred type when setting up a practice session.'
        },
        {
          q: 'How do I view my performance analytics?',
          a: 'After completing an interview session, you can access detailed analytics in your dashboard, including communication score, response quality, areas for improvement, and historical progress tracking.'
        },
        {
          q: 'Can I retake an interview?',
          a: 'Absolutely! You can retake interviews as many times as you want. Each session is saved separately, so you can track your progress over time.'
        }
      ]
    },
    {
      id: 'account',
      title: 'Account & Billing',
      icon: 'User',
      faqs: [
        {
          q: 'How do I reset my password?',
          a: 'Click on "Forgot password?" on the login page, enter your email address, and follow the instructions sent to your email to reset your password.'
        },
        {
          q: 'Can I change my account type?',
          a: 'Account types cannot be changed after registration. If you need a different account type, please create a new account with the desired type.'
        },
        {
          q: 'What payment methods do you accept?',
          a: 'We accept major credit cards, debit cards, and PayPal. All payments are processed securely through our payment partners.'
        },
        {
          q: 'How do I cancel my subscription?',
          a: 'You can cancel your subscription at any time from your account settings. Your access will continue until the end of your current billing period.'
        }
      ]
    },
    {
      id: 'technical',
      title: 'Technical Support',
      icon: 'Settings',
      faqs: [
        {
          q: 'What browsers are supported?',
          a: 'InterviewAI Pro works best on the latest versions of Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated for the best experience.'
        },
        {
          q: 'Do I need a camera and microphone?',
          a: 'Yes, for live interview sessions, you\'ll need a working camera and microphone. For practice sessions, a microphone is required for voice responses.'
        },
        {
          q: 'The video isn\'t working. What should I do?',
          a: 'Check your browser permissions to ensure camera and microphone access is granted. Try refreshing the page, clearing your browser cache, or using a different browser.'
        },
        {
          q: 'Is my data secure?',
          a: 'Yes, we take data security seriously. All data is encrypted in transit and at rest. We comply with GDPR and SOC 2 standards to ensure your information is protected.'
        }
      ]
    }
  ];

  const filteredFAQs = faqCategories.map(category => ({
    ...category,
    faqs: category.faqs.filter(faq =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.faqs.length > 0);

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
        <title>Help Center - InterviewAI Pro</title>
        <meta
          name="description"
          content="Find answers to frequently asked questions, browse knowledge base articles, and get help with InterviewAI Pro."
        />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 transition-colors duration-300">
        <PublicHeader />

        {/* Spacer for fixed header */}
        <div className="h-14 xs:h-16" />

        <motion.main
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 xs:px-5 sm:px-6 lg:px-8 py-8 xs:py-10 sm:py-12 md:py-16 space-y-8 xs:space-y-10 sm:space-y-12"
        >
          {/* Hero Section */}
          <motion.section variants={fadeUpChild} className="text-center space-y-4 xs:space-y-5 lg:space-y-6">
            <div className="flex justify-center">
              <div className="relative w-16 h-16 xs:w-18 xs:h-18 lg:w-20 lg:h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-[0_20px_60px_rgba(59,130,246,0.35)]">
                <HelpCircle className="h-8 w-8 xs:h-9 xs:w-9 lg:h-10 lg:w-10" />
                <div className="absolute inset-0 rounded-3xl border border-white/30" />
              </div>
            </div>
            <div className="space-y-3 xs:space-y-4">
              <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100">
                Help Center
              </h1>
              <p className="text-sm xs:text-base sm:text-lg lg:text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Find answers to common questions, browse our knowledge base, and learn how to get the most out of InterviewAI Pro.
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mt-6 xs:mt-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search for help articles, FAQs, or guides..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="!pl-12 !pr-4 py-3 text-sm lg:text-base"
                  />
              </div>
            </div>
          </motion.section>

          {/* Popular Articles */}
          {!searchQuery && (
            <motion.section variants={fadeUpChild}>
              <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100 mb-4 xs:mb-5 sm:mb-6">
                Popular Articles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6">
                {popularArticles.map((article, index) => (
                  <motion.a
                    key={index}
                    href={article.href}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50 transition cursor-pointer"
                  >
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                          <Icon name={article.icon} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{article.category}</p>
                          <h3 className="text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100 mt-1 line-clamp-2">
                            {article.title}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                        <span>{article.views} views</span>
                        <Icon name="ArrowRight" size={16} className="text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.section>
          )}

          {/* Knowledge Base Categories */}
          {!searchQuery && (
            <motion.section variants={fadeUpChild}>
              <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100 mb-4 xs:mb-5 sm:mb-6">
                Browse by Category
              </h2>
              <motion.div
                variants={staggeredChildren}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6"
              >
                {knowledgeBaseCategories.map((category, index) => (
                  <motion.div
                    key={index}
                    variants={fadeUpChild}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50 transition cursor-pointer"
                  >
                    <div className="relative z-10 space-y-3">
                      <div className={`w-12 h-12 xs:w-14 xs:h-14 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center text-white shadow-lg shadow-blue-500/30`}>
                        <Icon name={category.icon} size={24} className="xs:w-6 xs:h-6" />
                      </div>
                      <div>
                        <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                          {category.title}
                        </h3>
                        <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400 mb-2">
                          {category.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-500">
                          {category.count} articles
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>
          )}

          {/* Quick Links */}
          {!searchQuery && (
            <motion.section variants={fadeUpChild}>
              <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100 mb-4 xs:mb-5 sm:mb-6">
                Quick Links
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 xs:gap-4">
                {quickLinks.map((link, index) => (
                  <motion.a
                    key={index}
                    href={link.href}
                    whileHover={{ y: -2, scale: 1.02 }}
                    className="relative overflow-hidden rounded-xl xs:rounded-2xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 text-center shadow-md dark:shadow-slate-900/50 transition cursor-pointer group"
                  >
                    <div className={`w-10 h-10 mx-auto rounded-xl bg-gradient-to-br ${link.colorClass} flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-2 group-hover:scale-110 transition-transform`}>
                      <Icon name={link.icon} size={20} />
                    </div>
                    <p className="text-xs xs:text-sm font-medium text-gray-900 dark:text-slate-100">{link.title}</p>
                  </motion.a>
                ))}
              </div>
            </motion.section>
          )}

          {/* FAQ Categories */}
          <motion.section variants={fadeUpChild} className="space-y-4 xs:space-y-5">
            <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100">
              Frequently Asked Questions
            </h2>
            {(searchQuery ? filteredFAQs : faqCategories).map((category) => {
              const isOpen = selectedCategory === category.id;
              return (
                <motion.div
                  key={category.id}
                  whileHover={{ y: -2 }}
                  className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50 transition"
                >
                  <div className="relative z-10">
                    <button
                      onClick={() => setSelectedCategory(isOpen ? null : category.id)}
                      className="w-full flex items-center justify-between text-left group"
                    >
                      <div className="flex items-center space-x-3 xs:space-x-4">
                        <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/40 transition-shadow">
                          <Icon name={category.icon} size={20} className="xs:w-5 xs:h-5" />
                        </div>
                        <h3 className="text-base xs:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                          {category.title}
                        </h3>
                      </div>
                      <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={20} className="text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300 transition-colors flex-shrink-0" />
                    </button>

                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-5 xs:mt-6 space-y-4 xs:space-y-5 pt-5 border-t border-gray-200/60 dark:border-slate-700/50"
                      >
                        {category.faqs.map((faq, index) => (
                          <div key={index} className="space-y-2">
                            <h4 className="text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100">
                              {faq.q}
                            </h4>
                            <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                              {faq.a}
                            </p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.section>

          {/* Additional Resources */}
          <motion.section
            variants={fadeUpChild}
            className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50"
          >
            <div className="relative z-10 space-y-5 xs:space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                  Additional Resources
                </h2>
                <div className="flex items-center space-x-2 text-xs xs:text-sm text-gray-600 dark:text-slate-400">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Guides • Tutorials • Updates</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {[
                  {
                    title: 'Documentation',
                    icon: 'Book',
                    description: 'Comprehensive guides and tutorials to help you get the most out of InterviewAI Pro.',
                    action: () => window.location.href = '/api-docs',
                    label: 'View Docs'
                  },
                  {
                    title: 'Video Tutorials',
                    icon: 'Video',
                    description: 'Step-by-step video guides covering all features and best practices.',
                    action: () => alert('Video tutorials coming soon!'),
                    label: 'Watch Videos'
                  }
                ].map((resource) => (
                  <div
                    key={resource.title}
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/70 p-5 lg:p-6 shadow-sm dark:shadow-inner dark:shadow-black/20 space-y-3 hover:border-blue-300 dark:hover:border-blue-400/60 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/40">
                        <Icon name={resource.icon} size={20} className="lg:w-5 lg:h-5" />
                      </div>
                      <h3 className="text-sm lg:text-base font-semibold text-gray-900 dark:text-white">{resource.title}</h3>
                    </div>
                    <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-300">{resource.description}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resource.action}
                      className="rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-100 hover:border-blue-400 hover:text-blue-600 dark:hover:text-white text-xs lg:text-sm"
                    >
                      {resource.label}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Contact CTA */}
          <motion.section variants={fadeUpChild}>
            <div className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50">
              <div className="relative z-10 text-center space-y-4">
                <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                  Still Need Help?
                </h2>
                <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
                  Can't find what you're looking for? Our support team is ready to assist you. Get in touch with us!
                </p>
                <Button
                  onClick={() => window.location.href = '/contact'}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm lg:text-base font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                >
                  Contact Support
                </Button>
              </div>
            </div>
          </motion.section>
        </motion.main>

        <PublicFooter />
      </div>
    </>
  );
};

export default HelpCenterPage;
