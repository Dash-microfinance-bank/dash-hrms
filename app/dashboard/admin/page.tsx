import { redirect } from 'next/navigation'

export default function AdminDashboardPage() {
  // Redirect to the first admin section by default
  redirect('/dashboard/admin/departments')
}