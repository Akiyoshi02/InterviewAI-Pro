/**
 * Dataset Downloader Component
 * 
 * Provides access to external interview datasets for LLM training.
 * Features:
 * - Links to Hugging Face datasets
 * - Links to Kaggle datasets
 * - Download instructions
 * - Code snippets for programmatic access
 */

import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';

const HUGGINGFACE_DATASETS = [
  {
    id: 'anthropic-interviewer',
    name: 'Anthropic/AnthropicInterviewer',
    description: '~1,250 interview transcripts across workforce, creatives, and scientists categories',
    size: '4.8k-26.8k chars per transcript',
    format: 'CSV',
    link: 'https://huggingface.co/datasets/Anthropic/AnthropicInterviewer',
    code: `from datasets import load_dataset
dataset = load_dataset("Anthropic/AnthropicInterviewer")
print(dataset)`,
    tags: ['interview', 'transcripts', 'professional'],
  },
  {
    id: 'ali-interviews',
    name: 'ali-alkhars/interviews',
    description: '2,290 interview Q&A pairs covering Angular, TypeScript, and software engineering',
    size: '2,290 rows',
    format: 'JSON',
    link: 'https://huggingface.co/datasets/ali-alkhars/interviews',
    code: `from datasets import load_dataset
dataset = load_dataset("ali-alkhars/interviews")
print(dataset)`,
    tags: ['technical', 'software', 'Q&A'],
  },
  {
    id: 'hr-multiwoz',
    name: 'HR-MultiWOZ',
    description: 'Task-oriented dialogue dataset for HR LLM agents by Amazon Science',
    size: 'Large',
    format: 'JSON',
    link: 'https://amazon.science/code-and-datasets/hr-multiwoz',
    code: `# Download from Amazon Science website
# See link for access instructions`,
    tags: ['HR', 'dialogue', 'task-oriented'],
  },
  {
    id: 'gpt-negochat',
    name: 'msamogh/gpt-negochat',
    description: 'Negotiation dialogues that can be adapted for interview scenarios',
    size: 'Medium',
    format: 'JSON',
    link: 'https://huggingface.co/datasets/msamogh/gpt-negochat',
    code: `from datasets import load_dataset
dataset = load_dataset("msamogh/gpt-negochat")
print(dataset)`,
    tags: ['negotiation', 'dialogue'],
  },
];

const KAGGLE_DATASETS = [
  {
    id: 'se-interview',
    name: 'Software Engineering Interview Questions',
    description: '250 comprehensive questions covering algorithms, system design, ML, data structures',
    size: '250 Q&A pairs',
    format: 'CSV',
    link: 'https://kaggle.com/datasets/syedmharis/software-engineering-interview-questions-dataset',
    difficulty: 'Hard (FAANG-level)',
    tags: ['technical', 'algorithms', 'system-design'],
  },
  {
    id: 'coding-questions',
    name: 'Coding Questions with Solutions',
    description: 'Python-focused interview problems with detailed solutions and test cases',
    size: '5,000+ problems',
    format: 'CSV/JSON',
    link: 'https://kaggle.com/datasets/thedevastator/coding-questions-with-solutions',
    difficulty: 'Intro to Competition',
    tags: ['coding', 'python', 'problems'],
  },
];

const POSTURE_DATASETS = [
  {
    id: 'multi-gait',
    name: 'Multi-Camera Posture and Gait Dataset',
    description: '166K frames of synchronized video with skeleton ground-truth from motion capture',
    size: '92 minutes, 14 participants',
    format: 'Video + JSON',
    link: 'https://physionet.org/content/multi-gait-posture/',
    tags: ['posture', 'gait', 'skeleton'],
  },
  {
    id: 'polar',
    name: 'POLAR Dataset',
    description: '35,324 images across 9 posture categories (sitting, standing, bending, etc.)',
    size: '35,324 images',
    format: 'Images',
    link: 'https://data.mendeley.com/datasets/hvnsh7rwz7/1',
    tags: ['posture', 'classification', 'images'],
  },
  {
    id: 'mpii',
    name: 'MPII Human Pose Dataset',
    description: '25,000 images with 40,000+ annotated people, 410 different activities',
    size: '25,000 images',
    format: 'Images + Annotations',
    link: 'https://www.mpi-inf.mpg.de/departments/computer-vision-and-machine-learning/software-and-datasets/mpii-human-pose-dataset',
    tags: ['pose', 'benchmark', 'activities'],
  },
];

