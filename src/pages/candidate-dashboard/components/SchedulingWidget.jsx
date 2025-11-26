import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SchedulingWidget = ({ upcomingInterviews = [] }) => {
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  const mockUpcomingInterviews = [
  {
    id: 1,
    company: 'TechCorp Solutions',
    companyLogo: "https://img.rocket.new/generatedImages/rocket_gen_img_19ef03916-1761928021757.png",
    companyLogoAlt: 'TechCorp Solutions company logo with blue and white geometric design',
    position: 'Senior Software Engineer',
    date: '2025-11-02',
    time: '10:00 AM',
    duration: '60 min',
    type: 'Technical Interview',
    interviewer: 'Sarah Johnson',
    interviewerAvatar: "https://images.unsplash.com/photo-1684262855358-88f296a2cfc2",
    interviewerAvatarAlt: 'Professional headshot of Sarah Johnson, blonde woman in navy blazer smiling',
    status: 'confirmed',
    meetingLink: 'https://meet.techcorp.com/interview-123',
    timeLeft: '2 days'
  },
  {
    id: 2,
    company: 'InnovateLabs',
    companyLogo: "https://img.rocket.new/generatedImages/rocket_gen_img_19eeba3e9-1761928018608.png",
    companyLogoAlt: 'InnovateLabs company logo with green circular design and tech elements',
    position: 'Product Manager',
    date: '2025-11-05',
    time: '2:30 PM',
    duration: '45 min',
    type: 'Behavioral Interview',
    interviewer: 'Michael Chen',
    interviewerAvatar: "https://images.unsplash.com/photo-1687256457585-3608dfa736c5",
    interviewerAvatarAlt: 'Professional headshot of Michael Chen, Asian man with glasses in dark suit',
    status: 'pending',
    timeLeft: '5 days'
  }];


  const interviewData = upcomingInterviews?.length > 0 ? upcomingInterviews : mockUpcomingInterviews;

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
    <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Upcoming Interviews</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Manage your scheduled interviews</p>
        </div>
        <Button
          variant="default"
          size="sm"
          iconName="Plus"
          iconPosition="left"
          onClick={() => setShowScheduleForm(!showScheduleForm)}
          className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
        >
          Schedule
        </Button>
      </div>
      {interviewData?.length > 0 ?
      <div className="space-y-4">
          {interviewData?.map((interview) =>
        <div
          key={interview?.id}
          className="border border-white/30 dark:border-slate-700/50 rounded-2xl p-4 bg-white/70 dark:bg-slate-800/70 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)] transition-all duration-300">

              <div className="flex items-start space-x-4">
                <img
              src={interview?.companyLogo}
              alt={interview?.companyLogoAlt}
              className="w-12 h-12 rounded-lg object-cover" />


                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-slate-100">{interview?.company}</h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400">{interview?.position}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getStatusColor(interview?.status)}`}>
                      {interview?.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm text-gray-600 dark:text-slate-300">
                    <div className="flex items-center space-x-2">
                      <Icon name="Calendar" size={14} className="text-gray-400 dark:text-slate-500" />
                      <span className="text-gray-700 dark:text-slate-200">{interview?.date}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="Clock" size={14} className="text-gray-400 dark:text-slate-500" />
                      <span className="text-gray-700 dark:text-slate-200">{interview?.time} ({interview?.duration})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="User" size={14} className="text-gray-400 dark:text-slate-500" />
                      <span className="text-gray-700 dark:text-slate-200">{interview?.interviewer}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="Tag" size={14} className="text-gray-400 dark:text-slate-500" />
                      <span className="text-gray-700 dark:text-slate-200">{interview?.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className={`text-sm font-medium ${getCountdownColor(interview?.timeLeft)}`}>
                      <Icon name="Timer" size={14} className="inline mr-1" />
                      {interview?.timeLeft} remaining
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                    variant="outline"
                    size="sm"
                    iconName="Calendar"
                    iconPosition="left"
                    className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                        Reschedule
                      </Button>
                      {interview?.status === 'confirmed' &&
                  <Button
                    variant="default"
                    size="sm"
                    iconName="Video"
                    iconPosition="left"
                    onClick={() => window.location.href = '/live-interview-session'}
                    className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
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

      <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 border border-white/50 dark:border-slate-700/60 rounded-full flex items-center justify-center mx-auto mb-4">
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
      <div className="mt-6 pt-4 border-t border-white/30">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            iconName="Calendar"
            iconPosition="left"
            fullWidth
            className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
          >
            View Calendar
          </Button>
          <Button
            variant="ghost"
            iconName="Bell"
            iconPosition="left"
            fullWidth
            className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Reminders
          </Button>
        </div>
      </div>
    </div>);

};

export default SchedulingWidget;