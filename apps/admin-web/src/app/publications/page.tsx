'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, ApiError } from '@/lib/api';
import type { Paginated, PropertyPublicationStatus, PublicationReviewSummary } from '@/lib/types';

const STATUS_OPTIONS: PropertyPublicationStatus[] = [
  'PENDING_REVIEW',
  'PUBLISHED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'ADMIN_UNPUBLISHED',
  'OWNER_UNPUBLISHED',
  'DRAFT',
  'ARCHIVED',
];

/** publication-status → semantic color, mirroring apps/mobile/src/components/ui/StatusBadge.tsx (see docs/DESIGN_SYSTEM.md "Semantic status colors"). */
const STATUS_STYLE: Record<PropertyPublicationStatus, string> = {
  DRAFT: 'bg-[var(--color-status-archived-bg)] text-[var(--color-status-archived-fg)]',
  PENDING_REVIEW: 'bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-fg)]',
  CHANGES_REQUESTED: 'bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-fg)]',
  PUBLISHED: 'bg-[var(--color-status-available-bg)] text-[var(--color-status-available-fg)]',
  REJECTED: 'bg-[var(--color-status-sold-bg)] text-[var(--color-status-sold-fg)]',
  ADMIN_UNPUBLISHED: 'bg-[var(--color-status-archived-bg)] text-[var(--color-status-archived-fg)]',
  OWNER_UNPUBLISHED: 'bg-[var(--color-status-archived-bg)] text-[var(--color-status-archived-fg)]',
  ARCHIVED: 'bg-[var(--color-status-archived-bg)] text-[var(--color-status-archived-fg)]',
};

export default function PublicationsQueuePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<PropertyPublicationStatus>('PENDING_REVIEW');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<PublicationReviewSummary> | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const response = await apiRequest<Paginated<PublicationReviewSummary>>(
        `/admin/property-publications?status=${status}&page=${page}&pageSize=20`,
      );
      setData(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the review queue.');
    } finally {
      setLoadingList(false);
    }
  }, [status, page]);

  useEffect(() => {
    // Fetch-on-mount/filter-change idiom — see the comment in
    // auth-context.tsx for why this is disabled rather than restructured.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void load();
  }, [user, load]);

  if (loading || !user) {
    return <p className="p-6 text-text-secondary">Loading…</p>;
  }

  return (
    <div className="min-h-full bg-[var(--color-app-bg)]">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-deep-navy text-xs font-bold text-white">
              PB
            </div>
            <span className="font-semibold text-deep-navy">ProBase Admin</span>
          </div>
          <button onClick={logout} className="text-sm text-text-secondary hover:text-navy hover:underline">
            Sign out ({user.email})
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-6">
        <h1 className="mb-4 text-2xl font-semibold text-deep-navy">Publication Review Queue</h1>

        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => {
                setStatus(option);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                status === option ? 'bg-gold text-deep-navy' : 'bg-surface text-text-secondary border border-border hover:border-navy'
              }`}
            >
              {option.replaceAll('_', ' ')}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-[var(--color-status-sold-fg)]">{error}</p>}
        {loadingList ? (
          <p className="text-text-secondary">Loading…</p>
        ) : !data || data.items.length === 0 ? (
          <p className="text-text-secondary">No submissions with this status.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-app-bg)] text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Workspace</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-t border-border hover:bg-[var(--color-app-bg)]">
                    <td className="px-4 py-3">
                      <Link href={`/publications/${item.id}`} className="font-medium text-navy hover:underline">
                        {item.publicTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{item.workspaceName}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.propertyType} · {item.listingPurpose}
                    </td>
                    <td className="px-4 py-3">
                      {item.currency} {item.publicPrice.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[item.status]}`}>
                        {item.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.meta.totalPages > 1 && (
          <div className="mt-4 flex items-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-text-secondary">
              Page {data.meta.page} of {data.meta.totalPages} ({data.meta.totalItems} total)
            </span>
            <button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
