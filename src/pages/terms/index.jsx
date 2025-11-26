import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/AppIcon';
import BrandMark from '../../components/BrandMark';
import Button from '../../components/ui/Button';

const Terms = () => {
  const navigate = useNavigate();

  const sectionReveal = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  return (
    <>
      <Helmet>
        <title>Terms of Service - InterviewAI Pro</title>
        <meta name="description" content="InterviewAI Pro Terms of Service - Read our terms and conditions for using our platform." />
      </Helmet>
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden transition-colors duration-300">
        <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_5%_0%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_95%_0%,rgba(147,51,234,0.12),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.12),transparent_45%)]" />
        {/* Header */}
        <header className="relative z-10 border-b border-white/20 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <BrandMark showTagline={false} className="items-center" iconWrapperClassName="w-9 h-9" textClassName="text-lg" />
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="rounded-full border border-white/40 dark:border-slate-700/50 text-gray-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 text-sm"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <motion.main
          variants={sectionReveal}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10"
        >
          <motion.div
            variants={sectionReveal}
            className="rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-8 sm:p-10 shadow-[0_30px_80px_rgba(15,23,42,0.15)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur"
          >
            <div className="flex flex-col space-y-2 mb-8 text-center">
              <span className="inline-flex items-center justify-center space-x-2 rounded-full bg-blue-600/10 dark:bg-blue-900/30 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                <span>Legal</span>
              </span>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Terms of Service</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div className="prose prose-sm max-w-none space-y-6 text-gray-800 dark:text-slate-200">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Agreement to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using InterviewAI Pro ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service. These Terms apply to all users, including visitors, registered users, and contributors of content.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">2. Use License</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Permission is granted to temporarily access the materials on InterviewAI Pro for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Modify or copy the materials</li>
                  <li>Use the materials for any commercial purpose or for any public display</li>
                  <li>Attempt to reverse engineer any software contained on InterviewAI Pro</li>
                  <li>Remove any copyright or other proprietary notations from the materials</li>
                  <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">3. User Accounts</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-2">3.1 Account Creation</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      To access certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-2">3.2 Account Security</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-2">3.3 Account Termination</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We reserve the right to suspend or terminate your account at any time for violations of these Terms or for any other reason at our sole discretion.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">4. Acceptable Use</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You agree not to use the Service:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>In any way that violates any applicable national or international law or regulation</li>
                  <li>To transmit, or procure the sending of, any advertising or promotional material without our prior written consent</li>
                  <li>To impersonate or attempt to impersonate the company, a company employee, another user, or any other person or entity</li>
                  <li>In any way that infringes upon the rights of others, or in any way is illegal, threatening, fraudulent, or harmful</li>
                  <li>To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the Service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">5. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service and its original content, features, and functionality are owned by InterviewAI Pro and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">6. User Content</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You retain ownership of any content you submit, post, or display on or through the Service ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your User Content for the purpose of operating and improving the Service.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  You are solely responsible for your User Content and represent and warrant that you have all rights necessary to grant the license described above.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">7. Payment and Billing</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-2">7.1 Subscription Fees</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Some features of the Service may require payment of fees. You agree to pay all applicable fees as described on the Service. All fees are non-refundable except as required by law.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-2">7.2 Automatic Renewal</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      If you purchase a subscription, it will automatically renew unless you cancel it before the renewal date. You will be charged the then-current subscription fee at the time of renewal.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">8. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We make no warranties, expressed or implied, and hereby disclaim all warranties including, without limitation, implied warranties of merchantability, fitness for a particular purpose, or non-infringement of intellectual property.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">9. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  In no event shall InterviewAI Pro, its directors, employees, or agents be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">10. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to defend, indemnify, and hold harmless InterviewAI Pro and its licensee and licensors, and their employees, contractors, agents, officers and directors, from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including attorney's fees).
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">11. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">12. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed and construed in accordance with applicable laws, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">13. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <div className="bg-muted/50 p-4 rounded-lg mt-4">
                  <p className="text-foreground font-medium mb-2">InterviewAI Pro Legal Team</p>
                  <p className="text-muted-foreground">Email: legal@aiinterviewpro.com</p>
                  <p className="text-muted-foreground">Support: support@aiinterviewpro.com</p>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/30 bg-white/70 backdrop-blur mt-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-xs text-gray-500">
              <p>
                © {new Date().getFullYear()} InterviewAI Pro. All rights reserved.
                {' '}
                <a href="/privacy" className="text-primary hover:underline">Privacy</a>
                {' • '}
                <a href="/terms" className="text-primary hover:underline">Terms</a>
                {' • '}
                <a href="/support" className="text-primary hover:underline">Support</a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Terms;

