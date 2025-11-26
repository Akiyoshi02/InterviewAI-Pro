import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/AppIcon';
import BrandMark from '../../components/BrandMark';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const Support = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contactOptions = [
    {
      id: 'email',
      icon: 'Mail',
      title: 'Email Support',
      description: 'Get help via email',
      actionLabel: 'support@aiinterviewpro.com',
      href: 'mailto:support@aiinterviewpro.com',
      color: 'from-blue-600 to-blue-500'
    },
    {
      id: 'chat',
      icon: 'MessageCircle',
      title: 'Live Chat',
      description: 'Chat with our team',
      actionLabel: 'Start Chat',
      action: () => alert('Live chat coming soon!'),
      color: 'from-purple-600 to-purple-500'
    },
    {
      id: 'sla',
      icon: 'Clock',
      title: 'Response Time',
      description: 'We typically respond within 24 hours',
      color: 'from-emerald-600 to-emerald-500'
    }
  ];

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
          a: 'After registration, check your email inbox for a verification link. Click on the link to verify your email address. If you don\'t see the email, check your spam folder.'
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
        }
      ]
    }
  ];

  const viewportConfig = { once: true, amount: 0.2 };
  const sectionReveal = {
    hidden: { opacity: 0, y: 48 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' } }
  };
  const fadeUpChild = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
  };

  return (
    <>
      <Helmet>
        <title>Help & Support - InterviewAI Pro</title>
        <meta
          name="description"
          content="Get help and support for InterviewAI Pro. Find answers to frequently asked questions and contact our support team."
        />
      </Helmet>
      <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden transition-colors duration-300">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-24 h-[420px] w-[420px] bg-gradient-to-br from-blue-500/40 via-purple-500/25 to-transparent blur-[160px]" />
          <div className="absolute bottom-0 -left-32 h-[520px] w-[520px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[160px]" />
          <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
        </div>

        <header className="relative z-10">
          <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-6 pt-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 px-4 py-3 shadow-[0_10px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur">
              <div className="flex items-center space-x-3">
                <BrandMark
                  showTagline
                  className="items-start"
                  iconWrapperClassName="w-9 h-9 rounded-2xl"
                  textClassName="text-sm md:text-base font-semibold"
                  taglineClassName="text-xs md:text-sm text-gray-500 dark:text-slate-400"
                />
              </div>
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="rounded-full border border-white/40 dark:border-slate-700/50 text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </header>

        <motion.main
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10"
        >
          <motion.section variants={fadeUpChild} className="text-center space-y-4 lg:space-y-5">
            <div className="flex justify-center">
              <div className="relative w-16 h-16 lg:w-20 lg:h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-[0_20px_60px_rgba(59,130,246,0.35)]">
                <Icon name="HelpCircle" size={28} className="lg:w-8 lg:h-8" />
                <div className="absolute inset-0 rounded-3xl border border-white/30" />
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-slate-100">Help & Support Centre</h1>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
                Find answers, best-practice guides, and instant ways to reach the InterviewAI Pro support team.
              </p>
              <div className="inline-flex items-center space-x-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium text-blue-700 dark:text-blue-300">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span>Live readiness · 24/5 coverage</span>
              </div>
            </div>
          </motion.section>


          {/* Contact Options */}
          <motion.section variants={fadeUpChild}>
            <h2 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Get in Touch</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              {contactOptions.map((option) => (
                <div
                  key={option.id}
                  className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/85 p-5 sm:p-6 text-center shadow-[0_25px_80px_rgba(15,23,42,0.18)] backdrop-blur hover:shadow-[0_25px_80px_rgba(15,23,42,0.25)] transition-shadow"
                >
                  <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.08),transparent_45%)]" />
                  <div className="relative z-10 space-y-4">
                    <div className={`w-12 h-12 lg:w-14 lg:h-14 mx-auto rounded-2xl bg-gradient-to-br ${option.color} flex items-center justify-center text-white shadow-lg shadow-blue-500/30`}>
                      <Icon name={option.icon} size={22} className="lg:w-6 lg:h-6" />
                    </div>
                    <div>
                      <h3 className="text-base lg:text-lg font-semibold text-gray-900">{option.title}</h3>
                      <p className="text-xs lg:text-sm text-gray-500 mt-1">{option.description}</p>
                    </div>
                    {option.href ? (
                      <a href={option.href} className="inline-block text-blue-600 text-xs lg:text-sm font-medium hover:text-blue-700 hover:underline transition-colors">
                        {option.actionLabel}
                      </a>
                    ) : option.action ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={option.action}
                        className="rounded-full border border-gray-200 text-gray-800 hover:border-blue-300 hover:text-blue-600 text-xs lg:text-sm"
                      >
                        {option.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Contact Form */}
          <motion.section variants={fadeUpChild}>
            <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/85 p-6 sm:p-8 shadow-[0_25px_80px_rgba(15,23,42,0.18)] backdrop-blur">
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.08),transparent_45%),radial-gradient(circle_at_100%_20%,rgba(147,51,234,0.08),transparent_45%)]" />
              <div className="relative z-10 space-y-5">
                <div>
                  <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">Send us a Message</h2>
                  <p className="text-xs lg:text-sm text-gray-600">
                    Can't find what you're looking for? Fill out the form below and we'll get back to you within 24 hours.
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setIsSubmitting(true);
                    setTimeout(() => {
                      alert('Thank you for your message! We\'ll get back to you soon.');
                      setContactForm({ name: '', email: '', subject: '', message: '' });
                      setIsSubmitting(false);
                    }, 1000);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Your Name"
                      type="text"
                      placeholder="Enter your name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      required
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="Enter your email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <Input
                    label="Subject"
                    type="text"
                    placeholder="What can we help you with?"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    required
                  />
                  <div>
                    <label className="text-xs lg:text-sm font-medium text-gray-700 mb-2 block">
                      Message
                    </label>
                    <textarea
                      placeholder="Tell us more about your question or issue..."
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      rows={5}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      required
                    />
                  </div>
                  <div className="flex justify-center">
                    <Button
                      type="submit"
                      loading={isSubmitting}
                      className="w-full sm:w-auto rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm lg:text-base font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                    >
                      Send Message
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </motion.section>

          <motion.section variants={fadeUpChild} className="space-y-4 lg:space-y-5">
            {faqCategories.map((category) => {
              const isOpen = selectedCategory === category.id;
              return (
                <div
                  key={category.id}
                  className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/85 p-5 sm:p-6 shadow-[0_25px_80px_rgba(15,23,42,0.18)] backdrop-blur hover:shadow-[0_25px_80px_rgba(15,23,42,0.25)] transition-shadow"
                >
                  <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.08),transparent_45%)]" />
                  <div className="relative z-10">
                    <button
                      onClick={() => setSelectedCategory(isOpen ? null : category.id)}
                      className="w-full flex items-center justify-between text-left group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/40 transition-shadow">
                          <Icon name={category.icon} size={20} className="lg:w-5 lg:h-5" />
                        </div>
                        <h2 className="text-base lg:text-xl font-semibold text-gray-900">{category.title}</h2>
                      </div>
                      <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </button>

                    {isOpen && (
                      <div className="mt-5 lg:mt-6 space-y-4 lg:space-y-5 pt-5 border-t border-white/40">
                        {category.faqs.map((faq, index) => (
                          <div key={index} className="space-y-2">
                            <h3 className="text-sm lg:text-base font-semibold text-gray-900">{faq.q}</h3>
                            <p className="text-xs lg:text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.section>

          <motion.section
            variants={fadeUpChild}
            className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/60 p-6 sm:p-8 shadow-2xl shadow-black/40 text-gray-300"
          >
            <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_100%_20%,rgba(147,51,234,0.18),transparent_45%)]" />
            <div className="relative z-10 space-y-5 lg:space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl lg:text-2xl font-semibold text-white">Additional Resources</h2>
                <div className="flex items-center space-x-2 text-xs lg:text-sm text-gray-300">
                  <Icon name='Sparkles' size={14} className="lg:w-4 lg:h-4 text-blue-300" />
                  <span>Guides • Tutorials • Updates</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {[
                  {
                    title: 'Documentation',
                    icon: 'Book',
                    description: 'Comprehensive guides and tutorials to help you get the most out of InterviewAI Pro.',
                    action: () => alert('Documentation coming soon!'),
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
                    className="rounded-2xl border border-gray-800 bg-gray-800/70 p-5 lg:p-6 shadow-inner shadow-black/20 space-y-3 hover:border-blue-400/60 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/40">
                        <Icon name={resource.icon} size={20} className="lg:w-5 lg:h-5" />
                      </div>
                      <h3 className="text-sm lg:text-base font-semibold text-white">{resource.title}</h3>
                    </div>
                    <p className="text-xs lg:text-sm text-gray-300">{resource.description}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resource.action}
                      className="rounded-full border border-gray-700 text-gray-100 hover:border-blue-400 hover:text-white text-xs lg:text-sm"
                    >
                      {resource.label}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        </motion.main>

        <footer className="relative z-10 mt-8 lg:mt-12">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 lg:py-6">
            <div className="text-center text-xs lg:text-sm text-gray-500">
              <p>
                © {new Date().getFullYear()} InterviewAI Pro ·
                <a href="/privacy" className="text-blue-600 hover:underline mx-1">
                  Privacy
                </a>
                ·
                <a href="/terms" className="text-blue-600 hover:underline mx-1">
                  Terms
                </a>
                ·
                <a href="/support" className="text-blue-600 hover:underline mx-1">
                  Support
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Support;

