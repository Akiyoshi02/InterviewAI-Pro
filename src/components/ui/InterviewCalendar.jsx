import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_COLORS = {
  PENDING: 'bg-indigo-400',
  SCHEDULED: 'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-red-400',
  default: 'bg-gray-400',
};

const getStatusColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.default;

const toDateKey = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const InterviewCalendar = ({ interviews = [], onViewInterview, userType = 'company' }) => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // month | week

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Map interviews to date keys
  const interviewsByDate = useMemo(() => {
    const map = {};
    interviews.forEach((iv) => {
      const dateStr = iv.scheduledFor || iv.createdAt;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const key = toDateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(iv);
    });
    return map;
  }, [interviews]);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const goToToday = () => { setCurrentMonth(new Date()); setSelectedDate(toDateKey(new Date())); };

  const selectedInterviews = selectedDate ? (interviewsByDate[selectedDate] || []) : [];
  const todayKey = toDateKey(new Date());

  // Build calendar grid
  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg overflow-hidden">
      {/* Calendar Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="Calendar" size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {MONTH_NAMES[month]} {year}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Icon name="ChevronLeft" size={16} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Day name headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-slate-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700">
          {calendarDays.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="bg-white/60 dark:bg-slate-800/60 h-14 sm:h-16" />;
            }
            const dateObj = new Date(year, month, day);
            const key = toDateKey(dateObj);
            const dayInterviews = interviewsByDate[key] || [];
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const isPast = dateObj < new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(isSelected ? null : key)}
                className={`relative bg-white dark:bg-slate-800 h-14 sm:h-16 p-1 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500' : ''
                } ${isPast ? 'opacity-60' : ''}`}
              >
                <span className={`text-xs font-medium inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isToday
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-slate-300'
                }`}>
                  {day}
                </span>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {dayInterviews.slice(0, 3).map((iv, i) => (
                    <span
                      key={iv.id || i}
                      className={`h-1.5 w-1.5 rounded-full ${getStatusColor(iv.status)}`}
                      title={iv.jobRole || 'Interview'}
                    />
                  ))}
                  {dayInterviews.length > 3 && (
                    <span className="text-[8px] text-gray-400">+{dayInterviews.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'default').map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              <span className="text-xs text-gray-500 dark:text-slate-400 capitalize">{status.toLowerCase().replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Day Detail */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100 dark:border-slate-700"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600">
                  <Icon name="X" size={14} />
                </button>
              </div>
              {selectedInterviews.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-3">No interviews scheduled for this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedInterviews.map((iv) => (
                    <button
                      key={iv.id}
                      onClick={() => onViewInterview ? onViewInterview(iv) : null}
                      className="w-full text-left p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {iv.jobRole || 'Interview'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            {formatTime(iv.scheduledFor)}
                            {iv.duration ? ` · ${iv.duration}min` : ''}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(iv.status)}`}>
                          {(iv.status || 'unknown').toLowerCase().replace('_', ' ')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InterviewCalendar;
