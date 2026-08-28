import type { PropertyPublicationStatus } from '../api/types';

/**
 * Pure, DB/network-free mapping from a publication's status to what the
 * professional-side UI should show — extracted from
 * `PropertyDetailScreen` so this mapping is unit-testable without a
 * DB/HTTP harness (see `publicationStatus.spec.ts`). `null` (no
 * publication row at all) is the PRIVATE state — never a stored value,
 * see docs/DATABASE.md "Publication state machine."
 */
export type PublicationAction =
  | 'PREPARE_LISTING'
  | 'EDIT_DRAFT'
  | 'SUBMIT'
  | 'CANCEL_SUBMISSION'
  | 'EDIT_AND_RESUBMIT'
  | 'VIEW_PUBLIC_LISTING'
  | 'UNPUBLISH'
  | 'REPUBLISH'
  | 'NONE';

export function getPublicationStatusLabel(status: PropertyPublicationStatus | null): string {
  switch (status) {
    case null:
      return 'Private';
    case 'DRAFT':
      return 'Draft';
    case 'PENDING_REVIEW':
      return 'Under Review';
    case 'CHANGES_REQUESTED':
      return 'Changes Requested';
    case 'PUBLISHED':
      return 'Published';
    case 'REJECTED':
      return 'Rejected';
    case 'ADMIN_UNPUBLISHED':
      return 'Removed by Admin';
    case 'OWNER_UNPUBLISHED':
      return 'Unpublished';
    case 'ARCHIVED':
      return 'Archived';
  }
}

export function getAvailablePublicationActions(
  status: PropertyPublicationStatus | null,
): PublicationAction[] {
  switch (status) {
    case null:
      return ['PREPARE_LISTING'];
    case 'DRAFT':
      return ['EDIT_DRAFT', 'SUBMIT'];
    case 'PENDING_REVIEW':
      return ['CANCEL_SUBMISSION'];
    case 'CHANGES_REQUESTED':
    case 'REJECTED':
      return ['EDIT_AND_RESUBMIT'];
    case 'PUBLISHED':
      return ['VIEW_PUBLIC_LISTING', 'UNPUBLISH'];
    case 'OWNER_UNPUBLISHED':
      return ['REPUBLISH'];
    case 'ADMIN_UNPUBLISHED':
    case 'ARCHIVED':
      return ['NONE'];
  }
}
