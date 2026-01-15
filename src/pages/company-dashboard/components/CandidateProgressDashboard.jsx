import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import apiClient from '../../../services/apiClient.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper function to get company logo URL
const getCompanyLogoUrl = (user) => {
  const logoPath = user?.companyLogoUrl 
    || user?.organizationContext?.organization?.logo
    || user?.organizationContext?.organization?.branding?.logoUrl
    || null;
  
  if (!logoPath) return null;
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath;
  }
  const base = API_URL.replace(/\/$/, '');
  return `${base}${logoPath.startsWith('/') ? logoPath : `/${logoPath}`}`;
};

const CandidateProgressDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedJob, setSelectedJob] = useState('all');

  useEffect(() => {
    loadDashboardData();
  }, [timeRange, selectedJob]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load applications and analytics
      const [applicationsResult, metricsResult, jobsResult] = await Promise.all([
        apiClient.applications.getOrganizationApplications(),
        apiClient.analytics.getCompanyMetrics(),
        apiClient.jobs.getOrganizationJobs(),
      ]);

      const applications = applicationsResult.success ? applicationsResult.applications || [] : [];
      const metrics = metricsResult.success ? metricsResult.metrics || {} : {};
      const jobs = jobsResult.success ? jobsResult.jobs || [] : [];

      // Calculate statistics
      const stats = calculateStatistics(applications, jobs);
      
      setData({
        applications,
        metrics,
        jobs,
        stats,
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (applications, jobs) => {
    const stats = {
      total: applications.length,
      byStatus: {},
      byJob: {},
      recentActivity: [],
      conversionRate: 0,
      avgTimeToHire: 0,
      topJobs: [],
    };

    // Count by status
    const statusCounts = {
      SUBMITTED: 0,
      SCREENING: 0,
      INTERVIEWING: 0,
      SHORTLISTED: 0,
      HIRED: 0,
      REJECTED: 0,
    };

    applications.forEach((app) => {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      
      // Count by job
      const jobId = app.jobId;
      if (!stats.byJob[jobId]) {
        stats.byJob[jobId] = {
          count: 0,
          title: app.job?.title || 'Unknown',
        };
      }
      stats.byJob[jobId].count++;
    });

    stats.byStatus = statusCounts;

    // Calculate conversion rate (submitted -> hired)
    if (statusCounts.SUBMITTED > 0) {
      stats.conversionRate = ((statusCounts.HIRED / stats.total) * 100).toFixed(1);
    }

    // Top jobs by application count
    stats.topJobs = Object.entries(stats.byJob)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent activity (last 10)
    stats.recentActivity = applications
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 10);

    return stats;
  };

  const handleExportPDF = () => {
    if (!data) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 0;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    const lineHeight = 6;
    const sectionSpacing = 15;
    const headerHeight = 45; // First page header height
    const pageHeaderHeight = 15; // Subsequent pages header
    const footerHeight = 20; // Footer height for all pages
    
    // Company information
    const companyName = user?.companyName 
      || user?.organizationContext?.organization?.name 
      || user?.organizationContext?.organization?.displayName 
      || 'Company';
    const companyEmail = user?.email || '';
    const companyWebsite = user?.organizationContext?.organization?.website || '';
    const companyPhone = user?.organizationContext?.organization?.phone || '';
    const logoUrl = getCompanyLogoUrl(user);
    
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const reportTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const reportId = `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const timeRangeLabel = timeRange === '7d' ? 'Last 7 Days' : 
                          timeRange === '30d' ? 'Last 30 Days' : 
                          timeRange === '90d' ? 'Last 90 Days' : 'All Time';
    const currentYear = now.getFullYear();

    // Track current page number
    let currentPageNum = 1;

    // Helper function to add a new page if needed
    const checkNewPage = (requiredSpace) => {
      if (yPosition + requiredSpace > pageHeight - footerHeight - 10) {
        doc.addPage();
        currentPageNum++;
        addSubsequentPageHeader();
        return true;
      }
      return false;
    };

    // Add gradient header for first page
    const addFirstPageHeader = () => {
      // Create gradient effect from blue-600 (#2563EB) to purple-600 (#7C3AED)
      const gradientSteps = 25;
      const stepHeight = headerHeight / gradientSteps;
      
      for (let i = 0; i < gradientSteps; i++) {
        const ratio = i / gradientSteps;
        const r = Math.round(37 + (124 - 37) * ratio);
        const g = Math.round(99 + (58 - 99) * ratio);
        const b = Math.round(235 + (237 - 235) * ratio);
        doc.setFillColor(r, g, b);
        doc.rect(0, i * stepHeight, pageWidth, stepHeight + 0.5, 'F');
      }
      
      // Company branding (left side)
      const logoSize = 25;
      const logoX = margin;
      const logoY = 10;
      
      // Logo background
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'F');
      
      // Attempt to add logo
      if (logoUrl) {
        try {
          doc.addImage(logoUrl, 'PNG', logoX + 2, logoY + 2, logoSize - 4, logoSize - 4, undefined, 'FAST');
        } catch (e) {
          // Logo failed to load - box is sufficient
        }
      }
      
      // Company name and report title
      const textStartX = logoX + logoSize + 10;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, textStartX, logoY + 10);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Analytics Dashboard Report', textStartX, logoY + 18);
      
      // Right side: Report info
      doc.setFontSize(8);
      doc.text(reportId, pageWidth - margin, logoY + 8, { align: 'right' });
      doc.text(reportDate, pageWidth - margin, logoY + 14, { align: 'right' });
      doc.text(reportTime, pageWidth - margin, logoY + 20, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      yPosition = headerHeight + 8;
    };

    // Add simple header for subsequent pages
    const addSubsequentPageHeader = () => {
      // Thin gradient bar at top
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, pageWidth, 3, 'F');
      
      // Company name and report title
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`${companyName} | Analytics Report`, margin, 10);
      doc.text(reportId, pageWidth - margin, 10, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      yPosition = pageHeaderHeight + 5;
    };

    // Add footer to all pages
    const addPageFooter = (pageNum, totalPages, isLastPage = false) => {
      const footerY = pageHeight - footerHeight;
      
      // Footer background for last page
      if (isLastPage) {
        doc.setFillColor(248, 250, 252);
        doc.rect(0, footerY - 2, pageWidth, footerHeight + 2, 'F');
      }
      
      // Footer line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      
      // Left: Company info
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, margin, footerY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('CONFIDENTIAL', margin, footerY + 11);
      
      // Center: Copyright and status
      doc.setTextColor(100, 116, 139);
      doc.text(
        `© ${currentYear} ${companyName}`,
        pageWidth / 2,
        footerY + 6,
        { align: 'center' }
      );
      if (isLastPage) {
        doc.setTextColor(148, 163, 184);
        doc.text(
          'All Rights Reserved | Internal Use Only',
          pageWidth / 2,
          footerY + 11,
          { align: 'center' }
        );
      }
      
      // Right: Page number and report ID
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Page ${pageNum} of ${totalPages}`,
        pageWidth - margin,
        footerY + 6,
        { align: 'right' }
      );
      doc.setTextColor(148, 163, 184);
      doc.text(
        reportId,
        pageWidth - margin,
        footerY + 11,
        { align: 'right' }
      );
      
      doc.setTextColor(0, 0, 0);
    };

    // Helper to add section title with number
    let sectionNumber = 0;
    const addSectionTitle = (title) => {
      sectionNumber++;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text(`${sectionNumber}. ${title}`, margin, yPosition);
      
      // Underline
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition + 2, margin + doc.getTextWidth(`${sectionNumber}. ${title}`), yPosition + 2);
      
      doc.setTextColor(0, 0, 0);
      yPosition += lineHeight + 4;
    };

    // Add first page header
    addFirstPageHeader();

    // Report Information Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(margin, yPosition, contentWidth, 28, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPosition, contentWidth, 28, 3, 3);
    
    // Left column
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont('helvetica', 'normal');
    
    const col1X = margin + 8;
    const col2X = margin + contentWidth * 0.35;
    const col3X = margin + contentWidth * 0.7;
    let infoY = yPosition + 8;
    
    doc.text('Report Period:', col1X, infoY);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont('helvetica', 'bold');
    doc.text(timeRangeLabel, col1X + 32, infoY);
    
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated:', col2X, infoY);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(`${reportDate}`, col2X + 25, infoY);
    
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Report ID:', col3X, infoY);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(reportId, col3X + 22, infoY);
    
    infoY += 10;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Report Type:', col1X, infoY);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Analytics Dashboard', col1X + 32, infoY);
    
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Time:', col2X, infoY);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(reportTime, col2X + 25, infoY);
    
    if (companyEmail) {
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('Contact:', col3X, infoY);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      const emailDisplay = companyEmail.length > 25 ? companyEmail.substring(0, 22) + '...' : companyEmail;
      doc.text(emailDisplay, col3X + 22, infoY);
    }
    
    yPosition += 36;

    // Table layout constants
    const tableStartX = margin;
    const tableWidth = contentWidth;
    const rowHeight = 8;

    // =====================
    // SECTION 1: KEY METRICS
    // =====================
    checkNewPage(60);
    addSectionTitle('Key Performance Metrics');

    const metrics = [
      { label: 'Total Candidates', value: data.stats.total, color: [37, 99, 235], desc: 'Applications received' },
      { label: 'Conversion Rate', value: `${data.stats.conversionRate}%`, color: [16, 185, 129], desc: 'Hired from total' },
      { label: 'In Pipeline', value: data.stats.byStatus.SUBMITTED + data.stats.byStatus.SCREENING + data.stats.byStatus.INTERVIEWING, color: [124, 58, 237], desc: 'Active candidates' },
      { label: 'Total Hired', value: data.stats.byStatus.HIRED, color: [5, 150, 105], desc: 'Successfully hired' },
    ];

    const metricBoxWidth = (contentWidth - 15) / 4;
    const metricBoxHeight = 35;

    metrics.forEach((metric, index) => {
      const x = margin + index * (metricBoxWidth + 5);
      
      // Box background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, yPosition, metricBoxWidth, metricBoxHeight, 2, 2, 'F');
      
      // Top accent bar
      doc.setFillColor(...metric.color);
      doc.rect(x, yPosition, metricBoxWidth, 3, 'F');
      
      // Border
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, yPosition, metricBoxWidth, metricBoxHeight, 2, 2);
      
      // Value
      doc.setFontSize(16);
      doc.setTextColor(...metric.color);
      doc.setFont('helvetica', 'bold');
      doc.text(String(metric.value), x + metricBoxWidth / 2, yPosition + 16, { align: 'center' });
      
      // Label
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont('helvetica', 'bold');
      doc.text(metric.label, x + metricBoxWidth / 2, yPosition + 24, { align: 'center' });
      
      // Description
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.text(metric.desc, x + metricBoxWidth / 2, yPosition + 30, { align: 'center' });
    });

    yPosition += metricBoxHeight + sectionSpacing;
    doc.setTextColor(0, 0, 0);

    // ================================
    // SECTION 2: STATUS DISTRIBUTION
    // ================================
    checkNewPage(60);
    addSectionTitle('Application Status Distribution');

    const total = Object.values(data.stats.byStatus).reduce((sum, val) => sum + val, 0);
    const statusColors = {
      SUBMITTED: [37, 99, 235],
      SCREENING: [234, 179, 8],
      INTERVIEWING: [124, 58, 237],
      SHORTLISTED: [16, 185, 129],
      HIRED: [5, 150, 105],
      REJECTED: [107, 114, 128],
    };

    // Table header
    const colWidths = [tableWidth * 0.45, tableWidth * 0.20, tableWidth * 0.20, tableWidth * 0.15];

    doc.setFillColor(37, 99, 235);
    doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Status', tableStartX + 5, yPosition + 5.5);
    doc.text('Count', tableStartX + colWidths[0] + 5, yPosition + 5.5);
    doc.text('Percentage', tableStartX + colWidths[0] + colWidths[1] + 5, yPosition + 5.5);
    doc.text('Visual', tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 5, yPosition + 5.5);
    yPosition += rowHeight;

    // Table rows
    const statusEntries = Object.entries(data.stats.byStatus)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    statusEntries.forEach(([status, count], rowIndex) => {
      checkNewPage(rowHeight + 2);
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      
      // Row background (alternating)
      doc.setFillColor(rowIndex % 2 === 0 ? 248 : 255, rowIndex % 2 === 0 ? 250 : 255, rowIndex % 2 === 0 ? 252 : 255);
      doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');

      // Border
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(tableStartX, yPosition, tableWidth, rowHeight);

      // Status with color indicator
      doc.setFillColor(...(statusColors[status] || [100, 100, 100]));
      doc.circle(tableStartX + 8, yPosition + 4, 2.5, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(status, tableStartX + 15, yPosition + 5.5);

      // Count
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(String(count), tableStartX + colWidths[0] + 5, yPosition + 5.5);

      // Percentage
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${percentage}%`, tableStartX + colWidths[0] + colWidths[1] + 5, yPosition + 5.5);

      // Visual bar
      const barX = tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 5;
      const barWidth = colWidths[3] - 10;
      const barHeight = 4;
      const barY = yPosition + 2;
      
      // Background bar
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'F');
      
      // Filled bar
      const fillWidth = (parseFloat(percentage) / 100) * barWidth;
      if (fillWidth > 0) {
        doc.setFillColor(...(statusColors[status] || [100, 100, 100]));
        doc.roundedRect(barX, barY, fillWidth, barHeight, 1, 1, 'F');
      }

      doc.setTextColor(0, 0, 0);
      yPosition += rowHeight;
    });

    // Total row
    doc.setFillColor(241, 245, 249);
    doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(tableStartX, yPosition, tableWidth, rowHeight);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('TOTAL', tableStartX + 5, yPosition + 5.5);
    doc.text(String(total), tableStartX + colWidths[0] + 5, yPosition + 5.5);
    doc.text('100%', tableStartX + colWidths[0] + colWidths[1] + 5, yPosition + 5.5);
    yPosition += rowHeight + sectionSpacing;

    // ============================
    // SECTION 3: HIRING FUNNEL
    // ============================
    checkNewPage(80);
    addSectionTitle('Hiring Funnel Analysis');

    const funnelStages = [
      { status: 'SUBMITTED', label: 'Applications Submitted', color: [37, 99, 235] },
      { status: 'SCREENING', label: 'Under Screening', color: [234, 179, 8] },
      { status: 'INTERVIEWING', label: 'Interviewing', color: [124, 58, 237] },
      { status: 'SHORTLISTED', label: 'Shortlisted', color: [16, 185, 129] },
      { status: 'HIRED', label: 'Hired', color: [5, 150, 105] },
    ];

    const maxCount = Math.max(...funnelStages.map(s => data.stats.byStatus[s.status] || 0), 1);
    const funnelBarWidth = contentWidth - 100;
    const funnelBarHeight = 12;
    let previousStageCount = total;

    funnelStages.forEach((stage, index) => {
      checkNewPage(funnelBarHeight + 8);
      const count = data.stats.byStatus[stage.status] || 0;
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      const dropOff = index > 0 && previousStageCount > 0 ? 
        (((previousStageCount - count) / previousStageCount) * 100).toFixed(0) : '0';
      const barLength = Math.max((count / maxCount) * funnelBarWidth, count > 0 ? 20 : 0);
      
      // Stage label
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(stage.label, margin, yPosition + 4);

      // Progress bar background
      const barX = margin + 80;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(barX, yPosition, funnelBarWidth, funnelBarHeight, 2, 2, 'F');

      // Progress bar fill
      if (barLength > 0) {
        doc.setFillColor(...stage.color);
        doc.roundedRect(barX, yPosition, barLength, funnelBarHeight, 2, 2, 'F');
      }

      // Count inside bar
      doc.setFontSize(8);
      doc.setTextColor(count > 0 ? 255 : 100, count > 0 ? 255 : 116, count > 0 ? 255 : 139);
      doc.setFont('helvetica', 'bold');
      const countText = `${count} (${percentage}%)`;
      const countX = barLength > 50 ? barX + 5 : barX + barLength + 5;
      doc.text(countText, countX, yPosition + 8);

      // Drop-off indicator (not for first stage)
      if (index > 0 && parseInt(dropOff) > 0) {
        doc.setFontSize(7);
        doc.setTextColor(239, 68, 68); // red-500
        doc.setFont('helvetica', 'normal');
        doc.text(`-${dropOff}%`, margin + 80 + funnelBarWidth + 5, yPosition + 8);
      }

      previousStageCount = count;
      yPosition += funnelBarHeight + 6;
    });
    yPosition += sectionSpacing;

    // ================================
    // SECTION 4: TOP JOB POSTINGS
    // ================================
    if (data.stats.topJobs.length > 0) {
      checkNewPage(60);
      addSectionTitle('Top Performing Job Postings');

      // Table header
      const jobColWidths = [tableWidth * 0.10, tableWidth * 0.60, tableWidth * 0.15, tableWidth * 0.15];
      doc.setFillColor(37, 99, 235);
      doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('#', tableStartX + 5, yPosition + 5.5);
      doc.text('Job Title', tableStartX + jobColWidths[0] + 5, yPosition + 5.5);
      doc.text('Count', tableStartX + jobColWidths[0] + jobColWidths[1] + 5, yPosition + 5.5);
      doc.text('Share', tableStartX + jobColWidths[0] + jobColWidths[1] + jobColWidths[2] + 5, yPosition + 5.5);
      yPosition += rowHeight;

      // Table rows
      data.stats.topJobs.forEach((job, index) => {
        checkNewPage(rowHeight + 2);
        const jobPercentage = total > 0 ? ((job.count / total) * 100).toFixed(1) : '0.0';
        
        // Row background
        doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255);
        doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');

        // Border
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.rect(tableStartX, yPosition, tableWidth, rowHeight);

        // Rank with medal colors
        const rankColors = [[234, 179, 8], [148, 163, 184], [180, 83, 9]]; // Gold, Silver, Bronze
        doc.setFillColor(...(rankColors[index] || [100, 116, 139]));
        doc.circle(tableStartX + 8, yPosition + 4, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(String(index + 1), tableStartX + 8, yPosition + 5.5, { align: 'center' });

        // Job title
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const titleMaxWidth = jobColWidths[1] - 10;
        const displayTitle = job.title.length > 50 ? job.title.substring(0, 47) + '...' : job.title;
        doc.text(displayTitle, tableStartX + jobColWidths[0] + 5, yPosition + 5.5);

        // Count
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235);
        doc.text(String(job.count), tableStartX + jobColWidths[0] + jobColWidths[1] + 5, yPosition + 5.5);

        // Share percentage
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${jobPercentage}%`, tableStartX + jobColWidths[0] + jobColWidths[1] + jobColWidths[2] + 5, yPosition + 5.5);

        yPosition += rowHeight;
      });
      yPosition += sectionSpacing;
    }

    // ================================
    // SECTION 5: RECENT ACTIVITY
    // ================================
    if (data.stats.recentActivity.length > 0) {
      checkNewPage(80);
      addSectionTitle('Recent Application Activity');

      // Table header - adjusted column widths for better status display
      const activityColWidths = [tableWidth * 0.28, tableWidth * 0.28, tableWidth * 0.18, tableWidth * 0.14, tableWidth * 0.12];
      doc.setFillColor(37, 99, 235);
      doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Candidate', tableStartX + 5, yPosition + 5.5);
      doc.text('Position', tableStartX + activityColWidths[0] + 5, yPosition + 5.5);
      doc.text('Status', tableStartX + activityColWidths[0] + activityColWidths[1] + 5, yPosition + 5.5);
      doc.text('Date', tableStartX + activityColWidths[0] + activityColWidths[1] + activityColWidths[2] + 5, yPosition + 5.5);
      doc.text('ID', tableStartX + activityColWidths[0] + activityColWidths[1] + activityColWidths[2] + activityColWidths[3] + 3, yPosition + 5.5);
      yPosition += rowHeight;

      // Table rows
      data.stats.recentActivity.slice(0, 10).forEach((activity, index) => {
        checkNewPage(rowHeight + 2);
        const candidateName = activity.candidate?.fullName || activity.candidate?.email || 'Unknown';
        const jobTitle = activity.job?.title || 'Unknown position';
        const date = new Date(activity.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const appId = activity.id ? activity.id.substring(0, 8) : 'N/A';
        
        // Row background
        doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255);
        doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');

        // Border
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.rect(tableStartX, yPosition, tableWidth, rowHeight);

        // Candidate name
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        const displayName = candidateName.length > 22 ? candidateName.substring(0, 19) + '...' : candidateName;
        doc.text(displayName, tableStartX + 5, yPosition + 5.5);

        // Position
        const displayPos = jobTitle.length > 22 ? jobTitle.substring(0, 19) + '...' : jobTitle;
        doc.text(displayPos, tableStartX + activityColWidths[0] + 5, yPosition + 5.5);

        // Status badge - now with proper width for longer statuses
        const statusColor = statusColors[activity.status] || [100, 116, 139];
        doc.setFillColor(...statusColor);
        const statusBadgeX = tableStartX + activityColWidths[0] + activityColWidths[1] + 3;
        const statusBadgeWidth = activityColWidths[2] - 6;
        doc.roundedRect(statusBadgeX, yPosition + 1.5, statusBadgeWidth, 5, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        // Use full status name now that we have more space
        const statusDisplay = activity.status.length > 12 ? activity.status.substring(0, 11) + '.' : activity.status;
        doc.text(statusDisplay, statusBadgeX + statusBadgeWidth / 2, yPosition + 4.8, { align: 'center' });

        // Date
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(date, tableStartX + activityColWidths[0] + activityColWidths[1] + activityColWidths[2] + 5, yPosition + 5.5);

        // ID
        doc.setTextColor(148, 163, 184);
        doc.text(appId, tableStartX + activityColWidths[0] + activityColWidths[1] + activityColWidths[2] + activityColWidths[3] + 3, yPosition + 5.5);

        yPosition += rowHeight;
      });
      yPosition += sectionSpacing;
    }

    // ================================
    // EXECUTIVE SUMMARY
    // ================================
    checkNewPage(50);
    addSectionTitle('Executive Summary');
    
    // Summary box
    doc.setFillColor(248, 250, 252);
    const summaryHeight = 30;
    doc.roundedRect(margin, yPosition, contentWidth, summaryHeight, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPosition, contentWidth, summaryHeight, 3, 3);
    
    // Left accent bar (gradient simulation)
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, yPosition, 4, summaryHeight / 2, 'F');
    doc.setFillColor(124, 58, 237);
    doc.rect(margin, yPosition + summaryHeight / 2, 4, summaryHeight / 2, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const summaryText = `This analytics report covers ${timeRangeLabel.toLowerCase()} of hiring activity. During this period, ${companyName} received a total of ${data.stats.total} application${data.stats.total !== 1 ? 's' : ''} across all job postings. The overall conversion rate (applications to hires) stands at ${data.stats.conversionRate}%, with ${data.stats.byStatus.HIRED} candidate${data.stats.byStatus.HIRED !== 1 ? 's' : ''} successfully hired. Currently, ${data.stats.byStatus.INTERVIEWING || 0} candidate${(data.stats.byStatus.INTERVIEWING || 0) !== 1 ? 's are' : ' is'} in the interviewing stage.`;
    
    const summaryLines = doc.splitTextToSize(summaryText, contentWidth - 20);
    doc.text(summaryLines, margin + 12, yPosition + 8);

    // ================================
    // ADD FOOTERS TO ALL PAGES
    // ================================
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i, totalPages, i === totalPages);
    }

    // Save the PDF
    const fileName = `${companyName.replace(/[^a-z0-9]/gi, '_')}_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const handleExportCSV = () => {
    if (!data) return;

    // Company information
    const companyName = user?.companyName 
      || user?.organizationContext?.organization?.name 
      || user?.organizationContext?.organization?.displayName 
      || 'Company';
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const reportTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const reportId = `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    // Company information for CSV
    const companyEmail = user?.email || '';
    const companyWebsite = user?.organizationContext?.organization?.website || '';
    const timeRangeLabel = timeRange === '7d' ? 'Last 7 Days' : 
                         timeRange === '30d' ? 'Last 30 Days' : 
                         timeRange === '90d' ? 'Last 90 Days' : 'All Time';
    const currentYear = now.getFullYear();
    const total = Object.values(data.stats.byStatus).reduce((sum, val) => sum + val, 0);

    // Prepare CSV data with BOM for Excel compatibility
    let csv = '\uFEFF';
    
    // =====================================
    // HEADER SECTION
    // =====================================
    csv += `"${companyName.toUpperCase()}"\n`;
    csv += `"ANALYTICS DASHBOARD REPORT"\n`;
    csv += `\n`;
    
    // Report metadata in structured format
    csv += `"Report Information"\n`;
    csv += `"Field","Value"\n`;
    csv += `"Report ID","${reportId}"\n`;
    csv += `"Report Type","Analytics Dashboard"\n`;
    csv += `"Report Period","${timeRangeLabel}"\n`;
    csv += `"Generated Date","${reportDate}"\n`;
    csv += `"Generated Time","${reportTime}"\n`;
    csv += `"Company","${companyName}"\n`;
    if (companyEmail) csv += `"Contact","${companyEmail}"\n`;
    csv += `\n`;

    // =====================================
    // SECTION 1: KEY PERFORMANCE METRICS
    // =====================================
    csv += `"1. KEY PERFORMANCE METRICS"\n`;
    csv += `"Metric","Value","Unit","Description"\n`;
    csv += `"Total Applications","${data.stats.total}","count","Total number of job applications received"\n`;
    csv += `"Conversion Rate","${data.stats.conversionRate}","%","Percentage of applications resulting in hires"\n`;
    csv += `"Active Pipeline","${data.stats.byStatus.SUBMITTED + data.stats.byStatus.SCREENING + data.stats.byStatus.INTERVIEWING}","count","Applications currently in progress"\n`;
    csv += `"Total Hired","${data.stats.byStatus.HIRED}","count","Successfully hired candidates"\n`;
    csv += `"Rejected","${data.stats.byStatus.REJECTED || 0}","count","Applications that were rejected"\n`;
    csv += `"Interviewing","${data.stats.byStatus.INTERVIEWING || 0}","count","Candidates currently interviewing"\n`;
    csv += `\n`;

    // =====================================
    // SECTION 2: APPLICATION STATUS BREAKDOWN
    // =====================================
    csv += `"2. APPLICATION STATUS BREAKDOWN"\n`;
    csv += `"Status","Count","Percentage","Visual Bar"\n`;
    
    const statusEntries = Object.entries(data.stats.byStatus)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
    
    statusEntries.forEach(([status, count]) => {
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      const barLength = Math.round(parseFloat(percentage) / 5);
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      csv += `"${status}","${count}","${percentage}%","${bar}"\n`;
    });
    csv += `"TOTAL","${total}","100%","████████████████████"\n`;
    csv += `\n`;

    // =====================================
    // SECTION 3: HIRING FUNNEL ANALYSIS
    // =====================================
    csv += `"3. HIRING FUNNEL ANALYSIS"\n`;
    csv += `"Stage","Count","% of Total","Stage Drop-off","Retention Rate"\n`;
    
    const csvFunnelStages = [
      { status: 'SUBMITTED', label: 'Applications Submitted' },
      { status: 'SCREENING', label: 'Under Screening' },
      { status: 'INTERVIEWING', label: 'Interviewing' },
      { status: 'SHORTLISTED', label: 'Shortlisted' },
      { status: 'HIRED', label: 'Hired' },
    ];
    
    let csvPrevCount = total;
    csvFunnelStages.forEach((stage, index) => {
      const count = data.stats.byStatus[stage.status] || 0;
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      // Drop-off from previous stage
      const stageDropOff = index > 0 && csvPrevCount > 0 
        ? (((csvPrevCount - count) / csvPrevCount) * 100).toFixed(1) 
        : '-';
      // Retention rate from total
      const retentionRate = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      csv += `"${stage.label}","${count}","${percentage}%","${index > 0 ? stageDropOff + '%' : '-'}","${retentionRate}%"\n`;
      csvPrevCount = count > 0 ? count : csvPrevCount; // Only update if count > 0
    });
    csv += `\n`;

    // =====================================
    // SECTION 4: TOP JOB POSTINGS
    // =====================================
    if (data.stats.topJobs.length > 0) {
      csv += `"4. TOP PERFORMING JOB POSTINGS"\n`;
      csv += `"Rank","Job Title","Applications","% of Total","Status"\n`;
      data.stats.topJobs.forEach((job, index) => {
        const jobPercentage = total > 0 ? ((job.count / total) * 100).toFixed(1) : '0.0';
        const rank = index + 1;
        csv += `"#${rank}","${job.title.replace(/"/g, '""')}","${job.count}","${jobPercentage}%","Active"\n`;
      });
      csv += `\n`;
    }

    // =====================================
    // SECTION 5: RECENT APPLICATION ACTIVITY
    // =====================================
    if (data.stats.recentActivity.length > 0) {
      csv += `"5. RECENT APPLICATION ACTIVITY (Last 10)"\n`;
      csv += `"#","Candidate Name","Email","Position","Status","Date","Application ID"\n`;
      data.stats.recentActivity.slice(0, 10).forEach((activity, index) => {
        const candidateName = (activity.candidate?.fullName || 'Unknown').replace(/"/g, '""');
        const candidateEmail = activity.candidate?.email || 'N/A';
        const jobTitle = (activity.job?.title || 'Unknown position').replace(/"/g, '""');
        const date = new Date(activity.submittedAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        const appId = activity.id || 'N/A';
        csv += `"${index + 1}","${candidateName}","${candidateEmail}","${jobTitle}","${activity.status}","${date}","${appId}"\n`;
      });
      csv += `\n`;
    }

    // =====================================
    // SECTION 6: EXECUTIVE SUMMARY
    // =====================================
    csv += `"6. EXECUTIVE SUMMARY"\n`;
    csv += `"Category","Details"\n`;
    csv += `"Overview","This analytics report covers ${timeRangeLabel.toLowerCase()} of hiring activity for ${companyName}."\n`;
    csv += `"Total Applications","${data.stats.total} application${data.stats.total !== 1 ? 's' : ''} received across all job postings."\n`;
    csv += `"Conversion Rate","${data.stats.conversionRate}% of applications resulted in successful hires."\n`;
    csv += `"Hiring Success","${data.stats.byStatus.HIRED} candidate${data.stats.byStatus.HIRED !== 1 ? 's' : ''} successfully hired during this period."\n`;
    csv += `"Active Pipeline","${data.stats.byStatus.INTERVIEWING || 0} candidate${(data.stats.byStatus.INTERVIEWING || 0) !== 1 ? 's are' : ' is'} currently in the interviewing stage."\n`;
    if (data.stats.topJobs.length > 0) {
      csv += `"Top Position","${data.stats.topJobs[0].title.replace(/"/g, '""')} received the most applications (${data.stats.topJobs[0].count})."\n`;
    }
    csv += `\n`;

    // =====================================
    // FOOTER SECTION
    // =====================================
    csv += `"REPORT INFORMATION"\n`;
    csv += `"Field","Value"\n`;
    csv += `"Report ID","${reportId}"\n`;
    csv += `"Generated","${reportDate} at ${reportTime}"\n`;
    csv += `"Generated By","${companyName}"\n`;
    if (companyEmail) csv += `"Contact","${companyEmail}"\n`;
    if (companyWebsite) csv += `"Website","${companyWebsite}"\n`;
    csv += `\n`;
    csv += `"DOCUMENT CLASSIFICATION"\n`;
    csv += `"Field","Value"\n`;
    csv += `"Classification","CONFIDENTIAL"\n`;
    csv += `"Distribution","Internal Use Only"\n`;
    csv += `"Copyright","${currentYear} ${companyName}"\n`;
    csv += `"Rights","All Rights Reserved"\n`;
    csv += `\n`;
    csv += `"END OF REPORT"\n`;

    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = `${companyName.replace(/[^a-z0-9]/gi, '_')}_Analytics_Report_${now.toISOString().split('T')[0]}.csv`;
    link.download = fileName;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const StatCard = ({ icon, label, value, trend, color = 'purple' }) => {
    const colorClasses = {
      blue: {
        bg: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10',
        border: 'border-blue-200 dark:border-blue-800',
        iconBg: 'bg-blue-600 dark:bg-blue-600/80',
        text: 'text-blue-900 dark:text-blue-100',
      },
      green: {
        bg: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10',
        border: 'border-green-200 dark:border-green-800',
        iconBg: 'bg-green-600 dark:bg-green-600/80',
        text: 'text-green-900 dark:text-green-100',
      },
      purple: {
        bg: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10',
        border: 'border-purple-200 dark:border-purple-800',
        iconBg: 'bg-purple-600 dark:bg-purple-600/80',
        text: 'text-purple-900 dark:text-purple-100',
      },
      emerald: {
        bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/10',
        border: 'border-emerald-200 dark:border-emerald-800',
        iconBg: 'bg-emerald-600 dark:bg-emerald-600/80',
        text: 'text-emerald-900 dark:text-emerald-100',
      },
    };
    
    const classes = colorClasses[color] || colorClasses.purple;
    
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={`p-6 rounded-xl ${classes.bg} border ${classes.border}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`p-3 rounded-lg ${classes.iconBg}`}>
            <Icon name={icon} className="w-6 h-6 text-white" />
          </div>
          {trend && (
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              trend > 0
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">{label}</p>
        <p className={`text-3xl font-bold ${classes.text}`}>{value}</p>
      </motion.div>
    );
  };

  const StatusPieChart = ({ data }) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    if (total === 0) return null;

    const colors = {
      SUBMITTED: '#3B82F6',
      SCREENING: '#EAB308',
      INTERVIEWING: '#A855F7',
      SHORTLISTED: '#10B981',
      HIRED: '#059669',
      REJECTED: '#6B7280',
    };

    let currentAngle = 0;

    return (
      <div className="flex items-center justify-center gap-8">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {Object.entries(data).map(([status, count], index) => {
            const percentage = (count / total) * 100;
            const angle = (percentage / 100) * 360;
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            const startX = 100 + 80 * Math.cos((currentAngle - 90) * Math.PI / 180);
            const startY = 100 + 80 * Math.sin((currentAngle - 90) * Math.PI / 180);
            const endX = 100 + 80 * Math.cos((currentAngle + angle - 90) * Math.PI / 180);
            const endY = 100 + 80 * Math.sin((currentAngle + angle - 90) * Math.PI / 180);
            
            const path = count > 0 ? `
              M 100 100
              L ${startX} ${startY}
              A 80 80 0 ${largeArcFlag} 1 ${endX} ${endY}
              Z
            ` : '';

            currentAngle += angle;

            return count > 0 ? (
              <path
                key={status}
                d={path}
                fill={colors[status]}
                opacity="0.9"
              />
            ) : null;
          })}
          <circle cx="100" cy="100" r="50" fill="white" className="dark:fill-slate-900" />
          <text x="100" y="100" textAnchor="middle" dy=".3em" fontSize="24" fontWeight="bold" className="fill-gray-900 dark:fill-slate-100">
            {total}
          </text>
          <text x="100" y="120" textAnchor="middle" fontSize="12" className="fill-gray-600 dark:fill-slate-400">
            Total
          </text>
        </svg>

        <div className="space-y-2">
          {Object.entries(data).map(([status, count]) => (
            count > 0 && (
              <div key={status} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: colors[status] }}
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-slate-300">
                    {status}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {count} ({((count / total) * 100).toFixed(0)}%)
                  </p>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <Icon name="AlertCircle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-gray-900 dark:text-slate-100">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Candidate Progress Analytics
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Track candidate journey and hiring metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-[160px] [&_button]:pr-2 [&_button>div]:gap-0.5">
            <Select
              value={timeRange}
              onChange={(value) => setTimeRange(value)}
              options={[
                { label: 'Last 7 days', value: '7d' },
                { label: 'Last 30 days', value: '30d' },
                { label: 'Last 90 days', value: '90d' },
                { label: 'All time', value: 'all' },
              ]}
              placeholder="Select time range"
              className="w-full"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDashboardData}
          >
            <Icon name="RefreshCw" className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="Users"
          label="Total Candidates"
          value={data.stats.total}
          color="blue"
        />
        <StatCard
          icon="TrendingUp"
          label="Conversion Rate"
          value={`${data.stats.conversionRate}%`}
          color="green"
        />
        <StatCard
          icon="Clock"
          label="In Pipeline"
          value={data.stats.byStatus.SUBMITTED + data.stats.byStatus.SCREENING + data.stats.byStatus.INTERVIEWING}
          color="purple"
        />
        <StatCard
          icon="CheckCircle"
          label="Hired"
          value={data.stats.byStatus.HIRED}
          color="emerald"
        />
      </div>

      {/* Application Status Distribution */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
          Application Status Distribution
        </h3>
        <StatusPieChart data={data.stats.byStatus} />
      </div>

      {/* Pipeline Funnel */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
          Hiring Funnel
        </h3>
        <div className="space-y-3">
          {[
            { status: 'SUBMITTED', label: 'Submitted', icon: 'Send', color: 'blue' },
            { status: 'SCREENING', label: 'Screening', icon: 'Eye', color: 'yellow' },
            { status: 'INTERVIEWING', label: 'Interviewing', icon: 'Video', color: 'purple' },
            { status: 'SHORTLISTED', label: 'Shortlisted', icon: 'Star', color: 'green' },
            { status: 'HIRED', label: 'Hired', icon: 'CheckCircle', color: 'emerald' },
          ].map((stage, index) => {
            const count = data.stats.byStatus[stage.status] || 0;
            const percentage = data.stats.total > 0 ? (count / data.stats.total) * 100 : 0;
            
            const stageColorClasses = {
              blue: {
                bg: 'bg-blue-100 dark:bg-blue-900/30',
                icon: 'text-blue-600 dark:text-blue-400',
                gradient: 'bg-gradient-to-r from-blue-400 to-blue-600',
              },
              yellow: {
                bg: 'bg-yellow-100 dark:bg-yellow-900/30',
                icon: 'text-yellow-600 dark:text-yellow-400',
                gradient: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
              },
              purple: {
                bg: 'bg-purple-100 dark:bg-purple-900/30',
                icon: 'text-purple-600 dark:text-purple-400',
                gradient: 'bg-gradient-to-r from-purple-400 to-purple-600',
              },
              green: {
                bg: 'bg-green-100 dark:bg-green-900/30',
                icon: 'text-green-600 dark:text-green-400',
                gradient: 'bg-gradient-to-r from-green-400 to-green-600',
              },
              emerald: {
                bg: 'bg-emerald-100 dark:bg-emerald-900/30',
                icon: 'text-emerald-600 dark:text-emerald-400',
                gradient: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
              },
            };
            
            const stageClasses = stageColorClasses[stage.color] || stageColorClasses.blue;
            
            return (
              <div key={stage.status} className="relative">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${stageClasses.bg}`}>
                    <Icon name={stage.icon} className={`w-5 h-5 ${stageClasses.icon}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {stage.label}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className={`h-full ${stageClasses.gradient}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Jobs */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
          Top Jobs by Applications
        </h3>
        {data.stats.topJobs.length > 0 ? (
          <div className="space-y-3">
            {data.stats.topJobs.map((job, index) => (
              <div
                key={job.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {job.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {job.count} application{job.count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {job.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600 dark:text-slate-400">
            No application data available
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
          Recent Activity
        </h3>
        {data.stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {data.stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                  <Icon name="User" className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {activity.candidate?.fullName || activity.candidate?.email || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                    Applied to {activity.job?.title || 'Unknown position'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activity.status === 'HIRED'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : activity.status === 'REJECTED'
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {activity.status}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    {new Date(activity.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600 dark:text-slate-400">
            No recent activity
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleExportPDF}
          disabled={!data || loading}
        >
          <Icon name="FileText" className="w-4 h-4 mr-2" />
          Export as PDF
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleExportCSV}
          disabled={!data || loading}
        >
          <Icon name="Download" className="w-4 h-4 mr-2" />
          Export as CSV
        </Button>
      </div>
    </div>
  );
};

export default CandidateProgressDashboard;

