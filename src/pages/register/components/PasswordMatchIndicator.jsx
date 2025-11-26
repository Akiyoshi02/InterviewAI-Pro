import React from 'react';
import Icon from '../../../components/AppIcon';

const PasswordMatchIndicator = ({ password, confirmPassword, className = '' }) => {
  const getMatchStatus = () => {
    if (!confirmPassword) {
      return { matches: false, label: '', color: '', bgColor: '', icon: 'Circle' };
    }
    
    const matches = password === confirmPassword;
    
    if (matches) {
      return {
        matches: true,
        label: 'Passwords Match',
        color: 'text-success',
        bgColor: 'bg-success',
        icon: 'CheckCircle'
      };
    } else {
      return {
        matches: false,
        label: 'Passwords Do Not Match',
        color: 'text-error',
        bgColor: 'bg-error',
        icon: 'XCircle'
      };
    }
  };

  const status = getMatchStatus();

  if (!confirmPassword) return null;

  return (
    <div className={`${className}`}>
      {/* Match Status */}
      <div className="flex items-center space-x-2">
        <Icon
          name={status?.icon}
          size={16}
          className={status?.matches ? 'text-success' : 'text-error'}
        />
        <span className={`text-xs ${status?.color}`}>
          {status?.matches 
            ? 'Passwords match' 
            : 'Passwords do not match'}
        </span>
      </div>
    </div>
  );
};

export default PasswordMatchIndicator;

