'use client';

import { useState } from 'react';

/**
 * Shared confirmation dialog for reject / request-changes / admin
 * unpublish — every one of these requires a non-empty reason (see
 * docs/PERMISSIONS.md "Admin reason UX"). Validated client-side for a
 * fast UX signal; the API independently re-validates and is the real
 * authority.
 */
export function ReasonDialog({
  title,
  actionLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  actionLabel: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const valid = trimmed.length >= 3;

  const onSubmit = async () => {
    if (!valid) {
      setError('A reason of at least 3 characters is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch {
      setError('Could not complete this action. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={4}
          placeholder="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !valid}
            className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
