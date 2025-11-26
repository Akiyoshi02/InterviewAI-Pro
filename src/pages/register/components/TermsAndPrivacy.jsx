import React from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';
import Icon from '../../../components/AppIcon';

const TermsAndPrivacy = ({ 
  agreeToTerms, 
  agreeToMarketing, 
  onTermsChange, 
  onMarketingChange, 
  errors, 
  className = '' 
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <Checkbox
          label={
            <span className="text-sm">
              I agree to the{' '}
              <a 
                href="/terms" 
                target="_blank" 
                className="text-primary hover:underline font-medium"
              >
                Terms of Service
              </a>
              {' '}and{' '}
              <a 
                href="/privacy" 
                target="_blank" 
                className="text-primary hover:underline font-medium"
              >
                Privacy Policy
              </a>
            </span>
          }
          checked={agreeToTerms}
          onChange={(e) => onTermsChange(e?.target?.checked)}
          error={errors?.agreeToTerms}
          required
        />

        <Checkbox
          label={
            <span className="text-sm">
              I would like to receive product updates, tips, and special offers via email
            </span>
          }
          description="You can unsubscribe at any time"
          checked={agreeToMarketing}
          onChange={(e) => onMarketingChange(e?.target?.checked)}
        />
      </div>
      {/* Security & Privacy Notice */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon name="Shield" size={16} className="text-success" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-foreground mb-1">
              Your Privacy is Protected
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use industry-standard encryption to protect your data. Your interview recordings 
              and personal information are securely stored and never shared without your consent. 
              You maintain full control over your data and can delete your account at any time.
            </p>
          </div>
        </div>
      </div>
      {/* Key Benefits Reminder */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon name="Sparkles" size={16} color="white" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-foreground mb-2">
              What you get with InterviewAI Pro:
            </h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center space-x-2">
                <Icon name="Check" size={12} className="text-success" />
                <span>Unlimited AI-powered practice interviews</span>
              </li>
              <li className="flex items-center space-x-2">
                <Icon name="Check" size={12} className="text-success" />
                <span>Real-time feedback and performance analytics</span>
              </li>
              <li className="flex items-center space-x-2">
                <Icon name="Check" size={12} className="text-success" />
                <span>Industry-specific interview scenarios</span>
              </li>
              <li className="flex items-center space-x-2">
                <Icon name="Check" size={12} className="text-success" />
                <span>Video recording and playback for self-review</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndPrivacy;