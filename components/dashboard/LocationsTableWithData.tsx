import { getLocationsForCurrentOrg } from '@/lib/data/locations'
import { LocationsTable } from '@/components/dashboard/LocationsTable'

export async function LocationsTableWithData() {
  const locations = await getLocationsForCurrentOrg()
  return <LocationsTable data={locations} />
}
