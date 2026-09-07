import { buildOwnersUpdatePayload, type ExistingOwner } from './ownersPayload';

const primaryOwner: ExistingOwner = {
  fullName: 'John Doe',
  phone: '+96170000001',
  email: 'john@example.com',
  whatsappPhone: '+96170000002',
  notes: 'Prefers evening calls',
};

const secondOwner: ExistingOwner = {
  fullName: 'Jane Doe',
  phone: '+96170000003',
  email: 'jane@example.com',
  whatsappPhone: null,
  notes: null,
};

describe('buildOwnersUpdatePayload', () => {
  it('omits the owners key entirely when editing an unrelated field (name/phone unchanged)', () => {
    const result = buildOwnersUpdatePayload([primaryOwner, secondOwner], {
      fullName: primaryOwner.fullName,
      phone: primaryOwner.phone ?? '',
    });
    expect(result).toBeUndefined();
  });

  it('preserves multiple owners when the primary owner is edited', () => {
    const result = buildOwnersUpdatePayload([primaryOwner, secondOwner], {
      fullName: 'John Updated',
      phone: primaryOwner.phone ?? '',
    });
    expect(result).toHaveLength(2);
    expect(result?.[1]).toEqual({
      fullName: 'Jane Doe',
      phone: '+96170000003',
      email: 'jane@example.com',
      whatsappPhone: undefined,
      notes: undefined,
    });
  });

  it('preserves the edited owner fields not shown/edited by the screen (email, WhatsApp, notes)', () => {
    const result = buildOwnersUpdatePayload([primaryOwner], {
      fullName: 'John Updated',
      phone: primaryOwner.phone ?? '',
    });
    expect(result).toEqual([
      {
        fullName: 'John Updated',
        phone: '+96170000001',
        email: 'john@example.com',
        whatsappPhone: '+96170000002',
        notes: 'Prefers evening calls',
      },
    ]);
  });

  it('applies an edited phone while preserving unrelated fields', () => {
    const result = buildOwnersUpdatePayload([primaryOwner], {
      fullName: primaryOwner.fullName,
      phone: '+96170009999',
    });
    expect(result).toEqual([
      {
        fullName: 'John Doe',
        phone: '+96170009999',
        email: 'john@example.com',
        whatsappPhone: '+96170000002',
        notes: 'Prefers evening calls',
      },
    ]);
  });

  it('intentionally clearing the editable phone field persists as cleared', () => {
    const result = buildOwnersUpdatePayload([primaryOwner], {
      fullName: primaryOwner.fullName,
      phone: '',
    });
    expect(result).toEqual([
      {
        fullName: 'John Doe',
        phone: undefined,
        email: 'john@example.com',
        whatsappPhone: '+96170000002',
        notes: 'Prefers evening calls',
      },
    ]);
  });

  it('creates a single new owner when none existed before', () => {
    const result = buildOwnersUpdatePayload([], { fullName: 'New Owner', phone: '+9611' });
    expect(result).toEqual([{ fullName: 'New Owner', phone: '+9611' }]);
  });

  it('returns undefined when there is nothing to save and no owner existed', () => {
    const result = buildOwnersUpdatePayload([], { fullName: '', phone: '' });
    expect(result).toBeUndefined();
  });

  it('does not drop the primary owner when its name is cleared (unsupported delete-via-clear)', () => {
    const result = buildOwnersUpdatePayload([primaryOwner, secondOwner], {
      fullName: '',
      phone: primaryOwner.phone ?? '',
    });
    expect(result).toBeUndefined();
  });
});
