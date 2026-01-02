import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RecommendedTopics = ({ recommendations = [] }) => {
  const mockRecommendations = [
    {
      id: 1,
      title: 'System Design Fundamentals',
      description: 'Based on your recent performance, focus on scalability concepts',
      difficulty: 'Advanced',
      estimatedTime: '45 min',
      category: 'Technical',
      priority: 'high',
      completionRate: 23,
      icon: 'Cpu'
    },
    {
      id: 2,
      title: 'Behavioral Interview Techniques',
      description: 'Improve your STAR method responses for leadership questions',
      difficulty: 'Intermediate',
      estimatedTime: '30 min',
      category: 'Soft Skills',
      priority: 'medium',
      completionRate: 67,
      icon: 'Users'
    },
    {
      id: 3,
      title: 'Data Structures & Algorithms',
      description: 'Strengthen your coding interview preparation',
      difficulty: 'Advanced',
      estimatedTime: '60 min',
      category: 'Technical',
      priority: 'high',
      completionRate: 45,
      icon: 'Code'
    },
    {
      id: 4,
      title: 'Product Strategy Questions',
      description: 'Practice product management case studies and frameworks',
      difficulty: 'Intermediate',
      estimatedTime: '40 min',
      category: 'Domain Specific',
      priority: 'medium',
      completionRate: 12,
      icon: 'Target'
    },
    {
      id: 5,
      title: 'Communication Skills',
      description: 'Enhance clarity and confidence in your responses',
      difficulty: 'Beginner',
      estimatedTime: '25 min',
      category: 'Soft Skills',
      priority: 'low',
      completionRate: 89,
      icon: 'MessageCircle'
    }
  ];

  const topicData = recommendations?.length > 0 ? recommendations : mockRecommendations;

  const getPriorityColor = (priority) => {
    const colorMap = {
      high: 'text-rose-500 dark:text-rose-400',
      medium: 'text-purple-500 dark:text-purple-400',
      low: 'text-emerald-600 dark:text-emerald-400'
    };
    return colorMap?.[priority] || 'text-gray-500 dark:text-slate-400';
  };

  const getPriorityBg = (priority) => {
    const bgMap = {
      high: 'border-rose-100 dark:border-rose-500/40 bg-gradient-to-r from-rose-50 to-white dark:from-rose-900/30 dark:to-slate-900/40',
      medium: 'border-purple-100 dark:border-purple-500/40 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/30 dark:to-slate-900/40',
      low: 'border-emerald-100 dark:border-emerald-500/40 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/30 dark:to-slate-900/40'
    };
    return bgMap?.[priority] || 'border-white/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/50';
  };

  const getDifficultyColor = (difficulty) => {
    const colorMap = {
      'Beginner': 'text-emerald-600 dark:text-emerald-400',
      'Intermediate': 'text-purple-600 dark:text-purple-400',
      'Advanced': 'text-rose-600 dark:text-rose-400'
    };
    return colorMap?.[difficulty] || 'text-gray-500 dark:text-slate-400';
  };

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 sm:mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Recommended Topics</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">AI-powered suggestions based on your performance</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconName="RefreshCw"
          className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          Refresh
        </Button>
      </div>
      <div className="space-y-2.5">
        {topicData?.slice(0, 4)?.map((topic) => (
          <div
            key={topic?.id}
            className={`rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] cursor-pointer backdrop-blur ${getPriorityBg(topic?.priority)}`}
          >
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 text-white shadow-md shadow-blue-500/25">
                <Icon name={topic?.icon} size={16} color="white" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-slate-100">{topic?.title}</h3>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full bg-white/60 dark:bg-slate-900/60 border border-white/40 dark:border-slate-700/60 ${getPriorityColor(topic?.priority)}`}>
                    {topic?.priority?.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                  {topic?.description}
                </p>

                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 xs:gap-3 text-xs text-gray-500 dark:text-slate-400">
                    <span className={getDifficultyColor(topic?.difficulty)}>
                      {topic?.difficulty}
                    </span>
                    <span className="flex items-center space-x-1">
                      <Icon name="Clock" size={12} className="text-current flex-shrink-0" />
                      <span>{topic?.estimatedTime}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Icon name="Tag" size={12} className="text-current flex-shrink-0" />
                      <span className="truncate">{topic?.category}</span>
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    iconName="ArrowRight"
                    iconPosition="right"
                    className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 flex-shrink-0 w-full xs:w-auto"
                  >
                    Practice
                  </Button>
                </div>

                {/* Progress Bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                    <span>Community Progress</span>
                    <span>{topic?.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-900/70 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-600"
                      style={{ width: `${topic?.completionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* View All Topics */}
      <div className="mt-4 pt-3 border-t border-white/30">
        <Button
          variant="outline"
          fullWidth
          iconName="BookOpen"
          iconPosition="left"
          className="rounded-full border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600"
        >
          Explore All Practice Topics
        </Button>
      </div>
    </div>
  );
};

export default RecommendedTopics;