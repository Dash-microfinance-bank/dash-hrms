export type OrganizationSettings = {
  addressLine1?: string
  addressLine2?: string
  city?: string
  logoUrl?: string
}

export function parseOrganizationSettings(raw: unknown): OrganizationSettings {
  if (!raw || typeof raw !== 'object') return {}
  const s = raw as Record<string, unknown>
  return {
    addressLine1: typeof s.addressLine1 === 'string' ? s.addressLine1 : undefined,
    addressLine2: typeof s.addressLine2 === 'string' ? s.addressLine2 : undefined,
    city: typeof s.city === 'string' ? s.city : undefined,
    logoUrl: typeof s.logoUrl === 'string' ? s.logoUrl : undefined,
  }
}

export function organizationAddressLines(settings: OrganizationSettings): string[] {
  const lines: string[] = []
  if (settings.addressLine1) lines.push(settings.addressLine1)
  if (settings.addressLine2) lines.push(settings.addressLine2)
  if (settings.city) lines.push(settings.city)
  return lines
}
