import { getAvailablePublicationActions, getPublicationStatusLabel } from './publicationStatus';

describe('publicationStatus', () => {
  it('maps null (no publication row) to Private with a PREPARE_LISTING action', () => {
    expect(getPublicationStatusLabel(null)).toBe('Private');
    expect(getAvailablePublicationActions(null)).toEqual(['PREPARE_LISTING']);
  });

  it('maps every real status to a distinct, non-empty label', () => {
    const statuses = [
      'DRAFT',
      'PENDING_REVIEW',
      'CHANGES_REQUESTED',
      'PUBLISHED',
      'REJECTED',
      'ADMIN_UNPUBLISHED',
      'OWNER_UNPUBLISHED',
      'ARCHIVED',
    ] as const;
    const labels = statuses.map((status) => getPublicationStatusLabel(status));
    expect(new Set(labels).size).toBe(statuses.length);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });

  it('PENDING_REVIEW only allows cancelling — never editing while under review', () => {
    expect(getAvailablePublicationActions('PENDING_REVIEW')).toEqual(['CANCEL_SUBMISSION']);
  });

  it('CHANGES_REQUESTED and REJECTED both route to edit & resubmit', () => {
    expect(getAvailablePublicationActions('CHANGES_REQUESTED')).toEqual(['EDIT_AND_RESUBMIT']);
    expect(getAvailablePublicationActions('REJECTED')).toEqual(['EDIT_AND_RESUBMIT']);
  });

  it('PUBLISHED offers unpublish; OWNER_UNPUBLISHED offers republish; ADMIN_UNPUBLISHED offers neither', () => {
    expect(getAvailablePublicationActions('PUBLISHED')).toContain('UNPUBLISH');
    expect(getAvailablePublicationActions('OWNER_UNPUBLISHED')).toEqual(['REPUBLISH']);
    expect(getAvailablePublicationActions('ADMIN_UNPUBLISHED')).toEqual(['NONE']);
  });
});
