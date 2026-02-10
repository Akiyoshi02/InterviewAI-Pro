import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import { 
  Activity, CheckCircle, AlertCircle, Clock, 
  Server, Database, Zap, Shield
} from 'lucide-react';
import Button from '../../components/ui/Button';

const StatusPage = () => {
  const navigate = useNavigate();
  const systemStatus = 'operational'; // operational, degraded, outage

  const services = [
    {
      name: 'API Server',
      icon: Server,
      status: 'operational',
      uptime: '99.98%',
      latency: '45ms'
    },
    {
      name: 'Database',
      icon: Database,
      status: 'operational',
      uptime: '99.99%',
      latency: '12ms'
    },
    {
      name: 'AI Interview Engine',
      icon: Zap,
      status: 'operational',
      uptime: '99.95%',
      latency: '230ms'
    },
    {
      name: 'Authentication',
      icon: Shield,
      status: 'operational',
      uptime: '100%',
      latency: '35ms'
    }
  ];

  const metrics = [
    {
      label: 'Overall Uptime',
      value: '99.9%',
      period: 'Last 90 days'
    },
    {
      label: 'Avg Response Time',
      value: '78ms',
      period: 'Last 24 hours'
    },
    {
      label: 'Incidents',
      value: '0',
      period: 'Last 30 days'
    }
  ];

  const incidents = [
    {
      date: 'January 10, 2026',
      title: 'Scheduled Maintenance',
      status: 'Resolved',
      duration: '30 minutes',
      description: 'Routine database maintenance completed successfully.'
    },
    {
      date: 'December 28, 2025',
      title: 'API Performance Degradation',
      status: 'Resolved',
      duration: '15 minutes',
      description: 'Brief performance issue due to high traffic. Resolved by scaling infrastructure.'
    }
  ];


  const getStatusColor = (status) => {
    switch (status) {
      case 'operational':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'degraded':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'outage':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational':
        return CheckCircle;
      case 'degraded':
      case 'outage':
        return AlertCircle;
      default:
        return Activity;
    }
  };

  return (
    <>
      <Helmet>
        <title>System Status - InterviewAI Pro</title>
        <meta name="description" content="Check the current operational status and uptime of InterviewAI Pro services." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950">
        <PublicHeader />

      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 xs:py-16 sm:py-20 md:py-24 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-blue-500/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 ${getStatusColor(systemStatus)}`}>
              {React.createElement(getStatusIcon(systemStatus), { className: "h-4 w-4" })}
              <span className="capitalize">All Systems {systemStatus}</span>
            </div>
            <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              System <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">Status</span>
            </h1>
            <p className="text-base xs:text-lg sm:text-xl text-gray-600 dark:text-slate-300 mb-8 xs:mb-10">
              Real-time status and uptime monitoring for all InterviewAI Pro services.
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <Clock className="h-4 w-4" />
              Last updated: {new Date().toLocaleString('en-GB')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Metrics */}
      <section className="py-12 xs:py-16 sm:py-20 bg-gray-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 xs:gap-8">
            {metrics.map((metric, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50 text-center"
              >
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">{metric.label}</p>
                <p className="text-4xl xs:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                  {metric.value}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{metric.period}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Status */}
      <section className="py-12 xs:py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 xs:mb-16"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
              Service Status
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Monitor the health and performance of all our services in real-time.
            </p>
          </motion.div>

          <div className="space-y-4 max-w-4xl mx-auto">
            {services.map((service, index) => {
              const Icon = service.icon;
              const StatusIcon = getStatusIcon(service.status);
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg dark:shadow-slate-900/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                          {service.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusIcon className={`h-4 w-4 ${service.status === 'operational' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                          <span className={`text-sm font-medium capitalize ${service.status === 'operational' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {service.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-slate-400">Uptime</p>
                        <p className="font-semibold text-gray-900 dark:text-slate-100">{service.uptime}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-slate-400">Latency</p>
                        <p className="font-semibold text-gray-900 dark:text-slate-100">{service.latency}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Incident History */}
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
              Incident History
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Past incidents and their resolutions.
            </p>
          </motion.div>

          <div className="space-y-6 max-w-4xl mx-auto">
            {incidents.map((incident, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg dark:shadow-slate-900/50"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-medium">
                        {incident.status}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-slate-400">
                        {incident.date}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                      {incident.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {incident.description}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap">
                    Duration: {incident.duration}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscribe to Updates */}
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
              Stay Informed
            </h2>
            <p className="text-base xs:text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              Subscribe to get notified about service updates, maintenance, and incidents.
            </p>
            <Button
              onClick={() => navigate('/')}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-full font-semibold text-lg shadow-lg min-h-touch"
            >
              Subscribe to Updates
            </Button>
          </motion.div>
        </div>
      </section>

        <PublicFooter />
      </div>
    </>
  );
};

export default StatusPage;
