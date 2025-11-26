import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/AppIcon';
import BrandMark from '../../components/BrandMark';
import Button from '../../components/ui/Button';

const Privacy = () => {
  const navigate = useNavigate();

  const sectionReveal = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  return (
    <>
      <Helmet>
        <title>Privacy Policy - InterviewAI Pro</title>
        <meta name="description" content="InterviewAI Pro Privacy Policy - Learn how we protect and handle your personal information." />
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Privacy Policy</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div className="prose prose-sm max-w-none space-y-6 text-gray-800 dark:text-slate-200">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Welcome to InterviewAI Pro ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered interview preparation platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-2">2.1 Personal Information</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We collect personal information that you provide directly to us, including:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mt-2">
                      <li>Name and contact information (email address, phone number)</li>
                      <li>Account credentials (username, password)</li>
                      <li>Profile information (job title, industry, experience level)</li>
                      <li>Payment information (processed securely through third-party providers)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-2">2.2 Usage Data</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We automatically collect information about how you interact with our platform, including:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mt-2">
                      <li>Interview session recordings and transcripts</li>
                      <li>Performance analytics and assessment results</li>
                      <li>Device information and browser type</li>
                      <li>IP address and location data</li>
                      <li>Usage patterns and feature interactions</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We use the collected information for the following purposes:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>To provide and maintain our interview preparation services</li>
                  <li>To analyze interview performance and provide personalized feedback</li>
                  <li>To improve our AI algorithms and platform functionality</li>
                  <li>To communicate with you about your account and our services</li>
                  <li>To send promotional materials and updates (with your consent)</li>
                  <li>To detect, prevent, and address technical issues and security threats</li>
                  <li>To comply with legal obligations and enforce our terms of service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">4. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement industry-standard security measures to protect your personal information, including encryption, secure socket layer (SSL) technology, and regular security audits. However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">5. Data Sharing and Disclosure</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We do not sell your personal information. We may share your information only in the following circumstances:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Service Providers:</strong> With trusted third-party service providers who assist us in operating our platform</li>
                  <li><strong>Legal Requirements:</strong> When required by law, court order, or government regulation</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                  <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">6. Your Rights and Choices</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You have the right to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Access and receive a copy of your personal data</li>
                  <li>Rectify inaccurate or incomplete information</li>
                  <li>Request deletion of your personal data</li>
                  <li>Object to or restrict certain processing activities</li>
                  <li>Data portability (receive your data in a structured format)</li>
                  <li>Withdraw consent for processing based on consent</li>
                  <li>Opt-out of marketing communications</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">7. Cookies and Tracking Technologies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use cookies and similar tracking technologies to enhance your experience, analyze usage patterns, and improve our services. You can control cookie preferences through your browser settings. However, disabling cookies may limit certain features of our platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">8. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">9. International Data Transfers</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">10. Changes to This Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">11. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:
                </p>
                <div className="bg-muted/50 p-4 rounded-lg mt-4">
                  <p className="text-foreground font-medium mb-2">InterviewAI Pro Privacy Team</p>
                  <p className="text-muted-foreground">Email: privacy@aiinterviewpro.com</p>
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

export default Privacy;

