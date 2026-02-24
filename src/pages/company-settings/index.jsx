import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import ProfileSettingsPanel from '../../components/ui/ProfileSettingsPanel';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';

const CompanySettingsPage = () => {
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const userType = user?.accountType === 'COMPANY' ? 'company' : null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!userType) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header
        userType={userType}
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />

      {maintenanceMode && <MaintenanceBanner />}

      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType={userType}
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
              isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
            }`}
          >
            <motion.section
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-4 xs:space-y-5 sm:space-y-6"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Icon name="Settings" size={22} color="white" />
                </div>
                <div>
                  <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                    Settings
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Manage your organization profile and user preferences.
                  </p>
                </div>
              </div>

              <ProfileSettingsPanel
                userType="company"
                variant="card"
                density="comfortable"
              />
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CompanySettingsPage;
