import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Mail, PhoneCall, MapPin, Clock, MessageCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

const ContactPage = () => {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  const contactOptions = [
    {
      id: 'email',
      icon: Mail,
      title: 'Email Support',
      description: 'Get help via email',
      actionLabel: 'support@aiinterviewpro.com',
      href: 'mailto:support@aiinterviewpro.com',
      color: 'from-blue-600 to-blue-500'
    },
    {
      id: 'phone',
      icon: PhoneCall,
      title: 'Phone Support',
      description: 'Call us directly',
      actionLabel: '+94 71 121 4592',
      href: 'tel:+94711214592',
      color: 'from-purple-600 to-purple-500'
    },
    {
      id: 'chat',
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Chat with our team',
      actionLabel: 'Start Chat',
      action: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('open-live-chat'));
        }
      },
      color: 'from-emerald-600 to-emerald-500'
    }
  ];

  const officeInfo = [
    {
      icon: Clock,
      title: 'Response Time',
      description: 'We typically respond within 24 hours during business days',
      detail: 'Monday - Friday, 9:00 AM - 6:00 PM IST'
    },
    {
      icon: MapPin,
      title: 'Location',
      description: 'Based in Sri Lanka, serving customers worldwide',
      detail: 'Remote-first team'
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

  const fadeUpChild = {
    hidden: { opacity: 0, transform: 'translateY(20px)' },
    visible: {
      opacity: 1,
      transform: 'translateY(0px)',
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  const handleFieldChange = (field, value) => {
    setContactForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });
    setFieldErrors({});

    try {
      const payload = {
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        subject: contactForm.subject.trim(),
        message: contactForm.message.trim(),
      };
      const result = await apiClient.contact.send(payload);
      setStatus({
        type: 'success',
        message: result?.message || 'Message sent successfully. We will get back to you soon.',
      });
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      if (error?.errors && Array.isArray(error.errors)) {
        const nextErrors = error.errors.reduce((acc, item) => {
          if (item?.param) {
            acc[item.param] = item.msg || 'This field is required.';
          }
          return acc;
        }, {});
        setFieldErrors(nextErrors);
      }
      setStatus({
        type: 'error',
        message: error?.error || error?.message || 'Failed to send message. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Contact Us - InterviewAI Pro</title>
        <meta
          name="description"
          content="Get in touch with InterviewAI Pro. Contact our support team via email, phone, or live chat. We're here to help!"
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
                <Mail className="h-8 w-8 xs:h-9 xs:w-9 lg:h-10 lg:w-10" />
                <div className="absolute inset-0 rounded-3xl border border-white/30" />
              </div>
            </div>
            <div className="space-y-3 xs:space-y-4">
              <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100">
                Get in Touch
              </h1>
              <p className="text-sm xs:text-base sm:text-lg lg:text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Have a question or need assistance? We're here to help! Reach out to us through any of the channels below, and we'll get back to you as soon as possible.
              </p>
              <div className="inline-flex items-center space-x-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 xs:px-4 py-1.5 xs:py-2 text-xs xs:text-sm font-medium text-blue-700 dark:text-blue-300">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span>24/5 support coverage</span>
              </div>
            </div>
          </motion.section>

          {/* Contact Options */}
          <motion.section variants={fadeUpChild}>
            <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100 mb-4 xs:mb-5 sm:mb-6 text-center">
              Choose Your Preferred Method
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-5 sm:gap-6">
              {contactOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <motion.div
                    key={option.id}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-5 xs:p-6 text-center shadow-lg dark:shadow-slate-900/50 transition"
                  >
                    <div className="relative z-10 space-y-4">
                      <div className={`w-12 h-12 xs:w-14 xs:h-14 mx-auto rounded-2xl bg-gradient-to-br ${option.color} flex items-center justify-center text-white shadow-lg shadow-blue-500/30`}>
                        <IconComponent className="h-6 w-6 xs:h-7 xs:w-7" />
                      </div>
                      <div>
                        <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100">{option.title}</h3>
                        <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400 mt-1">{option.description}</p>
                      </div>
                      {option.href ? (
                        <a
                          href={option.href}
                          className="inline-block text-blue-600 dark:text-blue-400 text-xs xs:text-sm font-medium hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                        >
                          {option.actionLabel}
                        </a>
                      ) : option.action ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={option.action}
                          className="rounded-full border border-gray-200 dark:border-slate-600 text-gray-800 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {option.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* Office Information */}
          <motion.section variants={fadeUpChild}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xs:gap-5 sm:gap-6">
              {officeInfo.map((info, index) => {
                const IconComponent = info.icon;
                return (
                  <div
                    key={index}
                    className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-5 xs:p-6 shadow-lg dark:shadow-slate-900/50"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
                        <IconComponent className="h-5 w-5 xs:h-6 xs:w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                          {info.title}
                        </h3>
                        <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-400 mb-1">
                          {info.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-500">
                          {info.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* Contact Form */}
          <motion.section variants={fadeUpChild}>
            <div className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50">
              <div className="relative z-10 space-y-5 xs:space-y-6">
                <div>
                  <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100 mb-2 xs:mb-3">
                    Send us a Message
                  </h2>
                  <p className="text-xs xs:text-sm lg:text-base text-gray-600 dark:text-slate-400">
                    Can't find what you're looking for? Fill out the form below and we'll get back to you within 24 hours.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {status.message && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        status.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-200'
                          : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-200'
                      }`}
                    >
                      {status.message}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Your Name"
                      type="text"
                      placeholder="Enter your name"
                      value={contactForm.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      error={fieldErrors.name}
                      required
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="Enter your email"
                      value={contactForm.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      error={fieldErrors.email}
                      required
                    />
                  </div>
                  <Input
                    label="Subject"
                    type="text"
                    placeholder="What can we help you with?"
                    value={contactForm.subject}
                    onChange={(e) => handleFieldChange('subject', e.target.value)}
                    error={fieldErrors.subject}
                    required
                  />
                  <div>
                    <label className="text-xs lg:text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 block">
                      Message
                    </label>
                    <textarea
                      placeholder="Tell us more about your question or issue..."
                      value={contactForm.message}
                      onChange={(e) => handleFieldChange('message', e.target.value)}
                      rows={5}
                      className="w-full rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      required
                    />
                    {fieldErrors.message && (
                      <p className="text-xs text-destructive mt-2">
                        {fieldErrors.message}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <Button
                      type="submit"
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm lg:text-base font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                    >
                      Send Message
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </motion.section>

          {/* Additional Help Section */}
          <motion.section variants={fadeUpChild}>
            <div className="relative overflow-hidden rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50">
              <div className="relative z-10 text-center space-y-4">
                <h2 className="text-xl xs:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100">
                  Need More Help?
                </h2>
                <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
                  Check out our Help Center for detailed guides, FAQs, and tutorials. You might find the answer you're looking for!
                </p>
                <Button
                  onClick={() => window.location.href = '/help-center'}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm lg:text-base font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                >
                  Visit Help Center
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

export default ContactPage;
