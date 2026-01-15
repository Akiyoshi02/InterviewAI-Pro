import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SchedulingWidget = ({ upcomingInterviews = [] }) => {
  const navigate = useNavigate();
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Transform real interview data into the display format
  const transformInterviews = (interviews) => {
    if (!Array.isArray(interviews)) return [];
    
    // Filter for scheduled/upcoming interviews and transform
    return interviews
      .filter(interview => {
        const status = interview?.status?.toUpperCase();
        return status === 'SCHEDULED' || status === 'PENDING';
      })
      .map(interview => {
        const companyName = interview?.company?.companyName || 
                           interview?.company?.fullName || 
                           interview?.company?.displayName ||
                           (typeof interview?.company === 'string' ? interview.company : null) ||
                           'Interview Session';
        const companyLogo = interview?.company?.logo || interview?.company?.logoUrl || null;
        const scheduledDate = interview?.scheduledFor ? new Date(interview.scheduledFor) : null;
        
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
          time: scheduledDate ? scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'TBD',
          duration: interview?.duration || '45 min',
          type: interview?.interviewType || interview?.type || 'Interview',
          interviewer: interview?.interviewer?.name || interview?.interviewerName || null,
          interviewerAvatar: interview?.interviewer?.avatar || null,
          status: interview?.status?.toLowerCase() === 'scheduled' ? 'confirmed' : 'pending',
          meetingLink: interview?.meetingLink || null,
          timeLeft
        };
      })
      .sort((a, b) => {
        // Sort by date, earliest first
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      });
  };

  // Use transformed real data - no mock fallback
  const interviewData = transformInterviews(upcomingInterviews);

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
    const days = parseInt(timeLeft);
    if (days <= 1) return 'text-rose-500 dark:text-rose-400';
    if (days <= 3) return 'text-purple-600 dark:text-purple-400';
    return 'text-emerald-600 dark:text-emerald-400';
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
          iconName="Plus"
          iconPosition="left"
          onClick={() => setShowScheduleForm(!showScheduleForm)}
          className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 w-full xs:w-auto"
        >
          Schedule
        </Button>
      </div>
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
                    onClick={() => navigate('/live-interview-session')}
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
            Schedule your first interview or practice with AI
          </p>
          <Button
          variant="default"
          iconName="Plus"
          iconPosition="left"
          onClick={() => setShowScheduleForm(true)}
          className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
        >
            Schedule Interview
          </Button>
        </div>
      }
      {/* Quick Actions */}
      <div className="mt-4 pt-3 border-t border-white/30">
        <Button
          variant="outline"
          iconName="Calendar"
          iconPosition="left"
          fullWidth
          className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
        >
          View Calendar
        </Button>
      </div>
    </div>);

};

export default SchedulingWidget;
