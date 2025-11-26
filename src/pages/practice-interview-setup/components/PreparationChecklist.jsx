import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const PreparationChecklist = ({ onChecklistComplete, className = '' }) => {
  const [checkedItems, setCheckedItems] = useState({});
  const [deviceTests, setDeviceTests] = useState({
    camera: null,
    microphone: null,
    speakers: null
  });

  const checklistItems = [
    {
      id: 'quiet-environment',
      title: 'Quiet Environment',
      description: 'Find a quiet space free from distractions and background noise',
      icon: 'Volume2',
      required: true
    },
    {
      id: 'good-lighting',
      title: 'Good Lighting',
      description: 'Ensure your face is well-lit and clearly visible on camera',
      icon: 'Sun',
      required: true
    },
    {
      id: 'stable-internet',
      title: 'Stable Internet Connection',
      description: 'Test your internet speed and ensure stable connectivity',
      icon: 'Wifi',
      required: true
    },
    {
      id: 'resume-ready',
      title: 'Resume Available',
      description: 'Have your resume ready for reference during the interview',
      icon: 'FileText',
      required: false
    },
    {
      id: 'notes-prepared',
      title: 'Notes & Questions',
      description: 'Prepare notes about the company and questions to ask',
      icon: 'BookOpen',
      required: false
    },
    {
      id: 'professional-attire',
      title: 'Professional Appearance',
      description: 'Dress appropriately for the interview setting',
      icon: 'User',
      required: true
    }
  ];

  const handleItemCheck = (itemId, checked) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: checked
    }));
  };

  const testDevice = async (deviceType) => {
    setDeviceTests(prev => ({ ...prev, [deviceType]: 'testing' }));
    
    try {
      if (deviceType === 'camera' || deviceType === 'microphone') {
        const constraints = {
          video: deviceType === 'camera',
          audio: deviceType === 'microphone'
        };
        
        const stream = await navigator.mediaDevices?.getUserMedia(constraints);
        stream?.getTracks()?.forEach(track => track?.stop());
        
        setDeviceTests(prev => ({ ...prev, [deviceType]: 'success' }));
      } else if (deviceType === 'speakers') {
        // Simulate speaker test
        setTimeout(() => {
          setDeviceTests(prev => ({ ...prev, [deviceType]: 'success' }));
        }, 1000);
      }
    } catch (error) {
      setDeviceTests(prev => ({ ...prev, [deviceType]: 'error' }));
    }
  };

  const getDeviceTestIcon = (status) => {
    switch (status) {
      case 'testing': return 'Loader2';
      case 'success': return 'CheckCircle';
      case 'error': return 'XCircle';
      default: return 'Play';
    }
  };

  const getDeviceTestColor = (status) => {
    switch (status) {
      case 'testing': return 'text-primary';
      case 'success': return 'text-success';
      case 'error': return 'text-error';
      default: return 'text-muted-foreground';
    }
  };

  const requiredItems = checklistItems?.filter(item => item?.required);
  const requiredChecked = requiredItems?.filter(item => checkedItems?.[item?.id])?.length;
  const allDevicesTested = Object.values(deviceTests)?.every(status => status === 'success');
  const isComplete = requiredChecked === requiredItems?.length && allDevicesTested;

  useEffect(() => {
    onChecklistComplete(isComplete);
  }, [isComplete, onChecklistComplete]);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="CheckSquare" size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Preparation Checklist</h3>
      </div>
      {/* Device Testing */}
      <div className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%)]" />
        <div className="relative z-10">
          <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Icon name="Settings" size={16} className="text-white" />
            </div>
            <span>Device Testing</span>
          </h4>
        
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl border border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/50">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
                <Icon name="Camera" size={24} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Camera</p>
              <Button
                variant="outline"
                size="sm"
                iconName={getDeviceTestIcon(deviceTests?.camera)}
                iconPosition="left"
                onClick={() => testDevice('camera')}
                disabled={deviceTests?.camera === 'testing'}
                className={`rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 ${getDeviceTestColor(deviceTests?.camera)}`}
              >
                {deviceTests?.camera === 'testing' ? 'Testing...' : 
                 deviceTests?.camera === 'success' ? 'Working' :
                 deviceTests?.camera === 'error' ? 'Failed' : 'Test Camera'}
              </Button>
            </div>

            <div className="text-center p-4 rounded-xl border border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/50">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
                <Icon name="Mic" size={24} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Microphone</p>
              <Button
                variant="outline"
                size="sm"
                iconName={getDeviceTestIcon(deviceTests?.microphone)}
                iconPosition="left"
                onClick={() => testDevice('microphone')}
                disabled={deviceTests?.microphone === 'testing'}
                className={`rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 ${getDeviceTestColor(deviceTests?.microphone)}`}
              >
                {deviceTests?.microphone === 'testing' ? 'Testing...' : 
                 deviceTests?.microphone === 'success' ? 'Working' :
                 deviceTests?.microphone === 'error' ? 'Failed' : 'Test Mic'}
              </Button>
            </div>

            <div className="text-center p-4 rounded-xl border border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/50">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
                <Icon name="Volume2" size={24} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Speakers</p>
              <Button
                variant="outline"
                size="sm"
                iconName={getDeviceTestIcon(deviceTests?.speakers)}
                iconPosition="left"
                onClick={() => testDevice('speakers')}
                disabled={deviceTests?.speakers === 'testing'}
                className={`rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 ${getDeviceTestColor(deviceTests?.speakers)}`}
              >
                {deviceTests?.speakers === 'testing' ? 'Testing...' : 
                 deviceTests?.speakers === 'success' ? 'Working' :
                 deviceTests?.speakers === 'error' ? 'Failed' : 'Test Audio'}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Environment Checklist */}
      <div className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%)]" />
        <div className="relative z-10">
          <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Icon name="Home" size={16} className="text-white" />
            </div>
            <span>Environment Setup</span>
          </h4>
          
          <div className="space-y-3">
            {checklistItems?.map((item) => (
              <div
                key={item?.id}
                className="flex items-start space-x-3 p-4 rounded-xl border border-gray-200 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all duration-200"
              >
                <Checkbox
                  checked={checkedItems?.[item?.id] || false}
                  onChange={(e) => handleItemCheck(item?.id, e?.target?.checked)}
                  className="mt-0.5"
                />
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
                      <Icon name={item?.icon} size={14} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h5 className="font-semibold text-gray-900 dark:text-slate-100">
                      {item?.title}
                      {item?.required && <span className="text-red-600 ml-1">*</span>}
                    </h5>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    {item?.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Progress Summary */}
      <div className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%)]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Preparation Progress
            </span>
            <span className="text-sm font-medium text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-900/70 px-3 py-1 rounded-full">
              {requiredChecked}/{requiredItems?.length} required items
            </span>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-3 mb-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${(requiredChecked / requiredItems?.length) * 100}%` }}
            ></div>
          </div>
          
          {isComplete ? (
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/60">
              <div className="w-6 h-6 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center">
                <Icon name="CheckCircle" size={14} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Ready to start interview!</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/60">
              <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                <Icon name="AlertCircle" size={14} className="text-white" />
              </div>
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Complete all required items to proceed
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreparationChecklist;