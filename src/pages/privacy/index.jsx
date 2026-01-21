import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import PublicHeader from '../../components/layout/PublicHeader';
import PublicFooter from '../../components/layout/PublicFooter';

const Privacy = () => {
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

  return (
    <>
      <Helmet>
        <title>Privacy Policy - InterviewAI Pro</title>
        <meta name="description" content="InterviewAI Pro Privacy Policy - Learn how we protect and handle your personal information." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 transition-colors duration-300">
        <PublicHeader />

        {/* Spacer for fixed header */}
        <div className="h-14 xs:h-16" />

        {/* Main Content */}
        <motion.main
          variants={sectionReveal}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 xs:px-5 sm:px-6 lg:px-8 py-8 xs:py-10 sm:px-12"
        >
          <motion.div
            variants={sectionReveal}
            className="rounded-2xl xs:rounded-3xl border border-gray-200/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-6 xs:p-8 sm:p-10 shadow-lg dark:shadow-slate-900/50"
          >
            <div className="flex flex-col space-y-2 xs:space-y-3 mb-6 xs:mb-8 text-center">
              <span className="inline-flex items-center justify-center space-x-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 mx-auto">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                <span>Legal</span>
              </span>
              <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100">Privacy Policy</h1>
              <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400">Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div className="prose prose-sm max-w-none space-y-6 text-gray-800 dark:text-slate-200">
              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Welcome to InterviewAI Pro ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered interview preparation platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg xs:text-xl font-medium text-foreground mb-2">2.1 Personal Information</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We collect personal information that you provide directly to us, including:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mt-2">
                      <li>Name and contact information (email address, phone number)</li>
                      <li>Account credentials (username, password)</li>
                      <li>Profile information (job title, industry, experience level)</li>
                      <li>Resume and career history</li>
                      <li>Payment information (processed securely through third-party payment processors)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg xs:text-xl font-medium text-foreground mb-2">2.2 Interview Data</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      When you use our platform, we collect:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mt-2">
                      <li>Video and audio recordings of practice interview sessions</li>
                      <li>Transcripts of your responses</li>
                      <li>Performance analytics and feedback data</li>
                      <li>Interview preferences and settings</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg xs:text-xl font-medium text-foreground mb-2">2.3 Automatically Collected Information</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We automatically collect certain information about your device and how you interact with our platform:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mt-2">
                      <li>Device information (type, operating system, browser)</li>
                      <li>IP address and location data</li>
                      <li>Usage data (pages visited, features used, time spent)</li>
                      <li>Cookies and similar tracking technologies</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We use the information we collect for the following purposes:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process your interview sessions and provide personalized feedback</li>
                  <li>Communicate with you about your account and our services</li>
                  <li>Process payments and prevent fraud</li>
                  <li>Analyze usage patterns and optimize user experience</li>
                  <li>Send marketing communications (with your consent)</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">4. Data Sharing and Disclosure</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We do not sell your personal information. We may share your information in the following circumstances:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Service Providers:</strong> We share data with third-party vendors who help us operate our platform (cloud hosting, payment processing, analytics)</li>
                  <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets</li>
                  <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                  <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">5. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement industry-standard security measures to protect your personal information, including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">6. Your Rights and Choices</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Depending on your location, you may have the following rights:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Access:</strong> Request access to your personal information</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                  <li><strong>Deletion:</strong> Request deletion of your data</li>
                  <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
                  <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                  <li><strong>Objection:</strong> Object to certain processing of your data</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  To exercise these rights, please contact us at privacy@aiinterviewpro.com.
                </p>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">7. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Interview recordings and performance data are retained for 24 months unless you request earlier deletion.
                </p>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">8. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our platform is not intended for users under the age of 16. We do not knowingly collect personal information from children. If we discover that we have collected information from a child, we will delete it immediately.
                </p>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">9. International Data Transfers</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">10. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of significant changes by email or through our platform. Your continued use of our services after changes become effective constitutes acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl xs:text-2xl font-semibold text-foreground mb-4">11. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-muted-foreground">Email: privacy@aiinterviewpro.com</p>
                  <p className="text-muted-foreground">Support: support@aiinterviewpro.com</p>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.main>

        <PublicFooter />
      </div>
    </>
  );
};

export default Privacy;
