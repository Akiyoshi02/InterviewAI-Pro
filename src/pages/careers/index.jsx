import React from 'react';
import { motion } from 'framer-motion';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';
import { 
  Briefcase, MapPin, Clock, DollarSign, Users, Heart, 
  Zap, Trophy, Coffee, Laptop, Send, Award
} from 'lucide-react';
import Button from '../../components/ui/Button';

const CareersPage = () => {
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

  const openings = [
    {
      title: 'Senior Full-Stack Developer',
      department: 'Engineering',
      location: 'Remote (Sri Lanka)',
      type: 'Full-time',
      salary: 'LKR 200K - 350K/month',
      description: 'Help build the future of AI-powered interviews. Work with React, Node.js, Firebase, and cutting-edge AI technologies.',
      requirements: [
        '3+ years experience with React and Node.js',
        'Experience with Firebase/Firestore',
        'Strong understanding of RESTful APIs',
        'Passion for clean code and best practices'
      ]
    },
    {
      title: 'AI/ML Engineer',
      department: 'AI Research',
      location: 'Remote (Sri Lanka)',
      type: 'Full-time',
      salary: 'LKR 250K - 400K/month',
      description: 'Enhance our AI interview models. Work with natural language processing, speech recognition, and evaluation algorithms.',
      requirements: [
        'Strong background in ML/AI',
        'Experience with NLP and speech recognition',
        'Python expertise (TensorFlow/PyTorch)',
        'Research mindset and problem-solving skills'
      ]
    },
    {
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote (Sri Lanka)',
      type: 'Full-time',
      salary: 'LKR 150K - 250K/month',
      description: 'Create beautiful, intuitive experiences for candidates and companies. Shape the visual identity of our platform.',
      requirements: [
        '2+ years of product design experience',
        'Proficiency in Figma or similar tools',
        'Strong portfolio demonstrating UX/UI skills',
        'Understanding of design systems'
      ]
    },
    {
      title: 'Growth Marketing Lead',
      department: 'Marketing',
      location: 'Remote (Sri Lanka)',
      type: 'Full-time',
      salary: 'LKR 120K - 200K/month',
      description: 'Drive user acquisition and engagement. Build marketing strategies to reach candidates and companies across Sri Lanka.',
      requirements: [
        '3+ years in growth marketing or digital marketing',
        'Experience with SEO, content marketing, and social media',
        'Data-driven approach to marketing',
        'Excellent communication skills'
      ]
    }
  ];

  const benefits = [
    {
      icon: Laptop,
      title: 'Remote-First',
      description: 'Work from anywhere in Sri Lanka. Flexible hours that fit your lifestyle.'
    },
    {
      icon: Users,
      title: 'Small Team',
      description: 'Your work has immediate impact. No bureaucracy, just building great products.'
    },
    {
      icon: Zap,
      title: 'Latest Tech',
      description: 'Work with cutting-edge AI, React, Firebase, and modern development tools.'
    },
    {
      icon: Trophy,
      title: 'Growth',
      description: 'Learn constantly. Attend conferences, take courses, and develop your skills.'
    },
    {
      icon: Heart,
      title: 'Meaningful Work',
      description: 'Help people land their dream jobs and companies find amazing talent.'
    },
    {
      icon: Coffee,
      title: 'Work-Life Balance',
      description: 'Take time off when you need it. We believe in sustainable productivity.'
    }
  ];

  const values = [
    'Bias-free and inclusive hiring',
    'Transparent communication',
    'Continuous learning and improvement',
    'User-centric product development',
    'Data-driven decision making',
    'Sustainable and ethical growth'
  ];

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
              <Briefcase className="h-4 w-4" />
              <span>Join Our Team</span>
            </div>
            <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-slate-100 mb-4 xs:mb-6">
              Build the Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">AI Interviews</span>
            </h1>
            <p className="text-base xs:text-lg sm:text-xl text-gray-600 dark:text-slate-300 mb-8 xs:mb-10">
              Join a passionate team building tools that help candidates succeed and companies hire better. 
              Work remotely, grow constantly, and make real impact.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
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
              Why Work With Us
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              We offer more than just a job—we offer an opportunity to grow, learn, and make a difference.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xs:gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
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
                    {benefit.title}
                  </h3>
                  <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 leading-relaxed">
                    {benefit.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Positions */}
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
              Open Positions
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Find your perfect role. All positions are remote-first within Sri Lanka.
            </p>
          </motion.div>

          <div className="space-y-6 xs:space-y-8">
            {openings.map((job, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 xs:p-8 shadow-lg dark:shadow-slate-900/50 hover:shadow-xl transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl xs:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-slate-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        {job.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {job.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {job.salary}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => window.location.href = `mailto:akiyoshiyapa@gmail.com?subject=Application for ${job.title}&body=Hi, I'm interested in the ${job.title} position.`}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full font-semibold shadow-md hover:from-blue-700 hover:to-purple-700 flex items-center gap-2 min-h-touch whitespace-nowrap"
                  >
                    <Send className="h-4 w-4" />
                    Apply Now
                  </Button>
                </div>

                <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 mb-4">
                  {job.description}
                </p>

                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Requirements:</p>
                  <ul className="list-disc list-inside text-sm text-gray-600 dark:text-slate-400 space-y-1">
                    {job.requirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>

          {/* No perfect match CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-12 xs:mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 xs:p-12 text-center"
          >
            <h3 className="text-2xl xs:text-3xl font-bold text-white mb-4">
              Don't See the Perfect Role?
            </h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              We're always looking for talented people. Send us your resume and tell us how you can contribute!
            </p>
            <Button
              onClick={() => window.location.href = 'mailto:akiyoshiyapa@gmail.com?subject=General Application&body=Hi, I am interested in working with InterviewAI Pro.'}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-full font-semibold shadow-lg min-h-touch"
            >
              Get in Touch
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Our Values Section */}
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
              Our Values
            </h2>
            <p className="text-base xs:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              These principles guide how we work, make decisions, and treat each other.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-6">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md dark:shadow-slate-900/50 flex items-center gap-4"
              >
                <div className="flex-shrink-0 w-2 h-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full" />
                <p className="text-sm xs:text-base text-gray-700 dark:text-slate-300 font-medium">
                  {value}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default CareersPage;
