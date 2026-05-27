const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'Permanent',
  part_time: 'Part time',
  fixed_term: 'Fixed term',
  temporary: 'Temporary',
  intern: 'Intern',
  contractor: 'Contractor',
}

export function formatContractType(contractType: string | null | undefined): string {
  if (!contractType) return '—'
  return CONTRACT_LABELS[contractType] ?? contractType.replace(/_/g, ' ')
}
