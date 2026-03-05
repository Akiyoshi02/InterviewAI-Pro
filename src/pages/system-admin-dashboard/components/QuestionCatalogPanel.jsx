import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import { ADMIN_FEED_EVENTS } from '../../../constants/realtimeFeedEvents.js';

const REVIEW_STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED'];
const SOURCE_FILTER_OPTIONS = ['ALL', 'INTERNAL', 'EXTERNAL'];
const TYPE_FILTER_OPTIONS = ['ALL', 'BEHAVIORAL', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN', 'CASE_STUDY'];

const QuestionCatalogPanel = () => {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [sources, setSources] = useState([]);
  const [imports, setImports] = useState([]);
  const [questions, setQuestions] = useState([]);

  const [selectedSourceKey, setSelectedSourceKey] = useState('');
  const [importDryRun, setImportDryRun] = useState(true);
  const [importApprove, setImportApprove] = useState(false);
  const [batchLabel, setBatchLabel] = useState('admin-ui');

  const [filterReviewStatus, setFilterReviewStatus] = useState('PENDING');
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(new Set());
  const refreshTimeoutRef = useRef(null);
  const loadDataRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [sourceResponse, importResponse, questionResponse] = await Promise.all([
        apiClient.admin.getQuestionCatalogSources(false),
        apiClient.admin.getQuestionCatalogImports(50),
        apiClient.admin.getQuestionCatalogQuestions({
          reviewStatus: filterReviewStatus !== 'ALL' ? filterReviewStatus : undefined,
          source: filterSource !== 'ALL' ? filterSource : undefined,
          type: filterType !== 'ALL' ? filterType : undefined,
          limit: 500,
        }),
      ]);

      if (!sourceResponse.success) {
        throw new Error(sourceResponse.error || 'Failed to load dataset sources.');
      }
      if (!importResponse.success) {
        throw new Error(importResponse.error || 'Failed to load import history.');
      }
      if (!questionResponse.success) {
        throw new Error(questionResponse.error || 'Failed to load catalog questions.');
      }

      const nextSources = Array.isArray(sourceResponse.sources) ? sourceResponse.sources : [];
      setSources(nextSources);
      setImports(Array.isArray(importResponse.imports) ? importResponse.imports : []);
      setQuestions(Array.isArray(questionResponse.questions) ? questionResponse.questions : []);

      if (!selectedSourceKey && nextSources.length > 0) {
        setSelectedSourceKey(nextSources[0].key);
      }
    } catch (loadError) {
      setError(loadError.message || 'Failed to load question catalog data.');
    } finally {
      setLoading(false);
    }
  }, [filterReviewStatus, filterSource, filterType, selectedSourceKey]);

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    eventTypes: ADMIN_FEED_EVENTS.datasets,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        loadDataRef.current?.();
      }, 350);
    },
  });

  useEffect(() => {
    loadData();
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [loadData]);

  const visibleQuestions = useMemo(() => questions, [questions]);

  const updateSelection = (questionId, checked) => {
    setSelectedQuestionIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(questionId);
      } else {
        next.delete(questionId);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!selectedSourceKey) {
      setError('Select a source before importing.');
      return;
    }

    try {
      setImporting(true);
      setError('');
      setNotice('');
      const result = await apiClient.admin.importQuestionCatalogSource({
        sourceKey: selectedSourceKey,
        dryRun: importDryRun,
        approve: importApprove,
        batchLabel: batchLabel || 'admin-ui',
      });

      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }

      const importedCount = result?.result?.importedQuestions ?? 0;
      setNotice(importDryRun
        ? `Dry run complete. Parsed ${importedCount} questions from ${selectedSourceKey}.`
        : `Import complete. Imported ${importedCount} questions from ${selectedSourceKey}.`);
      await loadData();
    } catch (importError) {
      setError(importError.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const applyReviewStatus = async (reviewStatus, explicitIds = null) => {
    const ids = explicitIds && explicitIds.length
      ? explicitIds
      : Array.from(selectedQuestionIds);
    if (!ids.length) {
      setError('Select at least one question first.');
      return;
    }

    try {
      setError('');
      setNotice('');
      const primaryId = ids[0];
      const response = await apiClient.admin.reviewQuestionCatalogQuestion(primaryId, {
        reviewStatus,
        questionIds: ids,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update review status.');
      }
      setNotice(`Updated ${ids.length} question(s) to ${reviewStatus}.`);
      setSelectedQuestionIds(new Set());
      await loadData();
    } catch (reviewError) {
      setError(reviewError.message || 'Failed to update review status.');
    }
  };

  const handleRefreshCache = async () => {
    try {
      setRefreshingCache(true);
      setError('');
      setNotice('');
      const response = await apiClient.admin.refreshQuestionCatalogCache();
      if (!response.success) {
        throw new Error(response.error || 'Failed to refresh cache');
      }
      setNotice(`Catalog cache refreshed (${response.source || 'unknown source'}).`);
      await loadData();
    } catch (cacheError) {
      setError(cacheError.message || 'Failed to refresh cache.');
    } finally {
      setRefreshingCache(false);
    }
  };

  if (loading && !sources.length && !questions.length) {
    return (
      <LoadingState
        title="Loading Question Catalog"
        message="Syncing sources, imports, and review queue."
        variant="card"
        tone="secondary"
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-300/70 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-green-300/70 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800/60 dark:bg-green-950/30 dark:text-green-300">
          {notice}
        </div>
      )}

      <div className="rounded-xl border border-gray-200/80 bg-white/85 p-4 dark:border-slate-700/70 dark:bg-slate-900/45">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Import Dataset Source</h3>
          <Button size="sm" variant="outline" onClick={handleRefreshCache} loading={refreshingCache}>
            Refresh Cache
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Source</label>
            <select
              value={selectedSourceKey}
              onChange={(event) => setSelectedSourceKey(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {sources.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.sourceName} ({source.license || 'N/A'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Batch Label</label>
            <input
              value={batchLabel}
              onChange={(event) => setBatchLabel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 mt-6">
            <input type="checkbox" checked={importDryRun} onChange={(event) => setImportDryRun(event.target.checked)} />
            Dry run
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 mt-6">
            <input type="checkbox" checked={importApprove} onChange={(event) => setImportApprove(event.target.checked)} />
            Approve on import
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={handleImport} loading={importing}>
            Run Import
          </Button>
          <Button size="sm" variant="ghost" onClick={loadData} disabled={importing || refreshingCache}>
            Reload
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white/85 p-4 dark:border-slate-700/70 dark:bg-slate-900/45">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Catalog Review Queue</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Review Status</label>
            <select
              value={filterReviewStatus}
              onChange={(event) => setFilterReviewStatus(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="ALL">ALL</option>
              {REVIEW_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Source</label>
            <select
              value={filterSource}
              onChange={(event) => setFilterSource(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {SOURCE_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Type</label>
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {TYPE_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => applyReviewStatus('APPROVED')}>
            Bulk Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyReviewStatus('REJECTED')}>
            Bulk Reject
          </Button>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Selected: {selectedQuestionIds.size} / Showing: {visibleQuestions.length}
          </span>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-slate-400">
                <th className="py-2 pr-3">Sel</th>
                <th className="py-2 pr-3">Prompt</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">License</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuestions.map((question) => (
                <tr key={question.id} className="border-t border-gray-200 dark:border-slate-700/60 align-top">
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.has(question.id)}
                      onChange={(event) => updateSelection(question.id, event.target.checked)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <p className="text-gray-900 dark:text-slate-100 leading-snug">{question.prompt}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">ID: {question.id}</p>
                  </td>
                  <td className="py-2 pr-3">{question.type}</td>
                  <td className="py-2 pr-3">{question.reviewStatus || (question.approved ? 'APPROVED' : 'PENDING')}</td>
                  <td className="py-2 pr-3">{question.source || 'N/A'}</td>
                  <td className="py-2 pr-3">
                    <span>{question.license || 'N/A'}</span>
                    {question.licenseUrl ? (
                      <a
                        href={question.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 inline-flex text-blue-600 dark:text-blue-400"
                        title="Open license"
                      >
                        <Icon name="ExternalLink" className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applyReviewStatus('APPROVED', [question.id])}
                        className="rounded border border-green-400/70 px-2 py-1 text-xs text-green-700 dark:text-green-300"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => applyReviewStatus('REJECTED', [question.id])}
                        className="rounded border border-red-400/70 px-2 py-1 text-xs text-red-700 dark:text-red-300"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleQuestions.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500 dark:text-slate-400" colSpan={7}>
                    No questions found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white/85 p-4 dark:border-slate-700/70 dark:bg-slate-900/45">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Import History</h3>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-slate-400">
                <th className="py-2 pr-3">Batch</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Imported</th>
                <th className="py-2 pr-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((entry) => (
                <tr key={entry.id} className="border-t border-gray-200 dark:border-slate-700/60">
                  <td className="py-2 pr-3">{entry.batchLabel || entry.id}</td>
                  <td className="py-2 pr-3">{entry.sourceName || entry.sourceKey}</td>
                  <td className="py-2 pr-3">{entry.status}</td>
                  <td className="py-2 pr-3">{entry.stats?.importedQuestions ?? 0}</td>
                  <td className="py-2 pr-3">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500 dark:text-slate-400" colSpan={5}>
                    No import batches recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuestionCatalogPanel;
