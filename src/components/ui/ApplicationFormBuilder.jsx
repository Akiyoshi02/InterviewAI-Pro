import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL / Link' },
  { value: 'file', label: 'File Upload' },
];

const DEFAULT_FIELD = { id: '', label: '', type: 'text', required: false, options: [], placeholder: '' };

const generateId = () => `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const ApplicationFormBuilder = ({ fields = [], onChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(DEFAULT_FIELD);
  const [optionInput, setOptionInput] = useState('');

  const handleAdd = () => {
    const newField = { ...DEFAULT_FIELD, id: generateId() };
    setEditForm(newField);
    setEditingId('__new__');
  };

  const handleEdit = (field) => {
    setEditForm({ ...field });
    setEditingId(field.id);
  };

  const handleSave = () => {
    if (!editForm.label.trim()) return;
    let updatedFields;
    if (editingId === '__new__') {
      updatedFields = [...fields, { ...editForm, id: generateId() }];
    } else {
      updatedFields = fields.map((f) => (f.id === editingId ? { ...editForm } : f));
    }
    onChange?.(updatedFields);
    setEditingId(null);
    setEditForm(DEFAULT_FIELD);
    setOptionInput('');
  };

  const handleDelete = (id) => {
    onChange?.(fields.filter((f) => f.id !== id));
    if (editingId === id) { setEditingId(null); setEditForm(DEFAULT_FIELD); }
  };

  const moveField = (index, direction) => {
    const newFields = [...fields];
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= newFields.length) return;
    [newFields[index], newFields[swapIdx]] = [newFields[swapIdx], newFields[index]];
    onChange?.(newFields);
  };

  const addOption = () => {
    const val = optionInput.trim();
    if (!val) return;
    setEditForm((p) => ({ ...p, options: [...(p.options || []), val] }));
    setOptionInput('');
  };

  const removeOption = (idx) => {
    setEditForm((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Icon name="FormInput" size={16} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Custom Application Form
          </span>
          {fields.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {fields.length} field{fields.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-gray-400" />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100 dark:border-slate-700"
          >
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Add custom questions or fields to your application form. Candidates will see these alongside the standard fields.
              </p>

              {/* Field List */}
              {fields.length > 0 && (
                <div className="space-y-2">
                  {fields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveField(idx, -1)}
                          disabled={idx === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <Icon name="ChevronUp" size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(idx, 1)}
                          disabled={idx === fields.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <Icon name="ChevronDown" size={12} />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">
                          {FIELD_TYPES.find((t) => t.value === field.type)?.label || field.type}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(field)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Icon name="Pencil" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(field.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Icon name="Trash2" size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Field Editor */}
              <AnimatePresence>
                {editingId && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/30 dark:bg-indigo-900/10 p-4 space-y-3"
                  >
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {editingId === '__new__' ? 'Add Field' : 'Edit Field'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                          Label <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.label}
                          onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))}
                          placeholder="e.g. LinkedIn Profile URL"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Field Type</label>
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value, options: [] }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Placeholder</label>
                        <input
                          type="text"
                          value={editForm.placeholder}
                          onChange={(e) => setEditForm((p) => ({ ...p, placeholder: e.target.value }))}
                          placeholder="Optional hint text"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <input
                          type="checkbox"
                          id="field-required"
                          checked={editForm.required}
                          onChange={(e) => setEditForm((p) => ({ ...p, required: e.target.checked }))}
                          className="w-4 h-4 rounded-full border-gray-300 text-indigo-600"
                        />
                        <label htmlFor="field-required" className="text-sm text-gray-700 dark:text-slate-300">Required field</label>
                      </div>
                    </div>

                    {/* Dropdown options */}
                    {editForm.type === 'select' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Options</label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={optionInput}
                            onChange={(e) => setOptionInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                            placeholder="Add option and press Enter"
                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <Button type="button" size="sm" variant="outline" onClick={addOption}>Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(editForm.options || []).map((opt, i) => (
                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-xs text-gray-700 dark:text-slate-300">
                              {opt}
                              <button type="button" onClick={() => removeOption(i)} className="text-gray-400 hover:text-red-500">
                                <Icon name="X" size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingId(null); setEditForm(DEFAULT_FIELD); }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={handleSave}
                        disabled={!editForm.label.trim()}
                        className="flex-1"
                      >
                        {editingId === '__new__' ? 'Add Field' : 'Save Changes'}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!editingId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  iconName="Plus"
                  onClick={handleAdd}
                  className="w-full border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                >
                  Add Custom Field
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApplicationFormBuilder;
