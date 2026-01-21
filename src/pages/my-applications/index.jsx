import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MyApplicationsList from '../candidate-dashboard/components/MyApplicationsList';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';

const MyApplicationsPage = () => {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Loading applications"
        message="Fetching your latest submissions."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header 
        userType="candidate" 
        isAuthenticated
        onLogout={handleLogout}
      />
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="candidate"
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
              isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
            }`}
          >
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="container-responsive py-4 xs:py-6 sm:py-8"
            >
              {/* Page Header */}
              <div className="mb-6 xs:mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30">
                      <Icon name="FileText" size={24} color="white" />
                    </div>
                    <div>
                      <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100">
                        My Applications
                      </h1>
                      <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 mt-1">
                        Track and manage your job applications
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate('/jobs')}
                    className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    <Icon name="Plus" size={16} />
                    Browse Jobs
                  </Button>
                </div>
              </div>

              {/* Applications List */}
              <MyApplicationsList />
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default MyApplicationsPage;

