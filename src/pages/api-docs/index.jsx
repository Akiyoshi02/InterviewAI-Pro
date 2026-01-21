import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import { 
  Code, Book, Key, Zap, Shield, CheckCircle, Copy, ExternalLink
} from 'lucide-react';
import Button from '../../components/ui/Button';

const APIDocsPage = () => {
  const [copied, setCopied] = useState('');

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

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

  const features = [
    {
      icon: Shield,
      title: 'Secure Authentication',
      description: 'JWT-based authentication with Firebase integration'
    },
    {
      icon: Zap,
      title: 'Fast & Reliable',
      description: '99.9% uptime with low latency responses'
    },
    {
      icon: Code,
      title: 'RESTful Design',
      description: 'Clean, predictable API following REST principles'
    }
  ];

  const endpoints = [
    {
      category: 'Authentication',
      endpoints: [
        {
          method: 'POST',
          path: '/api/auth/register',
          description: 'Register a new user account',
          auth: false
        },
        {
          method: 'POST',
          path: '/api/auth/login',
          description: 'Login with email and password',
          auth: false
        },
        {
          method: 'GET',
          path: '/api/auth/me',
          description: 'Get current user profile',
          auth: true
        }
      ]
    },
    {
      category: 'Interviews',
      endpoints: [
        {
          method: 'POST',
          path: '/api/interviews',
          description: 'Create a new interview session',
          auth: true
        },
        {
          method: 'GET',
          path: '/api/interviews/:id',
          description: 'Get interview details',
          auth: true
        },
        {
          method: 'GET',
          path: '/api/interviews',
          description: 'List all interviews',
          auth: true
        }
      ]
    },
    {
      category: 'Jobs',
      endpoints: [
        {
          method: 'POST',
          path: '/api/jobs',
          description: 'Create a job posting',
          auth: true
        },
        {
          method: 'GET',
          path: '/api/jobs',
          description: 'List job postings',
          auth: false
        },
        {
          method: 'GET',
          path: '/api/jobs/:id',
          description: 'Get job details',
          auth: false
        }
      ]
    },
    {
      category: 'Analytics',
      endpoints: [
        {
          method: 'GET',
          path: '/api/analytics/dashboard-metrics',
          description: 'Get dashboard metrics with comparison',
          auth: true
        },
        {
          method: 'GET',
          path: '/api/analytics/historical',
          description: 'Get historical analytics snapshots',
          auth: true
        }
      ]
    }
  ];

  const exampleRequest = `curl -X POST https://api.interviewai.pro/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'`;

  const exampleResponse = `{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "accountType": "candidate",
    "fullName": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`;

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
              <Book className="h-4 w-4" />
              <span>API Documentation</span>
            </div>
            <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              Build with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">InterviewAI Pro API</span>
            </h1>
            <p className="text-base xs:text-lg sm:text-xl text-gray-600 dark:text-slate-300 mb-8 xs:mb-10">
              Integrate our AI-powered interview platform into your applications with our comprehensive REST API.
            </p>
            <div className="flex flex-col xs:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-full font-semibold shadow-lg flex items-center gap-2 justify-center min-h-touch"
              >
                <Key className="h-5 w-5" />
                Get API Key
              </Button>
              <Button
                variant="outline"
                className="border-2 border-gray-300 dark:border-slate-600 px-8 py-4 rounded-full font-semibold flex items-center gap-2 justify-center min-h-touch"
              >
                <ExternalLink className="h-5 w-5" />
                View Examples
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 xs:py-16 sm:py-20 bg-gray-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 xs:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50 text-center"
                >
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-12 xs:py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-8 text-center">
              Quick Start
            </h2>

            {/* Example Request */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Example Request</h3>
                <button
                  onClick={() => copyToClipboard(exampleRequest, 'request')}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                >
                  {copied === 'request' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === 'request' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-900 dark:bg-slate-950 text-green-400 p-4 rounded-xl overflow-x-auto text-xs xs:text-sm">
                <code>{exampleRequest}</code>
              </pre>
            </div>

            {/* Example Response */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Example Response</h3>
                <button
                  onClick={() => copyToClipboard(exampleResponse, 'response')}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                >
                  {copied === 'response' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === 'response' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-900 dark:bg-slate-950 text-blue-400 p-4 rounded-xl overflow-x-auto text-xs xs:text-sm">
                <code>{exampleResponse}</code>
              </pre>
            </div>
          </motion.div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="py-12 xs:py-16 sm:py-20 bg-gray-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 xs:mb-16"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
              API Endpoints
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Complete reference of all available endpoints.
            </p>
          </motion.div>

          <div className="space-y-8 xs:space-y-12 max-w-5xl mx-auto">
            {endpoints.map((category, catIndex) => (
              <motion.div
                key={catIndex}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: catIndex * 0.1 }}
              >
                <h3 className="text-xl xs:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                  {category.category}
                </h3>
                <div className="space-y-3">
                  {category.endpoints.map((endpoint, epIndex) => (
                    <div
                      key={epIndex}
                      className="bg-white dark:bg-slate-800 rounded-xl p-4 xs:p-6 shadow-md dark:shadow-slate-900/50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          endpoint.method === 'GET' 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : endpoint.method === 'POST'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : endpoint.method === 'PUT'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {endpoint.method}
                        </span>
                        <code className="text-sm font-mono text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded">
                          {endpoint.path}
                        </code>
                        {endpoint.auth && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Key className="h-3 w-3" />
                            Auth Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        {endpoint.description}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 xs:py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl xs:rounded-3xl p-8 xs:p-12 sm:p-16 text-center"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Start Building?
            </h2>
            <p className="text-base xs:text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              Create your account to get your API key and start integrating InterviewAI Pro.
            </p>
            <Button
              onClick={() => navigate('/register')}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-full font-semibold text-lg shadow-lg min-h-touch"
            >
              Get Started Free
            </Button>
          </motion.div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default APIDocsPage;
