'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, ApiError } from '@/lib/api';
import type { PublicationReviewDetail } from '@/lib/types';
import { ReasonDialog } from '@/components/ReasonDialog';

type DialogKind = 'reject' | 'request-changes' | 'unpublish' | null;

export default function PublicationReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<PublicationReviewDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setLoadingDetail(true);
    setError(null);
    try {
      const response = await apiRequest<PublicationReviewDetail>(
        `/admin/property-publications/${id}`,
      );
      setDetail(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this submission.');
    } finally {
      setLoadingDetail(false);
    }
  }, [id]);

  useEffect(() => {
    // Fetch-on-mount idiom — see the comment in auth-context.tsx for why
    // this is disabled rather than restructured.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void load();
  }, [user, load]);

  const runAction = async (path: string, body?: { reason: string }) => {
    setActionPending(true);
    try {
      const updated = await apiRequest<PublicationReviewDetail>(
        `/admin/property-publications/${id}/${path}`,
        { method: 'POST', body },
      );
      setDetail(updated);
    } finally {
      setActionPending(false);
    }
  };

  const onApprove = async () => {
    setActionPending(true);
    try {
      await runAction('approve');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not approve.');
    } finally {
      setActionPending(false);
    }
  };

  const onRestore = async () => {
    setActionPending(true);
    try {
      await runAction('restore');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not restore.');
    } finally {
      setActionPending(false);
    }
  };

  if (loading || !user) {
    return <p className="p-6 text-text-secondary">Loading…</p>;
  }
  if (loadingDetail) {
    return <p className="p-6 text-text-secondary">Loading…</p>;
  }
  if (error || !detail) {
    return <p className="p-6 text-[var(--color-status-sold-fg)]">{error ?? 'Not found.'}</p>;
  }

  const { snapshot } = detail;
  const canDecide = detail.status === 'PENDING_REVIEW';
  const canUnpublish = detail.status === 'PUBLISHED';
  const canRestore = detail.status === 'ADMIN_UNPUBLISHED';

  return (
    <div className="min-h-full bg-[var(--color-app-bg)]">
      <div className="mx-auto max-w-4xl p-6">
        <Link href="/publications" className="text-sm text-navy hover:underline">
          ← Back to queue
        </Link>

        <div className="mt-4 flex items-start justify-between rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold text-deep-navy">{snapshot.publicTitle}</h1>
            <p className="text-text-secondary">
              {detail.workspaceName} · Submitted by {detail.submittedByName ?? 'Unknown'}
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-status-pending-bg)] px-3 py-1 text-sm font-semibold text-[var(--color-status-pending-fg)]">
            {detail.status.replaceAll('_', ' ')}
          </span>
        </div>

        {snapshot.media.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {snapshot.media.map((media) => (
              // eslint-disable-next-line @next/next/no-img-element -- external signed URL, not a local static asset
              <img
                key={media.id}
                src={media.url ?? undefined}
                alt=""
                className="h-32 w-32 rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-5 text-sm shadow-sm">
          <div>
            <span className="text-text-secondary">Price</span>
            <p className="font-medium text-[var(--foreground)]">
              {snapshot.currency} {snapshot.publicPrice.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-text-secondary">Type / Purpose</span>
            <p className="font-medium text-[var(--foreground)]">
              {snapshot.propertyType} · {snapshot.listingPurpose}
            </p>
          </div>
          <div>
            <span className="text-text-secondary">Bedrooms / Bathrooms / Area</span>
            <p className="font-medium text-[var(--foreground)]">
              {snapshot.bedrooms ?? '—'} / {snapshot.bathrooms ?? '—'} / {snapshot.areaSqm ?? '—'} m²
            </p>
          </div>
          <div>
            <span className="text-text-secondary">Location</span>
            <p className="font-medium text-[var(--foreground)]">
              {[snapshot.publicCity, snapshot.publicArea].filter(Boolean).join(', ') || 'Hidden'} (
              {snapshot.locationVisibility})
            </p>
          </div>
        </div>

        {snapshot.publicDescription && (
          <p className="mt-4 text-sm text-[var(--foreground)]">{snapshot.publicDescription}</p>
        )}

        {snapshot.publicFeatureKeys.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {snapshot.publicFeatureKeys.map((key) => (
              <span key={key} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-secondary">
                {key}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {canDecide && (
            <>
              <button
                onClick={onApprove}
                disabled={actionPending}
                className="rounded-lg bg-[var(--color-status-available-fg)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => setDialog('request-changes')}
                disabled={actionPending}
                className="rounded-lg bg-[var(--color-status-pending-fg)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Request Changes
              </button>
              <button
                onClick={() => setDialog('reject')}
                disabled={actionPending}
                className="rounded-lg bg-[var(--color-status-sold-fg)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {canUnpublish && (
            <button
              onClick={() => setDialog('unpublish')}
              disabled={actionPending}
              className="rounded-lg bg-[var(--color-status-sold-fg)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Unpublish
            </button>
          )}
          {canRestore && (
            <button
              onClick={onRestore}
              disabled={actionPending}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Restore
            </button>
          )}
        </div>

        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold text-deep-navy">Review History</h2>
          <ul className="space-y-2 text-sm">
            {detail.history.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border bg-surface p-3 shadow-sm">
                <p className="font-medium text-[var(--foreground)]">
                  Version {entry.versionNumber} — {entry.status.replaceAll('_', ' ')}
                </p>
                {entry.submittedAt && (
                  <p className="text-text-secondary">
                    Submitted {new Date(entry.submittedAt).toLocaleString()}
                  </p>
                )}
                {entry.reviewedAt && (
                  <p className="text-text-secondary">
                    Reviewed {new Date(entry.reviewedAt).toLocaleString()}
                  </p>
                )}
                {entry.reviewReason && <p className="mt-1 text-[var(--foreground)]">“{entry.reviewReason}”</p>}
              </li>
            ))}
          </ul>
        </div>

        {dialog === 'reject' && (
          <ReasonDialog
            title="Reject Submission"
            actionLabel="Reject"
            onCancel={() => setDialog(null)}
            onConfirm={async (reason) => {
              await runAction('reject', { reason });
              setDialog(null);
            }}
          />
        )}
        {dialog === 'request-changes' && (
          <ReasonDialog
            title="Request Changes"
            actionLabel="Request Changes"
            onCancel={() => setDialog(null)}
            onConfirm={async (reason) => {
              await runAction('request-changes', { reason });
              setDialog(null);
            }}
          />
        )}
        {dialog === 'unpublish' && (
          <ReasonDialog
            title="Unpublish Listing"
            actionLabel="Unpublish"
            onCancel={() => setDialog(null)}
            onConfirm={async (reason) => {
              await runAction('unpublish', { reason });
              setDialog(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
