import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient.js';

const truncate = (str, len = 80) => {
  if (!str || typeof str !== 'string') return '';
  return str.length <= len ? str : str.slice(0, len) + '…';
};

const SavedAnswersPanel = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addForm, setAddForm] = useState({ questionText: '', answer: '', notes: '' });
  const [editForm, setEditForm] = useState({ notes: '', rating: null });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.savedAnswers.list({ limit: 100 });
      if (res.success && Array.isArray(res.savedAnswers)) {
        setList(res.savedAnswers);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load saved answers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleSaveNew = async () => {
    const q = (addForm.questionText || '').trim();
    const a = (addForm.answer || '').trim();
    if (!q || !a) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.savedAnswers.create({
        questionText: q,
        answer: a,
        notes: (addForm.notes || '').trim() || undefined,
      });
      if (res.success && res.savedAnswer) {
        setList((prev) => [res.savedAnswer, ...prev]);
        setAddForm({ questionText: '', answer: '', notes: '' });
        setShowAddForm(false);
        setSaveSuccess('Answer saved successfully.');
        setTimeout(() => setSaveSuccess(''), 3000);
      }
    } catch (err) {
      setError(err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id) => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.savedAnswers.update(id, {
        notes: editForm.notes !== undefined ? editForm.notes : undefined,
        rating: editForm.rating !== undefined && editForm.rating !== null ? editForm.rating : undefined,
      });
      if (res.success && res.savedAnswer) {
        setList((prev) => prev.map((item) => (item.id === id ? res.savedAnswer : item)));
        setEditingId(null);
        setEditForm({ notes: '', rating: null });
        setSaveSuccess('Answer updated.');
        setTimeout(() => setSaveSuccess(''), 3000);
      }
    } catch (err) {
      setError(err?.message || 'Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    setDeletingId(id);
    setError(null);
    try {
      await apiClient.savedAnswers.delete(id);
      setList((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err?.message || 'Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ notes: item.notes || '', rating: item.rating ?? null });
  };

  const filteredList = searchQuery.trim()
    ? list.filter(
        (item) =>
          (item.questionText || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.answer || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : list;

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 sm:mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Personal Answer Library</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
            {list.length} saved answer{list.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconName="Plus"
          iconPosition="left"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 w-full xs:w-auto"
        >
          {showAddForm ? 'Cancel' : 'Add answer'}
        </Button>
      </div>

      {saveSuccess && (
        <div className="mb-3 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-200">
          {saveSuccess}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-2 text-xs text-amber-800 dark:text-amber-200">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="mb-4 rounded-xl border border-blue-200/60 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-900/20 p-3 space-y-3">
          <input
            type="text"
            placeholder="Question (e.g. Tell me about a challenge you faced)"
            value={addForm.questionText}
            onChange={(e) => setAddForm((p) => ({ ...p, questionText: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 p-2 text-sm"
          />
          <textarea
            placeholder="Your answer"
            value={addForm.answer}
            onChange={(e) => setAddForm((p) => ({ ...p, answer: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 p-2 text-sm resize-y"
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={addForm.notes}
            onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 p-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveNew} loading={saving} disabled={saving || !addForm.questionText?.trim() || !addForm.answer?.trim()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {list.length > 3 && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search questions or answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 p-2 text-sm"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-slate-700/60" />
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-600 p-5 text-center">
          <Icon name="BookOpen" size={28} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
          {list.length === 0 ? (
            <>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">No saved answers yet</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Save strong answers from your interviews to build a personal reference library.
              </p>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Add your first answer
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-slate-400">No answers match your search.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 p-3"
            >
              {editingId === item.id ? (
                <div className="space-y-2">
                  <textarea
                    placeholder="Notes"
                    value={editForm.notes}
                    onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 p-2 text-sm resize-y"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(item.id)} loading={saving} disabled={saving}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">
                    {truncate(item.questionText, 60)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">{truncate(item.answer, 120)}</p>
                  {item.notes && (
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-1 italic">{truncate(item.notes, 60)}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {item.savedAt && (
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {new Date(item.savedAt).toLocaleDateString()}
                      </span>
                    )}
                    <div className="flex gap-1 items-center">
                      <button
                        type="button"
                        onClick={() => { setConfirmDeleteId(null); openEdit(item); }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/60 dark:hover:bg-slate-700/60"
                        aria-label="Edit"
                      >
                        <Icon name="Pencil" size={14} />
                      </button>
                      {confirmDeleteId === item.id ? (
                        <div className="flex gap-1 items-center">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="px-2 py-1 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                          >
                            {deletingId === item.id ? '…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/60"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/60 dark:hover:bg-slate-700/60 disabled:opacity-50"
                          aria-label="Delete"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedAnswersPanel;
