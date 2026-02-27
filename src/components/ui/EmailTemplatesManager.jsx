import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';

const PRESET_TEMPLATES = [
  {
    id: 'invite-interview',
    name: 'Interview Invitation',
    subject: 'Interview Invitation – {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

We are pleased to invite you to interview for the {{jobTitle}} position at {{companyName}}.

Interview Details:
- Date & Time: {{interviewDate}}
- Duration: {{duration}} minutes
- Format: {{interviewType}}

Please confirm your availability by replying to this email or using the link below.

We look forward to speaking with you.

Best regards,
{{recruiterName}}
{{companyName}}`,
  },
  {
    id: 'shortlist',
    name: 'Shortlisted Notification',
    subject: 'Great News – You Have Been Shortlisted for {{jobTitle}}',
    body: `Dear {{candidateName}},

Congratulations! After reviewing your application for the {{jobTitle}} role at {{companyName}}, we are delighted to inform you that you have been shortlisted.

Next Steps:
Our team will be in touch shortly to arrange the next stage of the selection process.

Thank you for your interest in joining {{companyName}}.

Best regards,
{{recruiterName}}
{{companyName}}`,
  },
  {
    id: 'rejection',
    name: 'Application Update (Not Selected)',
    subject: 'Your Application for {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

Thank you for taking the time to apply for the {{jobTitle}} position at {{companyName}} and for your interest in our organisation.

After careful consideration, we regret to inform you that we will not be moving forward with your application at this time. This was a difficult decision given the strong pool of candidates.

We encourage you to apply for future opportunities that match your skills and experience.

We wish you all the best in your search.

Best regards,
{{recruiterName}}
{{companyName}}`,
  },
  {
    id: 'offer',
    name: 'Job Offer',
    subject: 'Job Offer – {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

We are thrilled to extend an offer of employment for the {{jobTitle}} position at {{companyName}}.

Offer Details:
- Position: {{jobTitle}}
- Start Date: {{startDate}}
- Reporting to: {{manager}}

Please review the attached offer letter and let us know your decision by {{responseDeadline}}.

We look forward to welcoming you to the team!

Best regards,
{{recruiterName}}
{{companyName}}`,
  },
  {
    id: 'follow-up',
    name: 'Follow-up / Check-in',
    subject: 'Following Up – {{jobTitle}} Application',
    body: `Dear {{candidateName}},

I hope you are well. I am writing to follow up regarding your application for the {{jobTitle}} position at {{companyName}}.

We are still in the process of reviewing candidates and appreciate your patience. We will be in touch with an update shortly.

Thank you again for your interest.

Best regards,
{{recruiterName}}
{{companyName}}`,
  },
];

const TEMPLATE_VARIABLES = [
  '{{candidateName}}', '{{jobTitle}}', '{{companyName}}', '{{interviewDate}}',
  '{{duration}}', '{{interviewType}}', '{{recruiterName}}', '{{startDate}}',
  '{{manager}}', '{{responseDeadline}}',
];

const EmailTemplatesManager = ({ onSendEmail, candidate = null }) => {
  const [templates, setTemplates] = useState(PRESET_TEMPLATES.map((t) => ({ ...t, isPreset: true })));
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(candidate?.email || '');
  const [variables, setVariables] = useState({
    candidateName: candidate?.fullName || candidate?.email || '',
    jobTitle: '',
    companyName: '',
    recruiterName: '',
    interviewDate: '',
    duration: '45',
    interviewType: 'Video',
    startDate: '',
    manager: '',
    responseDeadline: '',
  });

  const interpolate = (text) => {
    let result = text;
    Object.entries(variables).forEach(([key, val]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), val || `[${key}]`);
    });
    return result;
  };

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setShowCompose(true);
  };

  const handleSend = async () => {
    if (!recipientEmail || !selectedTemplate) return;
    setSending(true);
    try {
      if (onSendEmail) {
        await onSendEmail({
          to: recipientEmail,
          subject: interpolate(selectedTemplate.subject),
          body: interpolate(selectedTemplate.body),
          templateId: selectedTemplate.id,
        });
      }
      setSendSuccess(true);
      setTimeout(() => { setSendSuccess(false); setShowCompose(false); setSelectedTemplate(null); }, 2500);
    } finally {
      setSending(false);
    }
  };

  const handleSaveCustomTemplate = () => {
    if (!editForm.name || !editForm.subject || !editForm.body) return;
    const newTemplate = { id: `custom-${Date.now()}`, ...editForm, isPreset: false };
    setTemplates((prev) => [...prev, newTemplate]);
    setEditForm({ name: '', subject: '', body: '' });
    setEditing(false);
  };

  const handleDeleteCustom = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  };

  const insertVariable = (variable) => {
    setEditForm((prev) => ({ ...prev, body: prev.body + ' ' + variable }));
  };

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Mail" size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Email Templates</h2>
        </div>
        <Button
          size="sm"
          variant="ghost"
          iconName="Plus"
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          New Template
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {/* Template List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleSelectTemplate(tpl)}
              className={`text-left p-3 rounded-xl border transition-all ${
                selectedTemplate?.id === tpl.id
                  ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-gray-100 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-xs font-medium text-gray-900 dark:text-slate-100">{tpl.name}</p>
                {!tpl.isPreset && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustom(tpl.id); }}
                    className="text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Icon name="Trash2" size={12} />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{tpl.subject}</p>
            </button>
          ))}
        </div>

        {/* New Template Editor */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-blue-200 dark:border-blue-700/50 rounded-xl p-4 bg-blue-50/30 dark:bg-blue-900/10 space-y-3"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Create Custom Template</h3>
              <input
                type="text"
                placeholder="Template name"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Subject line"
                value={editForm.subject}
                onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5">Insert variable:</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 text-xs text-gray-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Email body..."
                  value={editForm.body}
                  onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
                <Button size="sm" variant="primary" onClick={handleSaveCustomTemplate} className="flex-1">Save Template</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose & Send */}
        <AnimatePresence>
          {showCompose && selectedTemplate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Compose: {selectedTemplate.name}
                </h3>
                <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600">
                  <Icon name="X" size={14} />
                </button>
              </div>

              {/* Variables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(variables).map(([key, val]) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5 capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => setVariables((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="candidate@email.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Preview</p>
                <div className="rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 p-3 text-xs text-gray-700 dark:text-slate-300">
                  <p className="font-semibold mb-1">Subject: {interpolate(selectedTemplate.subject)}</p>
                  <pre className="whitespace-pre-wrap font-sans">{interpolate(selectedTemplate.body)}</pre>
                </div>
              </div>

              {sendSuccess ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                  <Icon name="CheckCircle" size={16} />
                  Email sent successfully!
                </div>
              ) : (
                <Button
                  variant="primary"
                  className="w-full"
                  iconName="Send"
                  loading={sending}
                  onClick={handleSend}
                  disabled={!recipientEmail}
                >
                  Send Email
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EmailTemplatesManager;
