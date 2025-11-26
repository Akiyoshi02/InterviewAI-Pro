import React from 'react';
import Icon from '../../../components/AppIcon';

const PasswordStrengthIndicator = ({ password, className = '' }) => {
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    
    let score = 0;
    const checks = {
      length: pwd?.length >= 8,
      lowercase: /[a-z]/?.test(pwd),
      uppercase: /[A-Z]/?.test(pwd),
      number: /\d/?.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/?.test(pwd)
    };
    
    score = Object.values(checks)?.filter(Boolean)?.length;
    
    const strengthLevels = {
      0: { label: '', color: '', bgColor: '' },
      1: { label: 'Very Weak', color: 'text-error', bgColor: 'bg-error' },
      2: { label: 'Weak', color: 'text-warning', bgColor: 'bg-warning' },
      3: { label: 'Fair', color: 'text-accent', bgColor: 'bg-accent' },
      4: { label: 'Good', color: 'text-success', bgColor: 'bg-success' },
      5: { label: 'Strong', color: 'text-success', bgColor: 'bg-success' }
    };
    
    return { score, checks, ...strengthLevels?.[score] };
  };

  const strength = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Password Strength</span>
          <span className={`text-sm font-medium ${strength?.color}`}>
            {strength?.label}
          </span>
        </div>
        
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5]?.map((level) => (
            <div
              key={level}
              className={`h-2 flex-1 rounded-full transition-colors duration-200 ${
                level <= strength?.score ? strength?.bgColor : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
      {/* Requirements Checklist */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">Requirements:</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { key: 'length', label: 'At least 8 characters' },
            { key: 'lowercase', label: 'Lowercase letter' },
            { key: 'uppercase', label: 'Uppercase letter' },
            { key: 'number', label: 'Number' },
            { key: 'special', label: 'Special character' }
          ]?.map((requirement) => (
            <div
              key={requirement?.key}
              className="flex items-center space-x-2"
            >
              <Icon
                name={strength?.checks?.[requirement?.key] ? "CheckCircle" : "Circle"}
                size={16}
                className={strength?.checks?.[requirement?.key] ? 'text-success' : 'text-muted-foreground'}
              />
              <span className={`text-xs ${
                strength?.checks?.[requirement?.key] ? 'text-success' : 'text-muted-foreground'
              }`}>
                {requirement?.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;