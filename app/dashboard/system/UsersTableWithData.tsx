import { getUsersWithRolesAndCurrentUser } from '@/lib/data/users'
import { UsersTable } from '@/components/dashboard/UsersTable'

export async function UsersTableWithData() {
  const result = await getUsersWithRolesAndCurrentUser()
  if (!result) return null
  const { users, currentUserId } = result
  return <UsersTable data={users} currentUserId={currentUserId} />
}
