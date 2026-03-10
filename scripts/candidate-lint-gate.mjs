import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { transform } from 'esbuild';

const filesToCheck = [
  'server/src/routes/referral.routes.js',
  'server/src/routes/application.routes.js',
  'server/src/routes/interview.routes.js',
  'server/src/controllers/referral.controller.js',
  'server/src/controllers/auth.controller.js',
  'server/src/controllers/application.controller.js',
  'server/src/controllers/interview.controller.js',
  'server/src/controllers/review.controller.js',
  'server/src/controllers/gdpr.controller.js',
  'server/src/controllers/objectStorage.controller.js',
  'server/src/middleware/inputValidation.middleware.js',
  'server/src/services/localObjectStorage.service.js',
  'server/src/services/hiringInterviewPlan.service.js',
  'server/src/services/reviewReminderScheduler.service.js',
  'server/src/controllers/__tests__/auth.controller.updateMe.rbac.test.js',
  'server/src/controllers/__tests__/application.controller.offerFlow.test.js',
  'server/src/controllers/__tests__/application.controller.onboardingFlow.test.js',
  'server/src/controllers/__tests__/gdpr.controller.exportData.test.js',
  'server/src/controllers/__tests__/interview.controller.referralHook.test.js',
  'server/src/controllers/__tests__/objectStorage.controller.authorization.test.js',
  'server/src/controllers/__tests__/referral.controller.flow.test.js',
  'server/src/controllers/__tests__/review.controller.rbac.test.js',
  'server/src/routes/__tests__/application.routes.rbac.test.js',
  'server/src/routes/__tests__/analytics.routes.rbac.test.js',
  'server/src/routes/__tests__/gdpr.routes.rbac.test.js',
  'server/src/routes/__tests__/notification.routes.rbac.test.js',
  'server/src/routes/__tests__/objectStorage.routes.rbac.test.js',
  'server/src/routes/__tests__/referral.routes.rbac.test.js',
  'server/src/routes/__tests__/savedAnswer.routes.rbac.test.js',
  'server/src/middleware/__tests__/rbac.middleware.test.js',
  'server/src/services/__tests__/reviewReminderScheduler.service.test.js',
  'src/Routes.jsx',
  'src/components/__tests__/ProtectedRoute.test.jsx',
  'src/pages/register/index.jsx',
  'src/pages/register/__tests__/register.referral.test.jsx',
  'src/pages/candidate-dashboard/__tests__/CandidateDashboard.flow.test.jsx',
  'src/pages/candidate-dashboard/components/__tests__/MyApplicationsList.withdraw.test.jsx',
  'src/pages/application-offer/index.jsx',
  'src/pages/application-offer/__tests__/CandidateOfferPage.test.jsx',
  'src/pages/application-onboarding/index.jsx',
  'src/pages/application-onboarding/__tests__/CandidateOnboardingPage.test.jsx',
  'src/pages/company-offer/index.jsx',
  'src/pages/company-offer/__tests__/CompanyOfferPage.test.jsx',
  'src/pages/company-onboarding/index.jsx',
  'src/pages/company-onboarding/__tests__/CompanyOnboardingPage.test.jsx',
  'src/pages/company-reviews/index.jsx',
  'src/pages/company-reviews/__tests__/CompanyReviewsPage.test.jsx',
  'src/pages/hired-handoff/index.jsx',
  'src/pages/hired-handoff/__tests__/HiredHandoffPage.test.jsx',
  'tests/e2e/candidate-smoke.spec.js',
  'tests/e2e/company-candidate-job-flow.spec.js',
];

const mergeMarkerPattern = /^(<{7}|={7}|>{7})( .+)?$/m;

const getLoader = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jsx') return 'jsx';
  if (extension === '.ts') return 'ts';
  if (extension === '.tsx') return 'tsx';
  return 'js';
};

const run = async () => {
  const failures = [];

  for (const filePath of filesToCheck) {
    try {
      const source = await readFile(filePath, 'utf8');

      if (mergeMarkerPattern.test(source)) {
        failures.push(`${filePath}: contains unresolved merge marker`);
        continue;
      }

      await transform(source, {
        loader: getLoader(filePath),
        format: 'esm',
        sourcemap: false,
        legalComments: 'none',
      });
    } catch (error) {
      failures.push(`${filePath}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    console.error('Candidate lint gate failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Candidate lint gate passed (${filesToCheck.length} files checked).`);
};

run();
