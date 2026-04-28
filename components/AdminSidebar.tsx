'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  BarChart2,
  BadgeDollarSign,
  Building2,
  Briefcase,
  FileText,
  HandCoins,
  Layers,
  LogOut,
  MapPin,
  Settings,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const organizationalStructureNavItems = [
  { label: 'Office Locations', href: '/dashboard/admin/locations', icon: MapPin },
  { label: 'Departments', href: '/dashboard/admin/departments', icon: Building2 },
  { label: 'Job roles', href: '/dashboard/admin/job-roles', icon: Briefcase },
  { label: 'Grades', href: '/dashboard/admin/grades', icon: TrendingUp }
]

const hrisNavItems = [
  { label: 'Employees Analytics', href: '/dashboard/admin/employees/analytics', icon: BarChart2 },
  { label: 'All Employees', href: '/dashboard/admin/employees', icon: Users },
  { label: 'Add Employee (Single)', href: '/dashboard/admin/employees/single-upload', icon: UserPlus },
  { label: 'Add Employees (Bulk)', href: '/dashboard/admin/employees/bulk-upload', icon: Upload },
  { label: 'Profile Update Requests', href: '/dashboard/admin/employees/profile-update-requests', icon: UserCheck },
  { label: 'Employee Self Service Settings', href: '/dashboard/admin/settings/employees', icon: Settings },
] as const

const documentsNavItems = [
  { label: 'All documents', href: '/dashboard/admin/documents', icon: FileText },
  { label: 'Document categories', href: '/dashboard/admin/document-categories', icon: Layers },
  { label: 'Document types', href: '/dashboard/admin/document-types', icon: Briefcase },
] as const

const payrollNavItems = [
  { label: 'Payroll Run', href: '/dashboard/admin/payroll-run', icon: Wallet },
  { label: 'Allowances', href: '/dashboard/admin/payroll/allowances', icon: HandCoins },
  { label: 'Deductions', href: '/dashboard/admin/payroll/deductions', icon: BadgeDollarSign },
  { label: 'Pay groups', href: '/dashboard/admin/payroll/pay-groups', icon: Users },
  { label: 'Approval workflow', href: '/dashboard/admin/payroll/approval-workflow', icon: FileText },
] as const

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarGroupLabel className="px-2 text-base font-semibold">
          Admin Panel
        </SidebarGroupLabel>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Organizational structure</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {organizationalStructureNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton 
                      className={cn(isActive && 'bg-primary! text-white!')} 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>People Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {hrisNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      className={cn(isActive && 'bg-primary! text-white!')}
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Documents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {documentsNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      className={cn(isActive && 'bg-primary! text-white!')}
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Payroll</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {payrollNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      className={cn(isActive && 'bg-primary! text-white!')}
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <SidebarMenuButton className="text-red-700 hover:text-red-700 hover:bg-sidebar-accent">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log out?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out? You will need to sign in again to access the dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarFooter>
    </Sidebar>
  )
}
