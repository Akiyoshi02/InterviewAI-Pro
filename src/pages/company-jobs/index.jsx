import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import apiClient from '../../services/apiClient.js';
import { hasPermission } from '../../utils/rolePermissions';

const CompanyJobsPage = () => {
  const { user, logout, organizationContext, refresh } = useAuth();
  const navigate = useNavigate();
  
  // Get organization role for permission checks
  const organizationRole = user?.organizationContext?.membership?.role;
  const canCreateJobs = hasPermission(organizationRole, 'CREATE_JOBS');
  const canEditJobs = hasPermission(organizationRole, 'EDIT_JOBS');
  const canDeleteJobs = hasPermission(organizationRole, 'DELETE_JOBS');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [jobsPerPage] = useState(3);
  
  // Location detection state
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState({ status: 'idle', message: '' });

  // Currency options with their formatting settings
  const currencyOptions = [
    { value: 'USD', label: 'USD ($)', symbol: '$', locale: 'en-US' },
    { value: 'LKR', label: 'LKR (Rs)', symbol: 'Rs', locale: 'si-LK' },
    { value: 'EUR', label: 'EUR (€)', symbol: '€', locale: 'de-DE' },
    { value: 'GBP', label: 'GBP (£)', symbol: '£', locale: 'en-GB' },
    { value: 'INR', label: 'INR (₹)', symbol: '₹', locale: 'en-IN' },
    { value: 'JPY', label: 'JPY (¥)', symbol: '¥', locale: 'ja-JP' },
    { value: 'CAD', label: 'CAD ($)', symbol: 'C$', locale: 'en-CA' },
    { value: 'AUD', label: 'AUD ($)', symbol: 'A$', locale: 'en-AU' },
    { value: 'CHF', label: 'CHF (Fr)', symbol: 'Fr', locale: 'de-CH' },
    { value: 'CNY', label: 'CNY (¥)', symbol: '¥', locale: 'zh-CN' },
    { value: 'SGD', label: 'SGD ($)', symbol: 'S$', locale: 'en-SG' },
    { value: 'AED', label: 'AED (د.إ)', symbol: 'د.إ', locale: 'ar-AE' },
  ];

  // Format salary based on currency
  const formatSalary = (value, currency = 'USD') => {
    if (!value) return '';
    // Remove all non-digit characters
    const numericValue = value.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    
    const currencyConfig = currencyOptions.find(c => c.value === currency) || currencyOptions[0];
    
    try {
      const number = parseInt(numericValue, 10);
      return new Intl.NumberFormat(currencyConfig.locale, {
        style: 'decimal',
        maximumFractionDigits: 0,
      }).format(number);
    } catch {
      return numericValue;
    }
  };

  // Parse formatted salary to raw number string
  const parseSalary = (formattedValue) => {
    if (!formattedValue) return '';
    return formattedValue.replace(/[^0-9]/g, '');
  };

  // Format detected location from geocoding API response
  const formatDetectedLocation = (data, coords) => {
    if (!data && !coords) {
      return '';
    }

    const administrative = data?.localityInfo?.administrative || [];
    const locality = data?.city
      || data?.locality
      || data?.principalSubdivision
      || administrative.find((item) => (item.order ?? 0) >= 4)?.name;

    const region = data?.principalSubdivision
      || administrative.find((item) => (item.order ?? 0) <= 3)?.name;

    const country = data?.countryName || data?.countryCode;

    const parts = [locality, region, country].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(', ');
    }

    if (coords) {
      const { latitude, longitude } = coords;
      return `Lat ${latitude.toFixed(3)}, Long ${longitude.toFixed(3)}`;
    }

    return '';
  };

  // Handle location detection
  const handleDetectLocation = async () => {
    if (isDetectingLocation) {
      return;
    }

    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setLocationFeedback({
        status: 'error',
        message: 'Your browser does not support location detection. Please enter it manually.',
      });
      return;
    }

    setIsDetectingLocation(true);
    setLocationFeedback({
      status: 'info',
      message: 'Requesting location permission…',
    });

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      setLocationFeedback({
        status: 'info',
        message: 'Detecting your city…',
      });

      const { latitude, longitude } = position.coords || {};

      if (latitude == null || longitude == null) {
        throw new Error('We could not read your coordinates. Please enter your location manually.');
      }

      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );

      if (!response.ok) {
        throw new Error('Unable to determine your location automatically.');
      }

      const data = await response.json();
      const formattedLocation = formatDetectedLocation(data, { latitude, longitude });

      if (!formattedLocation) {
        throw new Error('We couldn\'t convert your coordinates into a city. Please enter it manually.');
      }

      setFormData(prev => ({ ...prev, location: formattedLocation }));

      // Clear location feedback on success
      setLocationFeedback({ status: 'success', message: '' });
    } catch (error) {
      console.error('Location detection error:', error);

      let friendlyMessage = error?.message || 'Unable to detect your location. Please enter it manually.';

      if (error?.code === 1 || error?.message?.toLowerCase().includes('permission')) {
        friendlyMessage = 'Location permission was denied. You can enable it in your browser or enter the location manually.';
      } else if (error?.code === 2) {
        friendlyMessage = 'We could not determine your position. Please try again or enter it manually.';
      } else if (error?.code === 3) {
        friendlyMessage = 'Location request timed out. Please try again or enter it manually.';
      }

      setLocationFeedback({
        status: 'error',
        message: friendlyMessage,
      });
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    employmentType: 'FULL_TIME',
    experienceLevel: 'MID',
    description: '',
    requirements: [],
    benefits: '',
    salaryRange: '',
    salaryCurrency: 'USD',
    salaryMin: '',
    salaryMax: '',
    status: 'DRAFT',
    requiredSkills: [],
    templateConfig: {
      interviewTypes: [],
      skillFocus: [],
      duration: 30,
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.title = 'Jobs - InterviewAI Pro';
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const result = await apiClient.jobs.getOrganizationJobs();
      if (result.success) {
        setJobs(result.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = () => {
    setSelectedJob(null);
    setFormData({
      title: '',
      department: '',
      location: '',
      employmentType: 'FULL_TIME',
      experienceLevel: 'MID',
      description: '',
      requirements: [],
      benefits: '',
      salaryRange: '',
      salaryCurrency: 'USD',
      salaryMin: '',
      salaryMax: '',
      status: 'DRAFT',
      requiredSkills: [],
      templateConfig: {
        interviewTypes: [],
        skillFocus: [],
        duration: 30,
      },
    });
    setShowCreateModal(true);
  };

  const handleEditJob = (job) => {
    setSelectedJob(job);
    // Parse existing salary range if it exists
    const existingSalary = job.compensationRange || job.salaryRange || '';
    let parsedCurrency = job.salaryCurrency || 'USD';
    let parsedMin = job.salaryMin || '';
    let parsedMax = job.salaryMax || '';
    
    // Try to parse legacy format like "$80,000 - $120,000"
    if (existingSalary && !parsedMin && !parsedMax) {
      const rangeMatch = existingSalary.match(/([\d,]+)\s*[-–]\s*([\d,]+)/);
      if (rangeMatch) {
        parsedMin = rangeMatch[1].replace(/,/g, '');
        parsedMax = rangeMatch[2].replace(/,/g, '');
      }
    }
    
    // Parse requirements - convert string to array if needed
    let parsedRequirements = [];
    if (job.requirements) {
      if (Array.isArray(job.requirements)) {
        parsedRequirements = job.requirements;
      } else {
        // Split by newlines or periods to create array
        const lines = job.requirements.split(/\n+/).filter(line => line.trim());
        if (lines.length > 1) {
          parsedRequirements = lines.map(line => line.trim());
        } else {
          // Try splitting by periods if single line
          const sentences = job.requirements
            .split(/\.\s+/)
            .map(s => s.trim().replace(/\.$/, ''))
            .filter(s => s.length > 0);
          parsedRequirements = sentences.length > 1 ? sentences : [job.requirements.trim()];
        }
      }
    }

    setFormData({
      title: job.title || '',
      department: job.department || '',
      location: job.location || '',
      employmentType: job.employmentType || 'FULL_TIME',
      experienceLevel: job.experienceLevel || 'MID',
      description: job.description || '',
      requirements: parsedRequirements,
      benefits: job.benefits || '',
      salaryRange: existingSalary,
      salaryCurrency: parsedCurrency,
      salaryMin: parsedMin,
      salaryMax: parsedMax,
      status: job.status || 'DRAFT',
      requiredSkills: Array.isArray(job.skills) ? job.skills : (job.skills ? [job.skills] : []),
      templateConfig: job.templateConfig || {
        interviewTypes: [],
        skillFocus: [],
        duration: 30,
      },
    });
    setShowCreateModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Validate salary range - min should not be greater than max
      if (formData.salaryMin && formData.salaryMax) {
        const minValue = parseInt(parseSalary(formData.salaryMin), 10);
        const maxValue = parseInt(parseSalary(formData.salaryMax), 10);
        if (minValue > maxValue) {
          setError('Minimum salary cannot be greater than maximum salary.');
          setSubmitting(false);
          return;
        }
      }

      // Build the salary range string from components
      const currencyConfig = currencyOptions.find(c => c.value === formData.salaryCurrency) || currencyOptions[0];
      let salaryRangeString = '';
      if (formData.salaryMin || formData.salaryMax) {
        const formattedMin = formData.salaryMin ? formatSalary(formData.salaryMin, formData.salaryCurrency) : '';
        const formattedMax = formData.salaryMax ? formatSalary(formData.salaryMax, formData.salaryCurrency) : '';
        if (formattedMin && formattedMax) {
          salaryRangeString = `${currencyConfig.symbol}${formattedMin} - ${currencyConfig.symbol}${formattedMax}`;
        } else if (formattedMin) {
          salaryRangeString = `${currencyConfig.symbol}${formattedMin}+`;
        } else if (formattedMax) {
          salaryRangeString = `Up to ${currencyConfig.symbol}${formattedMax}`;
        }
      }

      // Prepare payload to match backend validation
      const payload = {
        title: formData.title,
        department: formData.department || undefined,
        location: formData.location || undefined,
        employmentType: formData.employmentType || undefined,
        experienceLevel: formData.experienceLevel || undefined,
        description: formData.description || undefined,
        compensationRange: salaryRangeString || formData.salaryRange || undefined, // Backend expects compensationRange
        salaryCurrency: formData.salaryCurrency || undefined,
        salaryMin: formData.salaryMin ? parseInt(parseSalary(formData.salaryMin), 10) : undefined,
        salaryMax: formData.salaryMax ? parseInt(parseSalary(formData.salaryMax), 10) : undefined,
        status: formData.status || 'DRAFT',
        // Requirements as array
        requirements: formData.requirements && formData.requirements.length > 0
          ? formData.requirements
          : undefined,
        // Convert requiredSkills to skills array
        skills: formData.requiredSkills && formData.requiredSkills.length > 0
          ? formData.requiredSkills
          : undefined,
        // Include templateConfig if provided
        templateConfig: formData.templateConfig || undefined,
      };

      // Remove undefined fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      if (selectedJob) {
        // Update existing job
        const result = await apiClient.jobs.update(selectedJob.id, payload);
        if (result.success) {
          await loadJobs();
          setShowCreateModal(false);
        } else {
          setError(result.error || 'Failed to update job');
        }
      } else {
        // Create new job
        const result = await apiClient.jobs.create(payload);
        if (result.success) {
          await loadJobs();
          setShowCreateModal(false);
        } else {
          setError(result.error || 'Failed to create job');
        }
      }
    } catch (err) {
      console.error('Job submission error:', err);
      // Extract validation errors from response
      if (err.errors && Array.isArray(err.errors)) {
        const errorMessages = err.errors.map(e => `${e.param || e.field}: ${e.msg || e.message}`).join(', ');
        setError(`Validation failed: ${errorMessages}`);
      } else if (err.error) {
        setError(err.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Failed to save job. Please check all required fields.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      const result = await apiClient.jobs.remove(jobId);
      if (result.success) {
        await loadJobs();
      }
    } catch (err) {
      console.error('Failed to delete job:', err);
      setError('Failed to delete job');
    }
  };

  const handlePublishJob = async (jobId) => {
    try {
      const result = await apiClient.jobs.update(jobId, { status: 'PUBLISHED' });
      if (result.success) {
        await loadJobs();
      }
    } catch (err) {
      console.error('Failed to publish job:', err);
      setError('Failed to publish job');
    }
  };

  const handleArchiveJob = async (jobId) => {
    try {
      const result = await apiClient.jobs.update(jobId, { status: 'ARCHIVED' });
      if (result.success) {
        await loadJobs();
      }
    } catch (err) {
      console.error('Failed to archive job:', err);
      setError('Failed to archive job');
    }
  };

  const filteredJobs = jobs.filter((job) => {
    // Filter by status
    if (filterStatus !== 'all' && job.status !== filterStatus) return false;
    
    // Filter by search query (searches multiple fields)
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true; // Empty query shows all
      
      // Search in multiple fields
      const searchableText = [
        job.title || '',
        job.department || '',
        job.location || '',
        job.description || '',
        job.employmentType || '',
        job.experienceLevel || '',
      ]
        .join(' ')
        .toLowerCase();
      
      return searchableText.includes(query);
    }
    
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
  const startIndex = (currentPage - 1) * jobsPerPage;
  const endIndex = startIndex + jobsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'ARCHIVED':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const formatEmploymentType = (type) => {
    if (!type) return '';
    const typeMap = {
      'FULL_TIME': 'Full-time',
      'PART_TIME': 'Part-time',
      'CONTRACT': 'Contract',
      'INTERNSHIP': 'Internship',
    };
    return typeMap[type] || type.replace('_', '-').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatExperienceLevel = (level) => {
    if (!level) return '';
    const levelMap = {
      'ENTRY': 'Entry Level',
      'MID': 'Mid Level',
      'SENIOR': 'Senior',
      'LEAD': 'Lead',
    };
    return levelMap[level] || level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header 
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
          }`}>
            <div className="container-responsive py-4 sm:py-6 space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Icon name="Briefcase" size={22} color="white" />
                  </div>
                  <div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Job Postings
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Manage your job listings and track applications.
                    </p>
                  </div>
                </div>
                {organizationContext?.organization?.status !== 'PENDING' && canCreateJobs && (
                  <Button
                    onClick={handleCreateJob}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shrink-0"
                  >
                    <Icon name="Plus" size={18} />
                    Create Job
                  </Button>
                )}
                {organizationContext?.organization?.status !== 'PENDING' && !canCreateJobs && (
                  <div className="text-sm text-gray-500 dark:text-slate-400 italic">
                    View-only access
                  </div>
                )}
              </div>

              {/* Pending Approval Message */}
              {organizationContext?.organization?.status === 'PENDING' ? (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                  <div className="text-center py-12">
                    <Icon name="AlertCircle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
                    <p className="text-gray-900 dark:text-slate-100 mb-4">
                      Organization pending approval. Please wait for system administrator review.
                    </p>
                    <Button 
                      onClick={async () => {
                        setRefreshing(true);
                        try {
                          await refresh();
                          await loadJobs();
                        } catch (err) {
                          console.error('Failed to refresh:', err);
                        } finally {
                          setRefreshing(false);
                        }
                      }}
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Checking...</span>
                        </div>
                      ) : (
                        'Retry'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
              {/* Filters */}
              <div className="card-base p-4 sm:p-6 relative z-20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon="Search"
                  />
                  <div className="relative z-30">
                    <Select
                      value={filterStatus}
                      onChange={setFilterStatus}
                      options={[
                        { value: 'all', label: 'All Status' },
                        { value: 'DRAFT', label: 'Draft' },
                        { value: 'PUBLISHED', label: 'Published' },
                        { value: 'ARCHIVED', label: 'Archived' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Jobs List */}
              {loading ? (
                <div className="card-base p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-slate-400">Loading jobs...</p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="card-base p-8 text-center">
                  <Icon name="Briefcase" size={48} className="mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                    No jobs found
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 mb-4">
                    Create your first job posting to start receiving applications
                  </p>
                  {organizationContext?.organization?.status !== 'PENDING' && (
                    <Button onClick={handleCreateJob}>
                      <Icon name="Plus" size={18} />
                      Create Job
                    </Button>
                  )}
                </div>
              ) : (
                <>
                <div className="grid grid-cols-1 gap-4 relative z-0">
                  {paginatedJobs.map((job) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card-base p-5 sm:p-6 hover:shadow-lg transition-all duration-200 relative z-0"
                    >
                      <div className="space-y-5">
                        {/* Header Section */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3 mb-3">
                              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                                {job.title}
                              </h3>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${getStatusColor(job.status)}`}>
                                {job.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                              {job.department && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                                  <Icon name="Briefcase" size={14} />
                                  {job.department}
                                </span>
                              )}
                              {job.location && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                                  <Icon name="MapPin" size={14} />
                                  {job.location}
                                </span>
                              )}
                              {job.employmentType && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                                  <Icon name="Clock" size={14} />
                                  {formatEmploymentType(job.employmentType)}
                                </span>
                              )}
                              {job.experienceLevel && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                                  <Icon name="TrendingUp" size={14} />
                                  {formatExperienceLevel(job.experienceLevel)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 shrink-0">
                            {canEditJobs && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditJob(job)}
                                className="rounded-lg"
                              >
                                <Icon name="Edit" size={16} />
                                Edit
                              </Button>
                            )}
                            {canEditJobs && job.status === 'DRAFT' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePublishJob(job.id)}
                                className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                              >
                                <Icon name="Send" size={16} />
                                Publish
                              </Button>
                            )}
                            {canEditJobs && job.status === 'PUBLISHED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleArchiveJob(job.id)}
                                className="text-orange-600 border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg"
                              >
                                <Icon name="Archive" size={16} />
                                Archive
                              </Button>
                            )}
                            {canDeleteJobs && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteJob(job.id)}
                                className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              >
                                <Icon name="Trash2" size={16} />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {job.description && (
                          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                            <p className="text-sm sm:text-base text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {job.description}
                            </p>
                          </div>
                        )}

                        {/* Job Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                          {/* Salary Range */}
                          {job.compensationRange && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Icon name="DollarSign" size={13} />
                                Salary Range
                              </label>
                              <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
                                {job.compensationRange}
                                {job.salaryCurrency && (
                                  <span className="text-sm font-normal text-gray-500 dark:text-slate-400 ml-1">
                                    ({job.salaryCurrency})
                                  </span>
                                )}
                              </p>
                            </div>
                          )}

                          {/* Posted Date */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Icon name="Calendar" size={13} />
                              Posted Date
                            </label>
                            <p className="text-base text-gray-900 dark:text-slate-100">
                              {new Date(job.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>

                          {/* Applications Count */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Icon name="Users" size={13} />
                              Applications
                            </label>
                            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
                              {job.applicationsCount || 0} <span className="text-sm font-normal text-gray-500 dark:text-slate-400">application{(job.applicationsCount || 0) !== 1 ? 's' : ''}</span>
                            </p>
                          </div>
                        </div>

                        {/* Required Skills */}
                        {job.skills && Array.isArray(job.skills) && job.skills.length > 0 && (
                          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Icon name="Tag" size={13} />
                              Required Skills
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {job.skills.map((skill, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium border border-blue-200 dark:border-blue-800 shadow-sm"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Requirements */}
                        {job.requirements && (
                          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Icon name="CheckCircle" size={13} />
                              Requirements
                            </label>
                            <div className="text-sm text-gray-700 dark:text-slate-300">
                              {Array.isArray(job.requirements) ? (
                                <ul className="space-y-2.5 pl-0">
                                  {job.requirements.map((req, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                      <span className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 font-bold text-lg leading-none">•</span>
                                      <span className="flex-1 leading-relaxed pt-0.5">{req.trim()}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="whitespace-pre-wrap leading-relaxed">{job.requirements}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Benefits */}
                        {job.benefits && (
                          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Icon name="Star" size={13} />
                              Benefits
                            </label>
                            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {job.benefits}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 mt-6">
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="rounded-full"
                      >
                        <Icon name="ChevronLeft" size={16} />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // Show first page, last page, current page, and pages around current
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`min-w-[40px] h-10 px-3 rounded-full text-sm font-medium transition-colors ${
                                  currentPage === page
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          } else if (
                            page === currentPage - 2 ||
                            page === currentPage + 2
                          ) {
                            return (
                              <span key={page} className="text-gray-500 dark:text-slate-500 px-1">
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-full"
                      >
                        Next
                        <Icon name="ChevronRight" size={16} />
                      </Button>
                    </div>
                  </div>
                )}
                </>
              )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Create/Edit Job Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {selectedJob ? 'Edit Job' : 'Create New Job'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <Input
                  label="Job Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g. Senior Frontend Developer"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Engineering"
                  />
                  
                  {/* Location with detect button */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-sm font-medium leading-none text-foreground">
                      Location
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={isDetectingLocation && locationFeedback?.message ? locationFeedback.message : formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g. San Francisco, CA"
                        disabled={isDetectingLocation}
                        className="flex h-11 sm:h-12 w-full rounded-xl border border-input bg-background px-3 sm:px-4 pr-[90px] sm:pr-[100px] py-2.5 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isDetectingLocation}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDetectingLocation ? (
                          <>
                            <Icon name="Loader2" size={14} className="animate-spin" />
                            <span className="hidden sm:inline">Detecting</span>
                          </>
                        ) : (
                          <>
                            <Icon name="MapPin" size={14} />
                            <span className="hidden sm:inline">Detect</span>
                          </>
                        )}
                      </button>
                    </div>
                    {locationFeedback?.status === 'error' && locationFeedback?.message && (
                      <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
                        <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
                        {locationFeedback.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Employment Type"
                    value={formData.employmentType}
                    onChange={(value) => setFormData({ ...formData, employmentType: value })}
                    options={[
                      { value: 'FULL_TIME', label: 'Full-time' },
                      { value: 'PART_TIME', label: 'Part-time' },
                      { value: 'CONTRACT', label: 'Contract' },
                      { value: 'INTERNSHIP', label: 'Internship' },
                    ]}
                  />
                  <Select
                    label="Experience Level"
                    value={formData.experienceLevel}
                    onChange={(value) => setFormData({ ...formData, experienceLevel: value })}
                    options={[
                      { value: 'ENTRY', label: 'Entry Level' },
                      { value: 'MID', label: 'Mid Level' },
                      { value: 'SENIOR', label: 'Senior' },
                      { value: 'LEAD', label: 'Lead' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Description <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={4}
                    className="w-full px-3 sm:px-4 py-2.5 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 resize-y min-h-[100px]"
                    placeholder="Describe the role, responsibilities, and what you're looking for..."
                  />
                </div>

                {/* Requirements */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Requirements
                  </label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.requirements.map((req, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm border border-purple-200 dark:border-purple-800"
                        >
                          {req}
                          <button
                            type="button"
                            onClick={() => {
                              const newRequirements = formData.requirements.filter((_, i) => i !== index);
                              setFormData({ ...formData, requirements: newRequirements });
                            }}
                            className="hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full p-0.5 transition-colors"
                          >
                            <Icon name="X" size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add requirement (e.g. 3+ years of experience, Bachelor's degree)"
                        className="flex-1 h-11 sm:h-12 px-3 sm:px-4 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            e.preventDefault();
                            const inputValue = e.target.value.trim();
                            // Split by comma and filter out empty values
                            const newRequirements = inputValue
                              .split(',')
                              .map(r => r.trim())
                              .filter(r => r && !formData.requirements.includes(r));
                            if (newRequirements.length > 0) {
                              setFormData({
                                ...formData,
                                requirements: [...formData.requirements, ...newRequirements],
                              });
                            }
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          const input = e.target.closest('div').querySelector('input');
                          if (input && input.value.trim()) {
                            const inputValue = input.value.trim();
                            // Split by comma and filter out empty values
                            const newRequirements = inputValue
                              .split(',')
                              .map(r => r.trim())
                              .filter(r => r && !formData.requirements.includes(r));
                            if (newRequirements.length > 0) {
                              setFormData({
                                ...formData,
                                requirements: [...formData.requirements, ...newRequirements],
                              });
                            }
                            input.value = '';
                          }
                        }}
                      >
                        <Icon name="Plus" size={16} />
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Separate multiple requirements with commas. Press Enter or click Add. Each requirement will appear as a bullet point.
                    </p>
                  </div>
                </div>

                {/* Salary Range Section */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Salary Range
                  </label>
                  
                  {/* Currency Selector */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="sm:w-40">
                      <Select
                        value={formData.salaryCurrency}
                        onChange={(value) => setFormData({ ...formData, salaryCurrency: value })}
                        options={currencyOptions.map((currency) => ({
                          value: currency.value,
                          label: currency.label,
                        }))}
                        placeholder="Currency"
                      />
                    </div>
                    
                    {/* Min/Max Salary Inputs */}
                    <div className="flex-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          {currencyOptions.find(c => c.value === formData.salaryCurrency)?.symbol || '$'}
                        </span>
                        <input
                          type="text"
                          value={formData.salaryMin ? formatSalary(formData.salaryMin, formData.salaryCurrency) : ''}
                          onChange={(e) => {
                            const raw = parseSalary(e.target.value);
                            setFormData({ ...formData, salaryMin: raw });
                          }}
                          placeholder="Min"
                          className="w-full h-11 sm:h-12 pl-8 pr-3 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200"
                        />
                      </div>
                      
                      <span className="text-muted-foreground font-medium">–</span>
                      
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          {currencyOptions.find(c => c.value === formData.salaryCurrency)?.symbol || '$'}
                        </span>
                        <input
                          type="text"
                          value={formData.salaryMax ? formatSalary(formData.salaryMax, formData.salaryCurrency) : ''}
                          onChange={(e) => {
                            const raw = parseSalary(e.target.value);
                            setFormData({ ...formData, salaryMax: raw });
                          }}
                          placeholder="Max"
                          className="w-full h-11 sm:h-12 pl-8 pr-3 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Preview */}
                  {(formData.salaryMin || formData.salaryMax) && (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Preview: {(() => {
                        const currencyConfig = currencyOptions.find(c => c.value === formData.salaryCurrency) || currencyOptions[0];
                        const formattedMin = formData.salaryMin ? formatSalary(formData.salaryMin, formData.salaryCurrency) : '';
                        const formattedMax = formData.salaryMax ? formatSalary(formData.salaryMax, formData.salaryCurrency) : '';
                        if (formattedMin && formattedMax) {
                          return `${currencyConfig.symbol}${formattedMin} - ${currencyConfig.symbol}${formattedMax}`;
                        } else if (formattedMin) {
                          return `${currencyConfig.symbol}${formattedMin}+`;
                        } else if (formattedMax) {
                          return `Up to ${currencyConfig.symbol}${formattedMax}`;
                        }
                        return '';
                      })()}
                    </p>
                  )}
                </div>

                {/* Key Skills */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Key Skills
                  </label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.requiredSkills.map((skill, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm border border-blue-200 dark:border-blue-800"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => {
                              const newSkills = formData.requiredSkills.filter((_, i) => i !== index);
                              setFormData({ ...formData, requiredSkills: newSkills });
                            }}
                            className="hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
                          >
                            <Icon name="X" size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add skills (e.g. React, JavaScript, Python)"
                        className="flex-1 h-11 sm:h-12 px-3 sm:px-4 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            e.preventDefault();
                            const inputValue = e.target.value.trim();
                            // Split by comma and filter out empty values
                            const newSkills = inputValue
                              .split(',')
                              .map(s => s.trim())
                              .filter(s => s && !formData.requiredSkills.includes(s));
                            if (newSkills.length > 0) {
                              setFormData({
                                ...formData,
                                requiredSkills: [...formData.requiredSkills, ...newSkills],
                              });
                            }
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          const input = e.target.closest('div').querySelector('input');
                          if (input && input.value.trim()) {
                            const inputValue = input.value.trim();
                            // Split by comma and filter out empty values
                            const newSkills = inputValue
                              .split(',')
                              .map(s => s.trim())
                              .filter(s => s && !formData.requiredSkills.includes(s));
                            if (newSkills.length > 0) {
                              setFormData({
                                ...formData,
                                requiredSkills: [...formData.requiredSkills, ...newSkills],
                              });
                            }
                            input.value = '';
                          }
                        }}
                      >
                        <Icon name="Plus" size={16} />
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Separate multiple skills with commas. Press Enter or click Add.
                    </p>
                  </div>
                </div>

                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(value) => setFormData({ ...formData, status: value })}
                  options={[
                    { value: 'DRAFT', label: 'Draft' },
                    { value: 'PUBLISHED', label: 'Published' },
                    { value: 'ARCHIVED', label: 'Archived' },
                  ]}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    {submitting ? 'Saving...' : selectedJob ? 'Update Job' : 'Create Job'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CompanyJobsPage;

