'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

/**
 * Server actions for user management
 * All actions require authentication and appropriate permissions
 */

// =====================================================
// UPDATE USER ROLES
// =====================================================

export type UpdateUserRolesResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Updates roles for a given user. Only super_admin can call this.
 */
export async function updateUserRoles(
  userId: string,
  roles: string[]
): Promise<UpdateUserRolesResult> {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if current user is super_admin
  const { data: myRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', currentUser.id)

  const currentUserRoles = (myRoles ?? []).map((r) => r.role as string)
  if (!currentUserRoles.includes('super_admin')) {
    return { success: false, error: 'Only a super admin can update user roles' }
  }

  // Cannot edit own roles
  if (userId === currentUser.id) {
    return { success: false, error: 'You cannot edit your own roles' }
  }

  // Get the organization_id from the current user's profile
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', currentUser.id)
    .single()

  if (!myProfile?.organization_id) {
    return { success: false, error: 'Organization not found' }
  }

  const orgId = myProfile.organization_id

  // Get the target user's organization to verify they're in the same org
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single()

  if (!targetProfile?.organization_id) {
    return { success: false, error: 'User not found' }
  }

  if (targetProfile.organization_id !== orgId) {
    return { success: false, error: 'Cannot edit users from another organization' }
  }

  // Delete existing roles and insert new ones
  const { error: deleteError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('organization_id', orgId)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  if (roles.length > 0) {
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert(roles.map((role) => ({ 
        user_id: userId, 
        role,
        organization_id: orgId 
      })))

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  revalidatePath('/dashboard/system')
  return { success: true }
}

// =====================================================
// DELETE USER
// =====================================================

export type DeleteUserResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Deletes a user (profile and auth). Only super_admin can call this.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { success: false, error: 'Not authenticated' }
  }

  // Cannot delete yourself
  if (userId === currentUser.id) {
    return { success: false, error: 'You cannot delete yourself' }
  }

  // Check if current user is super_admin
  const { data: myRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', currentUser.id)

  const currentUserRoles = (myRoles ?? []).map((r) => r.role as string)
  if (!currentUserRoles.includes('super_admin')) {
    return { success: false, error: 'Only a super admin can delete users' }
  }

  // Delete user roles first
  const { error: rolesError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)

  if (rolesError) {
    return { success: false, error: rolesError.message }
  }

  // Delete profile
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileError) {
    return { success: false, error: profileError.message }
  }

  // Delete from auth (requires admin client)
  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server configuration error'
    return { success: false, error: message }
  }

  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) {
    return { success: false, error: authError.message }
  }

  revalidatePath('/dashboard/system')
  return { success: true }
}

// =====================================================
// SET INVITED USER PASSWORD
// =====================================================

export type SetPasswordResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Sets the password for an invited user who has an active session.
 */
export async function setInvitedUserPassword(newPassword: string): Promise<SetPasswordResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// =====================================================
// RESEND INVITE OR RESET PASSWORD
// =====================================================

export type ResendInviteResult =
  | { success: true; link: string; type: 'invite' | 'recovery'; emailSent: false }
  | { success: false; error: string }

/**
 * Resends invitation or generates password reset link.
 * 
 * Logic:
 * - If user NOT confirmed → Generate invite link (manual sharing via clipboard)
 * - If user IS confirmed → Generate password reset link (manual sharing via clipboard)
 * 
 * Both flows: Use admin.generateLink() → Returns hash fragment URL for manual sharing
 * 
 * @param userId - The Supabase auth user ID
 * @returns Link to copy to clipboard
 * @throws Only super_admin can call this function
 */
