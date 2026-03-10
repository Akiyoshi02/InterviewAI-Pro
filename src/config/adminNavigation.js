const ADMIN_SECTION_DEFINITIONS = [
  {
    id: 'approvals',
    title: 'Organization Approvals',
    description: 'Review and process pending organization verification requests.',
    navLabel: 'Pending Approvals',
    navDescription: 'Review pending organizations',
    fullLabel: 'Pending Approvals',
    mobileLabel: 'Approvals',
    icon: 'CheckCircle',
  },
  {
    id: 'organizations',
    title: 'All Organizations',
    description: 'View all organizations and manage lifecycle status.',
    navLabel: 'All Organizations',
    navDescription: 'Manage organization lifecycle',
    fullLabel: 'All Organizations',
    mobileLabel: 'Orgs',
    icon: 'Building',
  },
  {
    id: 'users',
    title: 'User Management',
    description: 'Manage user access, role elevation, and account status.',
    navLabel: 'Users',
    navDescription: 'Manage users and admin promotions',
    fullLabel: 'User Management',
    mobileLabel: 'Users',
    icon: 'Users',
  },
  {
    id: 'operations',
    title: 'Platform Operations',
    description: 'Monitor billing, data retention, and operational health.',
    navLabel: 'Operations',
    navDescription: 'Billing, retention, and newsletters',
    fullLabel: 'Platform Operations',
    mobileLabel: 'Ops',
    icon: 'Wallet',
  },
  {
    id: 'fairness',
    title: 'Fairness and Calibration',
    description: 'Inspect fairness quality and calibration outcomes.',
    navLabel: 'Fairness',
    navDescription: 'Calibration and fairness checks',
    fullLabel: 'Fairness',
    mobileLabel: 'Fairness',
    icon: 'Scale',
  },
  {
    id: 'templates',
    title: 'Templates',
    description: 'Manage structured interview templates, defaults, and adoption.',
    navLabel: 'Templates',
    navDescription: 'Structured template defaults and adoption',
    fullLabel: 'Structured Templates',
    mobileLabel: 'Templates',
    icon: 'ListChecks',
  },
  {
    id: 'classification',
    title: 'Classification Metrics',
    description: 'Confusion matrix and precision/recall/F1 for AI vs SME score classification.',
    navLabel: 'Classification Metrics',
    navDescription: 'Confusion matrix and precision/recall',
    fullLabel: 'Classification Metrics',
    mobileLabel: 'Metrics',
    icon: 'Grid3X3',
  },
  {
    id: 'fine-tuning',
    title: 'Model Fine-Tuning',
    description: 'Train and evaluate domain-specialized LLM from collected interview data.',
    navLabel: 'Model Fine-Tuning',
    navDescription: 'Train LLM from interview data',
    fullLabel: 'Model Fine-Tuning',
    mobileLabel: 'Models',
    icon: 'Cpu',
  },
  {
    id: 'mediapipe-calibration',
    title: 'MediaPipe Calibration',
    description: 'Compare static posture/face thresholds against data-driven calibrated values.',
    navLabel: 'MediaPipe Calibration',
    navDescription: 'Posture and face threshold calibration',
    fullLabel: 'MediaPipe Calibration',
    mobileLabel: 'MediaPipe',
    icon: 'ScanFace',
  },
  {
    id: 'training-data',
    title: 'Training Data Governance',
    description: 'Manage datasets for evaluation and model training workflows.',
    navLabel: 'Training Data',
    navDescription: 'Inspect and export datasets',
    fullLabel: 'Training Data',
    mobileLabel: 'Training',
    icon: 'Database',
  },
  {
    id: 'question-catalog',
    title: 'Question Catalog',
    description: 'Curate approved dataset questions and import vetted sources.',
    navLabel: 'Question Catalog',
    navDescription: 'Import and curate approved question pools',
    fullLabel: 'Question Catalog',
    mobileLabel: 'Questions',
    icon: 'BookOpenCheck',
  },
  {
    id: 'research-tools',
    title: 'Research Tools',
    description: 'Record posture/gestures and analyze videos for calibration.',
    navLabel: 'Research Tools',
    navDescription: 'Record posture and analyze videos',
    fullLabel: 'Research Tools',
    mobileLabel: 'Research',
    icon: 'FlaskConical',
  },
  {
    id: 'live-chat',
    title: 'Live Chat',
    description: 'Monitor and respond to visitor conversations from admin console.',
    navLabel: 'Live Chat',
    navDescription: 'Respond to user support chats',
    fullLabel: 'Live Chat',
    mobileLabel: 'Chat',
    icon: 'MessageSquare',
  },
  {
    id: 'settings',
    title: 'System Settings',
    description: 'Update global maintenance and platform settings.',
    navLabel: 'System Settings',
    navDescription: 'Maintenance and platform flags',
    fullLabel: 'System Settings',
    mobileLabel: 'Settings',
    icon: 'Settings',
  },
  {
    id: 'audit',
    title: 'Audit Logs',
    description: 'Track system-level actions and administrative events.',
    navLabel: 'Audit Logs',
    navDescription: 'Trace administrative events',
    fullLabel: 'Audit Logs',
    mobileLabel: 'Audit',
    icon: 'FileText',
  },
];

