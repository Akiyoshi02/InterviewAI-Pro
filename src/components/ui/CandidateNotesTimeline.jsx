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
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50',
  green: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/50',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/50',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/50',
  gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

const LS_KEY = (applicationId) => `candidateNotes_${applicationId}`;

const CandidateNotesTimeline = ({ applicationId, candidateName, applicationStatus, interviewHistory = [] }) => {
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  // Load notes from localStorage (client-side persistence)
  useEffect(() => {
    if (!applicationId) return;
    try {
      const stored = localStorage.getItem(LS_KEY(applicationId));
      if (stored) setNotes(JSON.parse(stored));
      else {
        // Pre-populate with auto-generated activity from application data
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
        if (interviewHistory.length > 0) {
          interviewHistory.forEach((iv, i) => {
            autoEvents.push({
              id: `auto_iv_${i}`,
              type: 'interview',
              text: `Interview session${iv.status ? ` – ${iv.status}` : ''}${iv.scheduledFor ? ` on ${new Date(iv.scheduledFor).toLocaleDateString()}` : ''}`,
              author: 'System',
              createdAt: iv.scheduledFor || iv.createdAt || new Date().toISOString(),
              auto: true,
            });
          });
        }
        setNotes(autoEvents);
      }
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
    const updated = [newNote, ...notes];
    persistNotes(updated);
    setNoteText('');
    setSaving(false);
  };

  const handleEdit = (note) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const handleSaveEdit = (id) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, text: editText } : n));
    persistNotes(updated);
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = (id) => {
    const updated = notes.filter((n) => n.id !== id);
    persistNotes(updated);
  };

  const formatRelativeTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const typeConfig = (type) => NOTE_TYPES.find((t) => t.value === type) || NOTE_TYPES[0];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
        <Icon name="Activity" size={15} className="text-blue-500" />
        Activity Timeline
        {candidateName && <span className="text-gray-500 font-normal">– {candidateName}</span>}
      </h3>

      {/* Add Note */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-3 space-y-2 bg-gray-50/50 dark:bg-slate-900/30">
        <div className="flex gap-2">
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {NOTE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
            placeholder="Add a note... (Ctrl+Enter to save)"
            rows={2}
            className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="primary"
            onClick={handleAddNote}
            disabled={!noteText.trim() || saving}
            iconName="Plus"
          >
            Add Note
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {notes.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">No activity recorded yet.</p>
      ) : (
        <div className="relative pl-6">
          {/* Timeline line */}
          <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />

          <div className="space-y-3">
            <AnimatePresence>
              {notes.map((note) => {
                const tConf = typeConfig(note.type);
                const colorClass = COLOR_MAP[tConf.color] || COLOR_MAP.gray;
                return (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="relative"
                  >
                    {/* Dot */}
                    <div className={`absolute -left-4 top-2 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-800 ${colorClass}`}>
                      <Icon name={tConf.icon} size={8} />
                    </div>

                    <div className={`rounded-xl border p-3 ${note.auto ? 'bg-gray-50/50 dark:bg-slate-900/20' : 'bg-white dark:bg-slate-800'} ${colorClass}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {editingId === note.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="primary" onClick={() => handleSaveEdit(note.id)}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-800 dark:text-slate-200">{note.text}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{note.author}</span>
                            <span className="text-gray-300 dark:text-slate-600">·</span>
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
