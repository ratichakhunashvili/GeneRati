'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import { isPastDate } from '@/lib/format';
import { matchTemplate } from '@/lib/templates';

const EMPTY = { title: '', date: '', time: '', location: '' };

const FIELDS = [
  { name: 'title', label: 'Activity title', type: 'text', placeholder: 'e.g. Football Tournament' },
  { name: 'date', label: 'Date', type: 'date', placeholder: '' },
  { name: 'time', label: 'Time', type: 'time', placeholder: '' },
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Main Stadium' },
];

export default function ActivityForm({ onAdd, templates = [] }) {
  const fieldId = useId();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  // 'auto' matches a template by keyword; 'builtin' uses the generated designs.
  const [templateId, setTemplateId] = useState('auto');

  const update = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    // Clear the error as soon as the field is being corrected.
    setErrors((current) => (current[name] ? { ...current, [name]: null } : current));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = {};
    for (const field of FIELDS) {
      if (!values[field.name].trim()) nextErrors[field.name] = 'Required';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onAdd({
      title: values.title.trim(),
      date: values.date,
      time: values.time,
      location: values.location.trim(),
      templateId: templates.length > 0 ? templateId : 'builtin',
    });
    setValues(EMPTY);
    setErrors({});
  };

  const showPastWarning = values.date && isPastDate(values.date);
  // Show which template "Auto" would actually land on, so the choice is visible
  // before the activity is created rather than a surprise at generation time.
  const autoMatch = templateId === 'auto' ? matchTemplate(templates, values.title) : null;

  return (
    // noValidate so our own messages show instead of the browser's, which are
    // inconsistent across browsers and untranslatable.
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {FIELDS.map((field) => {
        const id = `${fieldId}-${field.name}`;
        const errorId = `${id}-error`;
        const hasError = Boolean(errors[field.name]);

        return (
          <div key={field.name}>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
              {field.label}
            </label>
            <input
              id={id}
              name={field.name}
              type={field.type}
              value={values[field.name]}
              placeholder={field.placeholder}
              onChange={(event) => update(field.name, event.target.value)}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : undefined}
              className={`w-full rounded-lg border px-4 py-2 text-gray-900 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {hasError && (
              <p id={errorId} className="mt-1 text-sm text-red-600">
                {errors[field.name]}
              </p>
            )}
          </div>
        );
      })}

      <div>
        <label htmlFor={`${fieldId}-template`} className="mb-1.5 block text-sm font-medium text-gray-700">
          Poster design
        </label>
        {templates.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            Using the built-in designs.{' '}
            <Link href="/templates" className="font-semibold text-blue-700 underline">
              Add your own templates
            </Link>{' '}
            to use your designs instead.
          </p>
        ) : (
          <>
            <select
              id={`${fieldId}-template`}
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="auto">Auto — match my templates by keyword</option>
              <option value="builtin">Built-in designs (3 variations)</option>
              <optgroup label="My templates">
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {templateId === 'auto'
                ? autoMatch
                  ? `Matches “${autoMatch.name}”.`
                  : values.title.trim()
                    ? 'No keyword match yet — the built-in designs will be used.'
                    : 'Matched from the title once you type it.'
                : ' '}
            </p>
          </>
        )}
      </div>

      {showPastWarning && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          That date is in the past. You can still create it.
        </p>
      )}

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <Plus size={20} aria-hidden="true" /> Add activity
      </button>
    </form>
  );
}