export async function resendInviteOrResetPassword(userId: string): Promise<ResendInviteResult> {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  if (!currentUser) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: myRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', currentUser.id)

  const currentUserRoles = (myRoles ?? []).map((r) => r.role as string)
  if (!currentUserRoles.includes('super_admin')) {
    return { success: false, error: 'Only a super admin can perform this action' }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server configuration error'
    return { success: false, error: message }
  }

  // Get the user from Supabase Auth
  const { data: authUser, error: getUserError } = await admin.auth.admin.getUserById(userId)
  if (getUserError || !authUser?.user?.email) {
    return {
      success: false,
      error: getUserError?.message ?? 'User or email not found',
    }
  }

  const email = authUser.user.email
  const isConfirmed = !!authUser.user.email_confirmed_at || !!authUser.user.confirmed_at
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000')
  const redirectTo = `${baseUrl}/auth/callback`

  console.log('[Resend Invite] User status:', {
    userId,
    email,
    isConfirmed,
    action: isConfirmed ? 'recovery' : 'invite'
  })

  if (!isConfirmed) {
    // User NOT confirmed → Generate invite link for manual sharing
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo },
    })

    if (linkError) {
      console.error('[Resend Invite] Failed to generate invite link:', linkError)
      return { success: false, error: linkError.message }
    }

    // Extract the action link from response
    const inviteLink =
      (linkData as { properties?: { action_link?: string } })?.properties?.action_link ??
      (linkData as { action_link?: string })?.action_link

    if (!inviteLink || typeof inviteLink !== 'string') {
      console.error('[Resend Invite] No invite link in response:', linkData)
      return { success: false, error: 'Failed to generate invite link' }
    }

    console.log('[Resend Invite] ✅ Invite link generated successfully')
    return { success: true, link: inviteLink, type: 'invite', emailSent: false }
    
  } else {
    // User IS confirmed → Generate password reset link for manual sharing
    console.log('[Resend Invite] Generating password reset link...')
    
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    if (linkError) {
      console.error('[Resend Invite] Failed to generate password reset link:', linkError)
      return { success: false, error: linkError.message }
    }

    // Extract the action link from response
    const resetLink =
      (linkData as { properties?: { action_link?: string } })?.properties?.action_link ??
      (linkData as { action_link?: string })?.action_link

    if (!resetLink || typeof resetLink !== 'string') {
      console.error('[Resend Invite] No reset link in response:', linkData)
      return { success: false, error: 'Failed to generate password reset link' }
    }

    console.log('[Resend Invite] ✅ Password reset link generated successfully')
    return { success: true, link: resetLink, type: 'recovery', emailSent: false }
  }
}

// =====================================================
// CREATE USER AND INVITE
// =====================================================

export type CreateUserResult =
  | { success: true }
  | { success: false; error: string }

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Generates a cryptographically strong random password.
 * Format: 16 random bytes → base64url (22 chars) with a fixed prefix so the
 * password always contains mixed characters that satisfy common policies.
 */
function generateRandomPassword(): string {
  const bytes = randomBytes(16).toString('base64url') // 22 url-safe chars
  return `Dash@${bytes}`                              // ≥ 27 chars, uppercase, symbol
}

/**
 * Inserts a profiles row and user_roles rows for a newly-created auth user.
 * On partial failure, cleans up what was already written before returning
 * an error so the caller can delete the auth user and abort.
 */
async function createProfileAndRoles(
  authUserId: string,
  orgId: string,
  fullName: string | null,
  roles: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authUserId,
    organization_id: orgId,
    full_name: fullName,
    avatar_url: null,
  })

  if (profileError) {
    return { success: false, error: profileError.message }
  }

  if (roles.length > 0) {
    const { error: rolesError } = await supabase
      .from('user_roles')
      .insert(roles.map((role) => ({ user_id: authUserId, role, organization_id: orgId })))

    if (rolesError) {
      await supabase.from('profiles').delete().eq('id', authUserId)
      return { success: false, error: rolesError.message }
    }
  }

  return { success: true }
}

/**
 * Looks up an employee by organization_id and email. If found, returns the
 * employee id and whether that employee has any direct reports (manager_id
 * pointing to them). Does not modify data.
 */
