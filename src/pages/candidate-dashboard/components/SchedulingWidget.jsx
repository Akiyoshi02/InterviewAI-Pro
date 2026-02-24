import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient';

const SchedulingWidget = ({ upcomingInterviews = [], onScheduleSaved }) => {
  const navigate = useNavigate();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selectedInterviewId, setSelectedInterviewId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [meetingLink, setMeetingLink] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Transform real interview data into the display format
  const transformInterviews = (interviews) => {
    if (!Array.isArray(interviews)) return [];
    
    // Filter for scheduled/upcoming interviews and transform
    return interviews
      .filter(interview => {
        const status = interview?.status?.toUpperCase();
        return status === 'SCHEDULED';
      })
      .map(interview => {
        const companyName = interview?.company?.companyName || 
                           interview?.company?.fullName || 
                           interview?.company?.displayName ||
                           (typeof interview?.company === 'string' ? interview.company : null) ||
                           'Interview Session';
        const companyLogo = interview?.company?.logo || interview?.company?.logoUrl || null;
        const scheduledDate = interview?.scheduledFor ? new Date(interview.scheduledFor) : null;
        const scheduledTimestamp = scheduledDate && !Number.isNaN(scheduledDate.getTime())
          ? scheduledDate.getTime()
          : 0;
        
        // Calculate time left
        let timeLeft = '';
        if (scheduledDate) {
          const now = new Date();
          const diffMs = scheduledDate - now;
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays <= 0) {
            timeLeft = 'Today';
          } else if (diffDays === 1) {
            timeLeft = '1 day';
          } else {
            timeLeft = `${diffDays} days`;
          }
        }
        
        return {
          id: interview?.id,
          company: companyName,
          companyLogo: companyLogo,
          companyLogoAlt: `${companyName} logo`,
          position: interview?.jobRole || interview?.position || 'Interview',
          date: scheduledDate ? scheduledDate.toLocaleDateString() : 'TBD',
          time: scheduledDate ? scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'TBD',
          duration: interview?.duration || '45 min',
          type: interview?.interviewType || interview?.type || 'Interview',
          interviewer: interview?.interviewer?.name || interview?.interviewerName || null,
          interviewerAvatar: interview?.interviewer?.avatar || null,
          status: interview?.status?.toLowerCase() === 'scheduled' ? 'confirmed' : 'pending',
          meetingLink: interview?.meetingLink || null,
          timeLeft,
          scheduledForRaw: interview?.scheduledFor || null,
          scheduledTimestamp,
        };
      })
      .sort((a, b) => {
        // Sort by datetime, earliest first
        const dateA = a?.scheduledTimestamp || Number.MAX_SAFE_INTEGER;
        const dateB = b?.scheduledTimestamp || Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      });
  };

  // Use transformed real data - no mock fallback
  const interviewData = transformInterviews(upcomingInterviews);
  const hasScheduledInterviews = interviewData.length > 0;

  const getStatusColor = (status) => {
    const colorMap = {
      confirmed: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/90 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/30',
      pending: 'text-purple-600 dark:text-purple-400 bg-purple-50/90 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/30',
      cancelled: 'text-rose-600 dark:text-rose-400 bg-rose-50/90 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/30'
    };
    return (
      colorMap?.[status] ||
      'text-gray-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 border-white/30 dark:border-slate-700/60'
    );
  };

  const getCountdownColor = (timeLeft) => {
    if (!timeLeft || timeLeft === 'Today') return 'text-rose-500 dark:text-rose-400';
    const days = parseInt(timeLeft, 10);
    if (Number.isNaN(days) || days <= 1) return 'text-rose-500 dark:text-rose-400';
    if (days <= 3) return 'text-purple-600 dark:text-purple-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const toDateTimeLocal = (isoValue) => {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const resetScheduleForm = () => {
    setSelectedInterviewId('');
    setScheduledFor('');
    setMeetingLink('');
    setScheduleError('');
  };

  const openScheduleFormFor = (interview = null) => {
    const target = interview || interviewData?.[0] || null;
    if (!target) {
      navigate('/my-applications');
      return;
    }
    setSelectedInterviewId(target.id || '');
    setScheduledFor(toDateTimeLocal(target?.scheduledForRaw));
    setMeetingLink(target?.meetingLink || '');
    setShowScheduleForm(true);
  };

  const handleScheduleSubmit = async () => {
    try {
      setScheduleError('');
      if (!selectedInterviewId) {
        setScheduleError('Select an interview first.');
        return;
      }
      if (!scheduledFor) {
        setScheduleError('Select date and time.');
        return;
      }
      const payload = {
        scheduledFor: new Date(scheduledFor).toISOString(),
        timezone,
        meetingLink: meetingLink?.trim() ? meetingLink.trim() : null,
      };
      const current = interviewData.find((item) => item.id === selectedInterviewId);
      setSavingSchedule(true);
      if (current?.scheduledForRaw) {
        await apiClient.interviews.reschedule(selectedInterviewId, payload);
      } else {
        await apiClient.interviews.schedule(selectedInterviewId, payload);
      }
      setShowScheduleForm(false);
      resetScheduleForm();
      if (typeof onScheduleSaved === 'function') {
        await onScheduleSaved();
      }
    } catch (error) {
      setScheduleError(error?.message || 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleViewCalendar = () => {
    if (!hasScheduledInterviews) {
      navigate('/my-applications');
      return;
    }
    const withMeetingLink = interviewData.find((item) => item?.meetingLink);
    if (withMeetingLink?.meetingLink) {
      window.open(withMeetingLink.meetingLink, '_blank', 'noopener,noreferrer');
      return;
    }
    if (interviewData?.[0]?.id) {
      navigate(`/live-interview-session?interviewId=${encodeURIComponent(interviewData[0].id)}`);
    }
  };

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Upcoming Interviews</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Manage your scheduled interviews</p>
        </div>
        <Button
          variant="default"
          size="sm"
          iconName={hasScheduledInterviews ? 'Plus' : 'Briefcase'}
          iconPosition="left"
          onClick={() => openScheduleFormFor()}
          className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 w-full xs:w-auto"
        >
          {hasScheduledInterviews ? 'Schedule' : 'My Applications'}
        </Button>
      </div>
      {showScheduleForm && (
        <div className="mb-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={selectedInterviewId}
              onChange={(event) => setSelectedInterviewId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">Select interview</option>
              {interviewData.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.company} - {item.position}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Timezone (IANA)"
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
            <input
              type="url"
              value={meetingLink}
              onChange={(event) => setMeetingLink(event.target.value)}
              placeholder="Meeting link (optional)"
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          {scheduleError && <p className="text-xs text-rose-600 dark:text-rose-400">{scheduleError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowScheduleForm(false);
                resetScheduleForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleScheduleSubmit}
              disabled={savingSchedule}
              className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white"
            >
              {savingSchedule ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </div>
      )}
      {interviewData?.length > 0 ?
      <div className="space-y-3">
          {interviewData?.map((interview) =>
        <div
          key={interview?.id}
          className="border border-white/30 dark:border-slate-700/50 rounded-xl p-2.5 sm:p-3 bg-white/70 dark:bg-slate-800/70 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200">

              <div className="flex items-start space-x-2.5 sm:space-x-3">
                {interview?.companyLogo ? (
                  <img
                    src={interview.companyLogo}
                    alt={interview?.companyLogoAlt}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex-shrink-0 items-center justify-center ${interview?.companyLogo ? 'hidden' : 'flex'}`}
                >
                  <Icon name="Building2" size={18} color="white" />
                </div>


                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-slate-100 text-sm sm:text-base truncate">{interview?.company}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate">{interview?.position}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${getStatusColor(interview?.status)}`}>
                      {interview?.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-1.5 xs:gap-2 mb-2 text-xs text-gray-600 dark:text-slate-300">
                    <div className="flex items-center space-x-2">
                      <Icon name="Calendar" size={14} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-slate-200 truncate">{interview?.date}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="Clock" size={14} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-slate-200 truncate">{interview?.time} ({interview?.duration})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="User" size={14} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-slate-200 truncate">{interview?.interviewer}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="Tag" size={14} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-slate-200 truncate">{interview?.type}</span>
                    </div>
                  </div>

                  <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 xs:gap-0">
                    <div className={`text-xs sm:text-sm font-medium ${getCountdownColor(interview?.timeLeft)}`}>
                      <Icon name="Timer" size={14} className="inline mr-1" />
                      {interview?.timeLeft} remaining
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                    variant="outline"
                    size="sm"
                    iconName="Calendar"
                    iconPosition="left"
                    onClick={() => openScheduleFormFor(interview)}
                    className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 text-xs sm:text-sm flex-1 xs:flex-none"
                  >
                        Reschedule
                      </Button>
                      {interview?.status === 'confirmed' &&
                  <Button
                    variant="default"
                    size="sm"
                    iconName="Video"
                    iconPosition="left"
                    onClick={() => navigate(`/live-interview-session?interviewId=${encodeURIComponent(interview.id)}`)}
                    className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 text-xs sm:text-sm flex-1 xs:flex-none"
                  >
                          Join
                        </Button>
                  }
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}
        </div> :

      <div className="text-center py-5">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 border border-white/50 dark:border-slate-700/60 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icon name="Calendar" size={24} className="text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">No Upcoming Interviews</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            You do not have any scheduled interviews yet. Keep momentum with practice while your applications progress.
          </p>
          <div className="flex flex-col xs:flex-row justify-center gap-2">
            <Button
              variant="outline"
              iconName="Briefcase"
              iconPosition="left"
              onClick={() => navigate('/my-applications')}
              className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
            >
              View Applications
            </Button>
            <Button
              variant="default"
              iconName="Play"
              iconPosition="left"
              onClick={() => navigate('/practice-interview-setup')}
              className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
            >
              Start Practice
            </Button>
          </div>
        </div>
      }
      {/* Quick Actions */}
      <div className="mt-4 pt-3 border-t border-white/30">
        <Button
          variant="outline"
          iconName="Calendar"
          iconPosition="left"
          onClick={handleViewCalendar}
          fullWidth
          className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
        >
          {hasScheduledInterviews ? 'View Calendar' : 'Open My Applications'}
        </Button>
      </div>
    </div>);

};

export default SchedulingWidget;