const DatasetDownloader = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('huggingface');
  const [expandedDataset, setExpandedDataset] = useState(null);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const openLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderDatasetCard = (dataset, type) => (
    <div
      key={dataset.id}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden"
    >
      <div
        className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setExpandedDataset(expandedDataset === dataset.id ? null : dataset.id)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-slate-100">
              {dataset.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {dataset.description}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {dataset.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <Icon
            name={expandedDataset === dataset.id ? 'ChevronUp' : 'ChevronDown'}
            className="w-5 h-5 text-slate-400 ml-2"
          />
        </div>
      </div>

      {expandedDataset === dataset.id && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-slate-400">Size:</span>
              <span className="ml-2 text-gray-900 dark:text-slate-100">{dataset.size}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-slate-400">Format:</span>
              <span className="ml-2 text-gray-900 dark:text-slate-100">{dataset.format}</span>
            </div>
            {dataset.difficulty && (
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-slate-400">Difficulty:</span>
                <span className="ml-2 text-gray-900 dark:text-slate-100">{dataset.difficulty}</span>
              </div>
            )}
          </div>

          {dataset.code && (
            <div className="relative">
              <pre className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs overflow-x-auto">
                <code>{dataset.code}</code>
              </pre>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyCode(dataset.code);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                <Icon name="Copy" className="w-4 h-4" />
              </button>
            </div>
          )}

          <Button
            onClick={(e) => {
              e.stopPropagation();
              openLink(dataset.link);
            }}
            variant="primary"
            size="sm"
            className="w-full"
          >
            <Icon name="ExternalLink" className="w-4 h-4 mr-2" />
            Open Dataset Page
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
        <div className="flex items-start gap-3">
          <Icon name="Info" className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200">
              How to Use External Datasets
            </h4>
            <ol className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-decimal list-inside">
              <li>Click on a dataset to see download options and code</li>
              <li>Download the dataset from the external source</li>
              <li>Go to "LLM Data Aggregator" tab to import the downloaded data</li>
              <li>Combine with other sources and export for training</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-6">
          {[
            { id: 'huggingface', label: 'Hugging Face', icon: 'Database' },
            { id: 'kaggle', label: 'Kaggle', icon: 'BarChart2' },
            { id: 'posture', label: 'Posture/Body', icon: 'User' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
              }`}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'huggingface' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Hugging Face Datasets
              </h3>
              <span className="text-sm text-gray-500">
                {HUGGINGFACE_DATASETS.length} datasets
              </span>
            </div>
            <div className="grid gap-4">
              {HUGGINGFACE_DATASETS.map(ds => renderDatasetCard(ds, 'huggingface'))}
            </div>
            
            {/* Python setup instructions */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-2">
                Setup Instructions
              </h4>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                To download Hugging Face datasets, you need Python with the datasets library:
              </p>
              <div className="relative">
                <pre className="p-3 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs overflow-x-auto">
                  <code>{`# Install the datasets library
pip install datasets

# Download and save a dataset
from datasets import load_dataset
dataset = load_dataset("Anthropic/AnthropicInterviewer")
dataset.to_json("anthropic_interviews.json")`}</code>
                </pre>
                <button
                  onClick={() => copyCode(`pip install datasets

from datasets import load_dataset
dataset = load_dataset("Anthropic/AnthropicInterviewer")
dataset.to_json("anthropic_interviews.json")`)}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
                >
                  <Icon name="Copy" className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'kaggle' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Kaggle Datasets
              </h3>
              <span className="text-sm text-gray-500">
                {KAGGLE_DATASETS.length} datasets
              </span>
            </div>
            <div className="grid gap-4">
              {KAGGLE_DATASETS.map(ds => renderDatasetCard(ds, 'kaggle'))}
            </div>

            {/* Kaggle setup */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-2">
                Kaggle Download Options
              </h4>
              <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-2">
                <li className="flex items-start gap-2">
                  <Icon name="Download" className="w-4 h-4 mt-0.5 text-blue-600" />
                  <span><strong>Direct Download:</strong> Click the dataset link, sign in to Kaggle, and click "Download"</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon name="Terminal" className="w-4 h-4 mt-0.5 text-blue-600" />
                  <span><strong>Kaggle CLI:</strong> Use <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">kaggle datasets download -d username/dataset-name</code></span>
                </li>
              </ul>
            </div>
          </>
        )}

        {activeTab === 'posture' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Posture & Body Language Datasets
              </h3>
              <span className="text-sm text-gray-500">
                {POSTURE_DATASETS.length} datasets
              </span>
            </div>
            <div className="grid gap-4">
              {POSTURE_DATASETS.map(ds => renderDatasetCard(ds, 'posture'))}
            </div>

            {/* Note about posture datasets */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <div className="flex items-start gap-3">
                <Icon name="AlertTriangle" className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">
                    Note on Posture Datasets
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    These datasets provide reference data for general posture analysis. For your specific research,
                    it's recommended to also record your own reference videos using the Video Recorder tool,
                    as they will be more specific to interview scenarios.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Web Sources */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          Additional Web Sources for Manual Collection
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: 'Glassdoor', url: 'https://glassdoor.com', desc: 'Real interview questions by company' },
            { name: 'Indeed', url: 'https://indeed.com', desc: 'Interview questions by job title' },
            { name: 'InterviewBit', url: 'https://interviewbit.com', desc: 'Technical interview Q&A' },
            { name: 'LeetCode', url: 'https://leetcode.com', desc: 'Coding interview problems' },
            { name: 'GeeksforGeeks', url: 'https://geeksforgeeks.org', desc: 'Technical Q&A with explanations' },
            { name: 'Blind', url: 'https://teamblind.com', desc: 'Real interview experiences' },
          ].map(source => (
            <button
              key={source.name}
              onClick={() => openLink(source.url)}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 text-left transition-colors"
            >
              <Icon name="ExternalLink" className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-slate-100">
                  {source.name}
                </div>
                <div className="text-xs text-gray-500">{source.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DatasetDownloader;
