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

const CompanyJobsPage = () => {
  const { user, logout, organizationContext, refresh } = useAuth();
  const navigate = useNavigate();

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

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    employmentType: 'FULL_TIME',
    experienceLevel: 'MID',
    description: '',
    requirements: '',
    benefits: '',
    salaryRange: '',
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
      requirements: '',
      benefits: '',
      salaryRange: '',
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
    setFormData({
      title: job.title || '',
      department: job.department || '',
      location: job.location || '',
      employmentType: job.employmentType || 'FULL_TIME',
      experienceLevel: job.experienceLevel || 'MID',
      description: job.description || '',
      requirements: Array.isArray(job.requirements) 
        ? job.requirements.join('\n')
        : (job.requirements || ''),
      benefits: job.benefits || '',
      salaryRange: job.compensationRange || job.salaryRange || '',
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
      // Prepare payload to match backend validation
      const payload = {
        title: formData.title,
        department: formData.department || undefined,
        location: formData.location || undefined,
        employmentType: formData.employmentType || undefined,
        experienceLevel: formData.experienceLevel || undefined,
        description: formData.description || undefined,
        compensationRange: formData.salaryRange || undefined, // Backend expects compensationRange
        status: formData.status || 'DRAFT',
        // Convert requirements string to array if provided
        requirements: formData.requirements 
          ? (Array.isArray(formData.requirements) 
              ? formData.requirements 
              : formData.requirements.split('\n').filter(r => r.trim()))
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
      case 'ARCHIVED':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header 
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
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
                {organizationContext?.organization?.status !== 'PENDING' && (
                  <Button
                    onClick={handleCreateJob}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shrink-0"
                  >
                    <Icon name="Plus" size={18} />
                    Create Job
                  </Button>
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
                <div className="grid grid-cols-1 gap-4 relative z-0">
                  {filteredJobs.map((job) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card-base p-4 sm:p-6 hover:shadow-lg transition-shadow relative z-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">
                                {job.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                                  {job.status}
                                </span>
                                {job.department && (
                                  <span className="text-sm text-gray-600 dark:text-slate-400">
                                    {job.department}
                                  </span>
                                )}
                                {job.location && (
                                  <span className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-1">
                                    <Icon name="MapPin" size={14} />
                                    {job.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {job.description && (
                            <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2 mb-3">
                              {job.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Icon name="Users" size={16} />
                              {job.applicationsCount || 0} applications
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon name="Clock" size={16} />
                              {new Date(job.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditJob(job)}
                          >
                            <Icon name="Edit" size={16} />
                            Edit
                          </Button>
                          {job.status === 'DRAFT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePublishJob(job.id)}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              <Icon name="Send" size={16} />
                              Publish
                            </Button>
                          )}
                          {job.status === 'PUBLISHED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleArchiveJob(job.id)}
                              className="text-orange-600 border-orange-600 hover:bg-orange-50"
                            >
                              <Icon name="Archive" size={16} />
                              Archive
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteJob(job.id)}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <Icon name="Trash2" size={16} />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
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
                  label="Job Title *"
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
                  <Input
                    label="Location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. San Francisco, CA"
                  />
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                    placeholder="Describe the role, responsibilities, and what you're looking for..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Requirements
                  </label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                    placeholder="List required skills, qualifications, and experience..."
                  />
                </div>

                <Input
                  label="Salary Range"
                  value={formData.salaryRange}
                  onChange={(e) => setFormData({ ...formData, salaryRange: e.target.value })}
                  placeholder="e.g. $80,000 - $120,000"
                />

                {/* Key Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
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
                        placeholder="Add a skill (e.g. React, Communication, Problem-solving)"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            e.preventDefault();
                            const skill = e.target.value.trim();
                            if (!formData.requiredSkills.includes(skill)) {
                              setFormData({
                                ...formData,
                                requiredSkills: [...formData.requiredSkills, skill],
                              });
                              e.target.value = '';
                            }
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
                            const skill = input.value.trim();
                            if (!formData.requiredSkills.includes(skill)) {
                              setFormData({
                                ...formData,
                                requiredSkills: [...formData.requiredSkills, skill],
                              });
                              input.value = '';
                            }
                          }
                        }}
                      >
                        <Icon name="Plus" size={16} />
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      These skills will be displayed to candidates. Press Enter or click Add to add each skill.
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

