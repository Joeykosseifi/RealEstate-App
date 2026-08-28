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
    return <p className="p-6 text-gray-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Publication Review Queue</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:underline">
          Sign out ({user.email})
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => {
              setStatus(option);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-sm ${
              status === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {option.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loadingList ? (
        <p className="text-gray-500">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-gray-500">No submissions with this status.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Workspace</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Submitted</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/publications/${item.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {item.publicTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{item.workspaceName}</td>
                  <td className="px-4 py-2">
                    {item.propertyType} · {item.listingPurpose}
                  </td>
                  <td className="px-4 py-2">
                    {item.currency} {item.publicPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2">{item.status.replaceAll('_', ' ')}</td>
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
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {data.meta.page} of {data.meta.totalPages} ({data.meta.totalItems} total)
          </span>
          <button
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