export { ADMIN_SECTION_DEFINITIONS };

export const ADMIN_SECTION_MAP = ADMIN_SECTION_DEFINITIONS.reduce((acc, section) => {
  acc[section.id] = section;
  return acc;
}, {});

export const ADMIN_SECTION_ALIASES = Object.freeze({
  'structured-interviews': 'templates',
});

export const getAdminSectionPath = (sectionId) => {
  if (!sectionId || sectionId === 'overview') return '/system-admin-dashboard';
  return `/system-admin-dashboard/${sectionId}`;
};

const buildAdminSectionNavItem = (sectionId, overrides = {}) => {
  const section = ADMIN_SECTION_MAP[sectionId];

  if (!section) {
    throw new Error(`Unknown admin section: ${sectionId}`);
  }

  return {
    key: section.id,
    label: section.navLabel || section.title,
    fullLabel: section.fullLabel || section.navLabel || section.title,
    mobileLabel: section.mobileLabel || section.navLabel || section.title,
    path: getAdminSectionPath(section.id),
    icon: section.icon,
    description: section.navDescription || section.description,
    ...overrides,
  };
};

export const ADMIN_NAV_ITEMS = [
  {
    key: 'overview',
    label: 'Overview',
    fullLabel: 'Admin Overview',
    mobileLabel: 'Overview',
    path: getAdminSectionPath('overview'),
    exact: true,
    icon: 'LayoutDashboard',
    description: 'Platform stats and quick actions',
  },
  {
    key: 'organizations',
    label: 'Organizations',
    fullLabel: 'Organizations',
    mobileLabel: 'Orgs',
    icon: 'Building2',
    description: 'Approvals and organization controls',
    items: [
      buildAdminSectionNavItem('approvals'),
      buildAdminSectionNavItem('organizations'),
    ],
  },
  buildAdminSectionNavItem('users'),
  buildAdminSectionNavItem('operations'),
  {
    key: 'governance',
    label: 'Governance',
    fullLabel: 'Governance',
    mobileLabel: 'Policy',
    icon: 'Scale',
    description: 'Policy, templates, fairness, and auditing',
    items: [
      buildAdminSectionNavItem('templates'),
      buildAdminSectionNavItem('fairness'),
      buildAdminSectionNavItem('settings'),
      buildAdminSectionNavItem('audit'),
    ],
  },
  {
    key: 'data-research',
    label: 'Data & AI',
    fullLabel: 'Data & AI',
    mobileLabel: 'Data',
    icon: 'Database',
    description: 'Datasets, models, and research tools',
    items: [
      buildAdminSectionNavItem('training-data'),
      buildAdminSectionNavItem('question-catalog'),
      buildAdminSectionNavItem('classification'),
      buildAdminSectionNavItem('fine-tuning'),
      buildAdminSectionNavItem('mediapipe-calibration'),
      buildAdminSectionNavItem('research-tools'),
    ],
  },
  buildAdminSectionNavItem('live-chat'),
];