async function getEmployeeLinkInfo(
  orgId: string,
  email: string
): Promise<{ employeeId: string | null; hasDirectReports: boolean }> {
  const supabase = await createClient()

  const { data: empRow, error: lookupError } = await supabase
    .from('employees')
    .select('id, auth_id')
    .eq('organization_id', orgId)
    .ilike('email', email)
    .maybeSingle()

  if (lookupError || !empRow) {
    if (lookupError) {
      console.warn('[Create User] Employee lookup error (non-fatal):', lookupError.message)
    }
    return { employeeId: null, hasDirectReports: false }
  }

  // manager_id references auth.users.id; count employees who report to this one (by auth_id)
  let hasDirectReports = false
  if (empRow.auth_id) {
    const { count, error: countError } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', empRow.auth_id)
    hasDirectReports = !countError && typeof count === 'number' && count > 0
  }
  return { employeeId: empRow.id, hasDirectReports }
}

/**
 * Sets employees.auth_id for the given employee row to the new auth user id.
 */
async function linkEmployeeAuthId(employeeId: string, authUserId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('employees')
    .update({ auth_id: authUserId })
    .eq('id', employeeId)

  if (error) {
    console.warn('[Create User] Employee link error (non-fatal):', error.message)
    return
  }
  console.log('[Create User] ✅ Linked auth user to employee record:', employeeId)
}

/**
 * Sends login details (email + generated password) to the new user via Resend.
 * Errors are logged but do not abort the overall creation flow.
 */
