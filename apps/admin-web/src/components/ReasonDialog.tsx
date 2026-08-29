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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-deep-navy)]/50">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-surface p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-deep-navy">{title}</h2>
        <textarea
          className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-navy focus:outline-none"
          rows={4}
          placeholder="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p className="text-sm text-[var(--color-status-sold-fg)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-[var(--color-app-bg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !valid}
            className="rounded-lg bg-[var(--color-status-sold-fg)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
