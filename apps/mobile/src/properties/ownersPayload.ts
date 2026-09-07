/**
 * Pure owner-payload reconstruction for `EditPropertyScreen` — no React
 * Native imports, unit-testable under plain Node (see
 * apps/mobile/src/location/locationPayload.spec.ts for the pattern).
 *
 * `EditPropertyScreen` only exposes editing the primary owner's name and
 * phone in its UI; every other owner field (email/whatsappPhone/notes)
 * and every additional owner beyond the first are loaded but never shown
 * there. `UpdatePropertyDto.owners` uses whole-array-replace semantics on
 * the backend (see apps/api/src/properties/dto/update-property.dto.ts):
 * if the key is present at all, submitting it replaces every owner row
 * for the property — it does not merge. So whenever this screen sends
 * `owners`, the array must be a complete, faithful reconstruction of
 * every existing owner, never a partial view built only from what the UI
 * exposes, or unedited owner data (a second owner, or the primary
 * owner's email/WhatsApp/notes) would be silently deleted on every save —
 * including a save that only touched an unrelated field like price.
 */

export interface ExistingOwner {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  whatsappPhone?: string | null;
  notes?: string | null;
}

export interface OwnerUpdateInput {
  fullName: string;
  phone?: string;
  email?: string;
  whatsappPhone?: string;
  notes?: string;
}

function toOwnerUpdateInput(owner: ExistingOwner): OwnerUpdateInput {
  return {
    fullName: owner.fullName,
    phone: owner.phone ?? undefined,
    email: owner.email ?? undefined,
    whatsappPhone: owner.whatsappPhone ?? undefined,
    notes: owner.notes ?? undefined,
  };
}

/**
 * Builds the `owners` array for a property PATCH, or `undefined` to omit
 * the key entirely — which leaves every existing owner row untouched on
 * the backend (the correct outcome for an edit that never touched the
 * owner section at all).
 *
 * - No existing owners and no name typed -> `undefined` (nothing to save).
 * - Existing owners, primary name/phone unchanged from what was loaded ->
 *   `undefined` (the owner section wasn't touched, so it must not be
 *   resent/recreated just because some other field on the screen was).
 * - Existing owners, primary name/phone changed -> the full owner list,
 *   with the edited name/phone merged into the primary owner and every
 *   other field and every other owner carried over exactly as loaded.
 * - No existing owners but a name was typed -> a single new owner.
 */
export function buildOwnersUpdatePayload(
  existingOwners: ExistingOwner[],
  edited: { fullName: string; phone: string },
): OwnerUpdateInput[] | undefined {
  const fullName = edited.fullName.trim();
  const phone = edited.phone.trim();

  if (existingOwners.length === 0) {
    return fullName ? [{ fullName, phone: phone || undefined }] : undefined;
  }

  const [primary, ...rest] = existingOwners;
  const nameUnchanged = fullName === primary.fullName;
  const phoneUnchanged = phone === (primary.phone ?? '');
  if (nameUnchanged && phoneUnchanged) {
    return undefined;
  }

  if (!fullName) {
    // Clearing the only editable identifying field isn't a supported
    // "delete this owner" action in this screen — leave every owner
    // untouched rather than silently drop the primary owner's name.
    return undefined;
  }

  return [
    { ...toOwnerUpdateInput(primary), fullName, phone: phone || undefined },
    ...rest.map(toOwnerUpdateInput),
  ];
}