async function sendLoginDetailsEmail(
  toEmail: string,
  fullName: string | null,
  password: string,
  loginUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Create User] RESEND_API_KEY not set – skipping login details email')
    return
  }

  const resend = new Resend(apiKey)

  const displayName = fullName ?? toEmail

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Dash HRM <hr@dash-hrm.com>',
    to: toEmail,
    subject: 'Your Dash HRM login details',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2>Welcome to Dash HRM, ${displayName}!</h2>
        <p>Your account has been created. Here are your login details:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Email</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${toEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Password</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${password}</td>
          </tr>
        </table>
        <p>
          <a href="${loginUrl}" style="display: inline-block; background: #6c2cbe; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
            Sign in to Dash HRM
          </a>
        </p>
        <p style="color: #64748b; font-size: 13px;">
          We recommend changing your password after your first sign-in.
        </p>
      </div>
    `,
  })

  if (error) {
    console.warn('[Create User] Resend email failed (non-fatal):', error)
  } else {
    console.log('[Create User] ✅ Login details email sent to', toEmail)
  }
}

// ── Roles helpers ────────────────────────────────────────────────────────────

const PRIVILEGED_ROLES = new Set(['super_admin', 'hr', 'finance'])

function hasPrivilegedRole(roles: string[]): boolean {
  return roles.some((r) => PRIVILEGED_ROLES.has(r))
}

// ── Main action ──────────────────────────────────────────────────────────────

/**
 * Creates a new system user and either sends a Supabase invite email (for
 * privileged roles: super_admin / hr / finance) or creates the auth account
 * directly with a generated password and emails the credentials via Resend
 * (for standard roles: employee / manager).
 *
 * After adding the user to the profiles table:
 *  - If a matching employees row exists (same organization_id + email), the
 *    row's auth_id is set to the new auth user id (whether or not employee
 *    role was selected).
 *  - If such an employee exists, the "employee" role is added to the user
 *    if not already selected.
 *  - If any employee has that employee as their manager (manager_id), the
 *    "manager" role is added to the user if not already selected.
 *
 * Only super_admin can call this action.
 */
export async function createUserAndInvite(
  firstName: string,
  lastName: string,
  email: string,
  roles: string[]
): Promise<CreateUserResult> {
  if (roles.length === 0) {
    return { success: false, error: 'At least one role must be selected' }
  }

  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { success: false, error: 'Not authenticated' }
  }

  // Resolve creator's organization — new user will be placed in the same org
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', currentUser.id)
    .single()

  if (!myProfile?.organization_id) {
    return { success: false, error: 'Organization not found' }
  }

  const orgId = myProfile.organization_id as string

  // Only super_admin may create users
  const { data: myRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', currentUser.id)

  const currentUserRoles = (myRoles ?? []).map((r) => r.role as string)
  if (!currentUserRoles.includes('super_admin')) {
    return { success: false, error: 'Only a super admin can create users' }
  }

  const trimmedEmail = email.trim().toLowerCase()
  const first = firstName.trim()
  const last = lastName.trim()
  const fullName = [first, last].filter(Boolean).join(' ') || null
  const isPrivileged = hasPrivilegedRole(roles)

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server configuration error'
    return { success: false, error: message }
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // ── Branch 1: Privileged roles → Supabase invite email ──────────────────
  if (isPrivileged) {
    const redirectTo = `${baseUrl}/auth/callback`

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(trimmedEmail, {
        redirectTo,
        data: { full_name: fullName ?? undefined, name: fullName ?? undefined },
      })

    if (inviteError) {
      const msg = inviteError.message.toLowerCase()
      if (msg.includes('already')) {
        return { success: false, error: 'A user with this email already exists.' }
      }
      return { success: false, error: inviteError.message }
    }

    const invitedUser = inviteData?.user
    if (!invitedUser?.id) {
      return { success: false, error: 'Invite succeeded but user id was not returned' }
    }

    const linkInfo = await getEmployeeLinkInfo(orgId, trimmedEmail)
    const finalRoles = [...roles]
    if (linkInfo.employeeId) {
      if (!finalRoles.includes('employee')) finalRoles.push('employee')
      if (linkInfo.hasDirectReports && !finalRoles.includes('manager')) finalRoles.push('manager')
    }

    const dbResult = await createProfileAndRoles(invitedUser.id, orgId, fullName, finalRoles)
    if (!dbResult.success) {
      await admin.auth.admin.deleteUser(invitedUser.id)
      return { success: false, error: dbResult.error }
    }

    if (linkInfo.employeeId) {
      await linkEmployeeAuthId(linkInfo.employeeId, invitedUser.id)
    }

    console.log('[Create User] ✅ Privileged user invited:', {
      userId: invitedUser.id,
      email: trimmedEmail,
      orgId,
      roles: finalRoles,
      employeeLinked: !!linkInfo.employeeId,
      managerAdded: linkInfo.hasDirectReports,
    })

    revalidatePath('/dashboard/system')
    return { success: true }
  }

  // ── Branch 2: Standard roles → create with password, send via Resend ────
  const generatedPassword = generateRandomPassword()

  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email: trimmedEmail,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? undefined, name: fullName ?? undefined },
  })

  if (createError) {
    const msg = createError.message.toLowerCase()
    if (msg.includes('already')) {
      return { success: false, error: 'A user with this email already exists.' }
    }
    return { success: false, error: createError.message }
  }

  const createdUser = createData?.user
  if (!createdUser?.id) {
    return { success: false, error: 'User creation succeeded but user id was not returned' }
  }

  const linkInfo = await getEmployeeLinkInfo(orgId, trimmedEmail)
  const finalRoles = [...roles]
  if (linkInfo.employeeId) {
    if (!finalRoles.includes('employee')) finalRoles.push('employee')
    if (linkInfo.hasDirectReports && !finalRoles.includes('manager')) finalRoles.push('manager')
  }

  const dbResult = await createProfileAndRoles(createdUser.id, orgId, fullName, finalRoles)
  if (!dbResult.success) {
    await admin.auth.admin.deleteUser(createdUser.id)
    return { success: false, error: dbResult.error }
  }

  if (linkInfo.employeeId) {
    await linkEmployeeAuthId(linkInfo.employeeId, createdUser.id)
  }

  // Send login credentials email via Resend (non-fatal if it fails)
  const loginUrl = `${baseUrl}/auth/login`
  await sendLoginDetailsEmail(trimmedEmail, fullName, generatedPassword, loginUrl)

  console.log('[Create User] ✅ Standard user created with login details sent:', {
    userId: createdUser.id,
    email: trimmedEmail,
    orgId,
    roles: finalRoles,
    employeeLinked: !!linkInfo.employeeId,
    managerAdded: linkInfo.hasDirectReports,
  })

  revalidatePath('/dashboard/system')
  return { success: true }
}
