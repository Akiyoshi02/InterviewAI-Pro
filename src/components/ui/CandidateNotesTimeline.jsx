import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';

const NOTE_TYPES = [
  { value: 'note', label: 'Note', icon: 'StickyNote', color: 'blue' },
  { value: 'call', label: 'Call', icon: 'Phone', color: 'green' },
  { value: 'email', label: 'Email', icon: 'Mail', color: 'purple' },
  { value: 'interview', label: 'Interview', icon: 'Video', color: 'indigo' },
  { value: 'status_change', label: 'Status Change', icon: 'RefreshCw', color: 'orange' },
];

const COLOR_MAP = {
  blue: {
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50',
    dot: 'text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700/50',
  },
  green: {
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50',
    dot: 'text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50',
  },
  purple: {
    badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/50',
    dot: 'text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-700/50',
  },
  indigo: {
    badge: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/50',
    dot: 'text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/50',
  },
  orange: {
    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/50',
    dot: 'text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-700/50',
  },
  gray: {
    badge: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    dot: 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
};

const LS_KEY = (applicationId) => `candidateNotes_${applicationId}`;

const CandidateNotesTimeline = ({ applicationId, candidateName, applicationStatus, interviewHistory = null }) => {
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (!applicationId) return;
    const history = Array.isArray(interviewHistory) ? interviewHistory : [];

    try {
      const stored = localStorage.getItem(LS_KEY(applicationId));
      if (stored) {
        setNotes(JSON.parse(stored));
        return;
      }

      const autoEvents = [];
      if (applicationStatus) {
        autoEvents.push({
          id: 'auto_status',
          type: 'status_change',
          text: `Application status: ${applicationStatus.replace(/_/g, ' ')}`,
          author: 'System',
          createdAt: new Date().toISOString(),
          auto: true,
        });
      }

      if (history.length > 0) {
        history.forEach((interview, index) => {
          autoEvents.push({
            id: `auto_iv_${index}`,
            type: 'interview',
            text: `Interview session${interview.status ? ` - ${interview.status}` : ''}${interview.scheduledFor ? ` on ${new Date(interview.scheduledFor).toLocaleDateString()}` : ''}`,
            author: 'System',
            createdAt: interview.scheduledFor || interview.createdAt || new Date().toISOString(),
            auto: true,
          });
        });
      }

      setNotes(autoEvents);
    } catch {
      setNotes([]);
    }
  }, [applicationId, applicationStatus, interviewHistory]);

  const persistNotes = (updatedNotes) => {
    if (!applicationId) return;
    localStorage.setItem(LS_KEY(applicationId), JSON.stringify(updatedNotes));
    setNotes(updatedNotes);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;

    setSaving(true);
    const newNote = {
      id: `note_${Date.now()}`,
      type: noteType,
      text: noteText.trim(),
      author: 'You',
      createdAt: new Date().toISOString(),
    };

    persistNotes([newNote, ...notes]);
    setNoteText('');
    setSaving(false);
  };

  const handleEdit = (note) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const handleSaveEdit = (id) => {
    const updated = notes.map((entry) => (entry.id === id ? { ...entry, text: editText } : entry));
    persistNotes(updated);
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = (id) => {
    const updated = notes.filter((entry) => entry.id !== id);
    persistNotes(updated);
  };

  const formatRelativeTime = (isoValue) => {
    const date = new Date(isoValue);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const typeConfig = (type) => NOTE_TYPES.find((entry) => entry.value === type) || NOTE_TYPES[0];

  return (
    <div className="space-y-4">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
        <Icon name="Activity" size={15} className="text-blue-500" />
        Activity Timeline
        {candidateName && (
          <span className="min-w-0 break-words text-gray-500 font-normal">
            - {candidateName}
          </span>
        )}
      </h3>

      <div
        data-testid="candidate-notes-composer"
        className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/30"
      >
        <div
          data-testid="candidate-notes-composer-row"
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div
            data-testid="candidate-note-type-wrapper"
            className="relative w-full shrink-0 sm:w-32"
          >
            <select
              value={noteType}
              onChange={(event) => setNoteType(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 py-1.5 pl-3 pr-8 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {NOTE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-gray-500 dark:text-slate-400">
              <Icon name="ChevronDown" size={14} />
            </span>
          </div>

          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                handleAddNote();
              }
            }}
            placeholder="Add a note... (Ctrl+Enter to save)"
            rows={1}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            className="h-12 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 sm:h-10 sm:flex-1"
          />

          <Button
            size="sm"
            variant="default"
            onClick={handleAddNote}
            disabled={!noteText.trim() || saving}
            iconName="Plus"
            className="w-full justify-center sm:w-auto"
          >
            Add Note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">No activity recorded yet.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />

          <div className="space-y-3">
            <AnimatePresence>
              {notes.map((note) => {
                const config = typeConfig(note.type);
                const colorClass = COLOR_MAP[config.color] || COLOR_MAP.gray;

                return (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="relative pl-7"
                  >
                    <div className={`absolute left-3.5 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-800 ${colorClass.dot}`}>
                      <Icon name={config.icon} size={8} />
                    </div>

                    <div className={`rounded-xl border p-3 ${note.auto ? 'bg-gray-50/60 dark:bg-slate-900/20' : 'bg-white dark:bg-slate-800'} border-gray-200 dark:border-slate-700`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1.5">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${colorClass.badge}`}>
                              <Icon name={config.icon} size={10} />
                              {config.label}
                            </span>
                          </div>

                          {editingId === note.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                value={editText}
                                onChange={(event) => setEditText(event.target.value)}
                                rows={2}
                                data-gramm="false"
                                data-gramm_editor="false"
                                data-enable-grammarly="false"
                                className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="default" onClick={() => handleSaveEdit(note.id)}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-800 dark:text-slate-200">{note.text}</p>
                          )}

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{note.author}</span>
                            <span className="text-gray-300 dark:text-slate-600">|</span>
                            <span className="text-xs text-gray-400 dark:text-slate-500">{formatRelativeTime(note.createdAt)}</span>
                          </div>
                        </div>

                        {!note.auto && editingId !== note.id && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEdit(note)}
                              className="p-1 rounded text-gray-400 hover:text-blue-500"
                            >
                              <Icon name="Pencil" size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(note.id)}
                              className="p-1 rounded text-gray-400 hover:text-red-500"
                            >
                              <Icon name="Trash2" size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateNotesTimeline;
