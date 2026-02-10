import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import { 
  Target, Heart, Users, Zap, Award, 
  TrendingUp, Shield, Clock,
  Twitter, Linkedin, Github, Globe
} from 'lucide-react';
import Button from '../../components/ui/Button';

const AboutPage = () => {
  const navigate = useNavigate();
  const values = [
    {
      icon: Target,
      title: 'Mission-Driven',
      description: 'Democratizing access to quality interview preparation and fair hiring practices through AI technology.'
    },
    {
      icon: Heart,
      title: 'Candidate-First',
      description: 'We believe in empowering every job seeker with the tools and confidence they need to succeed.'
    },
    {
      icon: Shield,
      title: 'Fair & Unbiased',
      description: 'Committed to eliminating bias in hiring through objective, data-driven assessment methods.'
    },
    {
      icon: Zap,
      title: 'Innovation',
      description: 'Continuously improving our AI technology to provide the most realistic and valuable interview experience.'
    }
  ];

  const team = [
    {
      name: 'Akiyoshi Yapa',
      role: 'Founder & Lead Developer',
      imageSrc: '/assets/images/founder.jpg',
      description: 'Full-stack developer passionate about using AI to solve real-world problems in recruitment.',
      socialLinks: [
        { icon: Twitter, href: 'https://x.com/akiyapax', label: 'X' },
        { icon: Linkedin, href: 'https://www.linkedin.com/in/akiyoshi-yapa/', label: 'LinkedIn' },
        { icon: Github, href: 'https://github.com/Akiyoshi02', label: 'GitHub' },
        { icon: Globe, href: 'https://akiyoshiyapa.netlify.app', label: 'Portfolio' }
      ]
    }
  ];

  const milestones = [
    { year: '2024', title: 'Project Inception', description: 'Started building InterviewAI Pro' },
    { year: '2025', title: 'Platform Launch', description: 'Launched beta version for Sri Lankan market' },
    { year: '2026', title: 'Expanding Features', description: 'Adding advanced analytics and company features' }
  ];

  const stats = [
    { icon: Users, value: '50K+', label: 'Interviews Conducted' },
    { icon: TrendingUp, value: '95%', label: 'Success Rate' },
    { icon: Award, value: '100%', label: 'Bias-Free' },
    { icon: Clock, value: '75%', label: 'Faster Hiring' }
  ];

  return (
    <>
      <Helmet>
        <title>About Us - InterviewAI Pro</title>
        <meta name="description" content="Learn about InterviewAI Pro's mission to democratize interview preparation and fair hiring through AI technology." />
      </Helmet>
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
            <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              Building the Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Fair Interviews</span>
            </h1>
            <p className="text-base xs:text-lg sm:text-xl text-gray-600 dark:text-slate-300 mb-8 xs:mb-10">
              We're on a mission to make quality interview preparation accessible to everyone 
              and help companies hire based on merit, not bias.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 xs:gap-6 sm:gap-8 mt-12 xs:mt-16"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="bg-white dark:bg-slate-800 rounded-xl xs:rounded-2xl p-4 xs:p-6 shadow-lg dark:shadow-slate-900/50 text-center"
                >
                  <Icon className="h-6 w-6 xs:h-8 xs:w-8 text-blue-600 mx-auto mb-2 xs:mb-3" />
                  <div className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs xs:text-sm text-gray-600 dark:text-slate-400">
                    {stat.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-12 xs:py-16 sm:py-20 bg-gray-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center mb-12 xs:mb-16"
          >
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              Our Story
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 leading-relaxed">
              InterviewAI Pro was born from a simple observation: interviews are stressful for candidates 
              and time-consuming for companies. We saw an opportunity to leverage AI technology to create 
              a platform that helps candidates practice and improve while enabling companies to conduct 
              fair, efficient, and bias-free assessments.
            </p>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 leading-relaxed mt-4">
              Built with a focus on the Sri Lankan market, we understand the unique challenges faced by 
              local job seekers and companies. Our platform is designed to bridge the gap between talent 
              and opportunity through intelligent, accessible technology.
            </p>
          </motion.div>

          {/* Milestones */}
          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-gradient-to-b from-blue-600 to-purple-600 hidden md:block" />
            <div className="space-y-8 xs:space-y-12">
              {milestones.map((milestone, index) => {
                const isReversed = index % 2 === 0;

                return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`flex flex-col md:flex-row items-center gap-4 xs:gap-6 ${
                    isReversed ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  <div className={`flex-1 text-center ${isReversed ? 'md:text-left' : 'md:text-right'}`}>
                    <div className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm xs:text-base font-bold mb-2">
                      {milestone.year}
                    </div>
                    <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                      {milestone.title}
                    </h3>
                    <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400">
                      {milestone.description}
                    </p>
                  </div>
                  <div className="hidden md:block w-12 h-12 bg-white dark:bg-slate-800 border-4 border-blue-600 rounded-full shadow-lg flex-shrink-0" />
                  <div className="flex-1" />
                </motion.div>
              );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
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
              Our Core Values
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              These principles guide everything we do, from product development to customer support.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xs:gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50 hover:shadow-xl transition"
                >
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-12 h-12 xs:w-14 xs:h-14 rounded-xl flex items-center justify-center mb-4 xs:mb-6">
                    <Icon className="h-6 w-6 xs:h-7 xs:w-7 text-white" />
                  </div>
                  <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-slate-100 mb-2 xs:mb-3">
                    {value.title}
                  </h3>
                  <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 leading-relaxed">
                    {value.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
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
              Meet the Team
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Dedicated to building tools that make a real difference in people's careers.
            </p>
          </motion.div>

          <div className="flex justify-center">
            {team.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg dark:shadow-slate-900/50 hover:shadow-xl transition max-w-md"
              >
                <div className="flex justify-center mb-4">
                  <img
                    src={member.imageSrc}
                    alt={member.name}
                    className="h-40 w-40 xs:h-48 xs:w-48 rounded-full object-cover border-2 border-blue-600/40"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-xl xs:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 text-center">
                  {member.name}
                </h3>
                <p className="text-sm xs:text-base text-blue-600 dark:text-blue-400 font-semibold mb-4 text-center">
                  {member.role}
                </p>
                <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 text-center leading-relaxed">
                  {member.description}
                </p>

                {/* Social Links */}
                {member.socialLinks && (
                  <div className="flex justify-center gap-3 mt-6">
                    {member.socialLinks.map((social, idx) => {
                      const Icon = social.icon;
                      return (
                        <a
                          key={idx}
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition"
                          aria-label={social.label}
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
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
              Ready to Get Started?
            </h2>
            <p className="text-base xs:text-lg text-blue-100 mb-8 xs:mb-10 max-w-2xl mx-auto">
              Join thousands of candidates building confidence and companies discovering top talent.
            </p>
            <div className="flex flex-col xs:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/register?type=candidate')}
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-full font-semibold text-base xs:text-lg shadow-lg min-h-touch"
              >
                For Candidates
              </Button>
              <Button
                onClick={() => navigate('/register?type=company')}
                className="bg-blue-800 text-white hover:bg-blue-900 px-8 py-4 rounded-full font-semibold text-base xs:text-lg shadow-lg min-h-touch"
              >
                For Companies
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

        <PublicFooter />
      </div>
    </>
  );
};

export default AboutPage;
