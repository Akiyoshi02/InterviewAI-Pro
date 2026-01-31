/**
 * LLM Data Aggregator Component
 * 
 * Combines interview data from multiple sources for LLM training.
 * Features:
 * - Import data from various formats (JSON, CSV, JSONL)
 * - Manual Q&A entry
 * - Data validation and quality scoring
 * - Convert to training format (JSONL)
 * - Export combined dataset
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';

const STORAGE_KEY = 'research_llm_aggregated_data';

const LLMDataAggregator = () => {
  const toast = useToast();
  const [dataSources, setDataSources] = useState([]);
  const [manualEntry, setManualEntry] = useState({
    question: '',
    answer: '',
    jobRole: '',
    category: 'behavioral',
  });
  const [importFormat, setImportFormat] = useState('json');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are an experienced interviewer conducting a professional job interview. Ask relevant questions, provide follow-ups, and assess the candidate\'s responses thoughtfully.'
  );

  // Load saved data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setDataSources(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load aggregated data:', e);
      }
    }
  }, []);

  // Save data
  const saveData = useCallback((data) => {
    setDataSources(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    // Update stats
    const totalQA = data.reduce((sum, source) => sum + source.entries.length, 0);
    localStorage.setItem('research_qa_count', totalQA.toString());
    localStorage.setItem('research_sources_count', data.length.toString());
  }, []);

  // Handle file import
  const handleFileImport = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      let entries = [];

      if (importFormat === 'json') {
        const data = JSON.parse(text);
        // Handle various JSON structures
        if (Array.isArray(data)) {
          entries = data.map(normalizeEntry);
        } else if (data.entries) {
          entries = data.entries.map(normalizeEntry);
        } else if (data.messages) {
          entries = [normalizeEntry(data)];
        }
      } else if (importFormat === 'jsonl') {
        const lines = text.split('\n').filter(line => line.trim());
        entries = lines.map(line => {
          try {
            return normalizeEntry(JSON.parse(line));
          } catch {
            return null;
          }
        }).filter(Boolean);
      } else if (importFormat === 'csv') {
        entries = parseCSV(text);
      }

      if (entries.length === 0) {
        toast.warning('No valid entries found in file');
        return;
      }

      const source = {
        id: Date.now().toString(),
        name: file.name,
        type: importFormat,
        importedAt: new Date().toISOString(),
        entries,
      };

      saveData([...dataSources, source]);
      toast.success(`Imported ${entries.length} entries from ${file.name}`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import file: ' + error.message);
    }

    event.target.value = '';
  }, [importFormat, dataSources, saveData, toast]);

  // Normalize entry to standard format
  const normalizeEntry = (entry) => {
    // Handle different formats
    if (entry.messages) {
      // OpenAI format
      const userMsg = entry.messages.find(m => m.role === 'user');
      const assistantMsg = entry.messages.find(m => m.role === 'assistant');
      return {
        question: userMsg?.content || '',
        answer: assistantMsg?.content || '',
        metadata: entry.metadata || {},
      };
    }
    
    if (entry.question || entry.input) {
      return {
        question: entry.question || entry.input || '',
        answer: entry.answer || entry.response || entry.output || '',
        metadata: {
          jobRole: entry.jobRole || entry.role || entry.job_role || '',
          category: entry.category || entry.type || 'general',
          source: entry.source || '',
        },
      };
    }

    return {
      question: String(entry.q || entry.Q || ''),
      answer: String(entry.a || entry.A || ''),
      metadata: {},
    };
  };

  // Parse CSV
  const parseCSV = (text) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const questionIdx = headers.findIndex(h => 
      h.includes('question') || h.includes('input') || h === 'q'
    );
    const answerIdx = headers.findIndex(h => 
      h.includes('answer') || h.includes('response') || h.includes('output') || h === 'a'
    );

    if (questionIdx === -1 || answerIdx === -1) {
      throw new Error('CSV must have question and answer columns');
    }

    return lines.slice(1).filter(line => line.trim()).map(line => {
      const cols = parseCSVLine(line);
      return {
        question: cols[questionIdx] || '',
        answer: cols[answerIdx] || '',
        metadata: {},
      };
    }).filter(e => e.question && e.answer);
  };

  // Parse CSV line handling quotes
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Add manual entry
  const addManualEntry = useCallback(() => {
    if (!manualEntry.question.trim() || !manualEntry.answer.trim()) {
      toast.warning('Please fill in both question and answer');
      return;
    }

    const entry = {
      question: manualEntry.question.trim(),
      answer: manualEntry.answer.trim(),
      metadata: {
        jobRole: manualEntry.jobRole,
        category: manualEntry.category,
        source: 'manual',
      },
    };

    // Find or create manual entries source
    let sources = [...dataSources];
    let manualSource = sources.find(s => s.name === 'Manual Entries');
    
    if (!manualSource) {
      manualSource = {
        id: 'manual',
        name: 'Manual Entries',
        type: 'manual',
        importedAt: new Date().toISOString(),
        entries: [],
      };
      sources.push(manualSource);
    }
    
    manualSource.entries.push(entry);
    saveData(sources);
    
    setManualEntry({
      question: '',
      answer: '',
      jobRole: manualEntry.jobRole,
      category: manualEntry.category,
    });
    
    toast.success('Entry added!');
  }, [manualEntry, dataSources, saveData, toast]);

  // Convert to training format
  const convertToTrainingFormat = useCallback(() => {
    const allEntries = dataSources.flatMap(source => source.entries);
    
    const trainingData = allEntries.map(entry => ({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: entry.question },
        { role: 'assistant', content: entry.answer },
      ],
      metadata: entry.metadata,
    }));

    return trainingData;
  }, [dataSources, systemPrompt]);

  // Export as JSONL
  const exportAsJSONL = useCallback(() => {
    const trainingData = convertToTrainingFormat();
    const jsonl = trainingData.map(item => JSON.stringify(item)).join('\n');
    
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview_training_data_${new Date().toISOString().split('T')[0]}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${trainingData.length} training examples`);
  }, [convertToTrainingFormat, toast]);

  // Export as JSON
  const exportAsJSON = useCallback(() => {
    const trainingData = convertToTrainingFormat();
    const json = JSON.stringify(trainingData, null, 2);
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview_training_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${trainingData.length} training examples`);
  }, [convertToTrainingFormat, toast]);

  // Delete source
  const deleteSource = (sourceId) => {
    const newSources = dataSources.filter(s => s.id !== sourceId);
    saveData(newSources);
    toast.info('Source deleted');
  };

  // Calculate totals
  const totalEntries = dataSources.reduce((sum, s) => sum + s.entries.length, 0);

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Import */}
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
            Import from File
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                File Format
              </label>
              <div className="flex gap-2">
                {['json', 'jsonl', 'csv'].map(format => (
                  <button
                    key={format}
                    onClick={() => setImportFormat(format)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      importFormat === format
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <input
                type="file"
                accept={`.${importFormat},.txt`}
                onChange={handleFileImport}
                className="hidden"
                id="file-import"
              />
              <label
                htmlFor="file-import"
                className="flex items-center justify-center gap-2 w-full px-4 py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-500 transition-colors"
              >
                <Icon name="Upload" className="w-6 h-6 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  Click to upload {importFormat.toUpperCase()} file
                </span>
              </label>
            </div>

            <div className="text-xs text-gray-500 dark:text-slate-400">
              <p className="font-medium mb-1">Expected formats:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>JSON: Array of objects with question/answer fields</li>
                <li>JSONL: One JSON object per line (OpenAI format supported)</li>
                <li>CSV: Columns with question and answer headers</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Manual Entry */}
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
            Manual Entry
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Job Role
                </label>
                <input
                  type="text"
                  value={manualEntry.jobRole}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, jobRole: e.target.value }))}
                  placeholder="e.g., Software Engineer"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={manualEntry.category}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                >
                  <option value="behavioral">Behavioral</option>
                  <option value="technical">Technical</option>
                  <option value="situational">Situational</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                Interview Question
              </label>
              <textarea
                value={manualEntry.question}
                onChange={(e) => setManualEntry(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Enter the interview question..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                Candidate Answer
              </label>
              <textarea
                value={manualEntry.answer}
                onChange={(e) => setManualEntry(prev => ({ ...prev, answer: e.target.value }))}
                placeholder="Enter the expected/sample answer..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              />
            </div>

            <Button onClick={addManualEntry} className="w-full">
              <Icon name="Plus" className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </div>
      </div>

      {/* System Prompt Configuration */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          System Prompt (for Training)
        </h3>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        />
        <p className="text-xs text-gray-500 mt-2">
          This system prompt will be prepended to all training examples
        </p>
      </div>

      {/* Data Sources */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Data Sources ({dataSources.length})
          </h3>
          <span className="text-sm text-gray-500">
            Total: {totalEntries} Q&A pairs
          </span>
        </div>

        {dataSources.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <Icon name="Database" className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No data sources yet</p>
            <p className="text-sm mt-1">Import files or add entries manually</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {dataSources.map(source => (
              <div
                key={source.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    name={source.type === 'manual' ? 'Edit' : 'FileText'}
                    className="w-5 h-5 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-slate-100">
                      {source.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {source.entries.length} entries • {source.type}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteSource(source.id)}
                  className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                >
                  <Icon name="Trash2" className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          Export Training Data
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={exportAsJSONL}
            disabled={totalEntries === 0}
            variant="primary"
          >
            <Icon name="Download" className="w-4 h-4 mr-2" />
            Export as JSONL (Recommended)
          </Button>
          <Button
            onClick={exportAsJSON}
            disabled={totalEntries === 0}
            variant="outline"
          >
            <Icon name="Download" className="w-4 h-4 mr-2" />
            Export as JSON
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          JSONL format is compatible with OpenAI, Ollama, and most LLM fine-tuning tools
        </p>
      </div>
    </div>
  );
};

export default LLMDataAggregator;
