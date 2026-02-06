'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

/**
 * Creates a new user (invite in auth), profile row, and user_roles; sends invite via Supabase.
 * Only super_admin. Fails if user already exists in auth or profiles.
 */
export async function createUserAndInvite(
  firstName: string,
  lastName: string,
  email: string,
  roles: string[]
): Promise<CreateUserResult> {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  if (!currentUser) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', currentUser.id)
    .single()

  if (!myProfile?.organization_id) {
    return { success: false, error: 'Organization not found' }
  }

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
  const redirectTo = `${baseUrl}/auth/callback`

  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(trimmedEmail, {
      redirectTo,
      data: {
        full_name: fullName ?? undefined,
        name: fullName ?? undefined,
      },
    })

  if (inviteError) {
    const msg = inviteError.message.toLowerCase()
    if (
      msg.includes('already') ||
      msg.includes('already registered') ||
      msg.includes('already exists')
    ) {
      return { success: false, error: 'A user with this email already exists.' }
    }
    return { success: false, error: inviteError.message }
  }

  const invitedUser = inviteData?.user
  if (!invitedUser?.id) {
    return { success: false, error: 'Invite succeeded but user id was not returned' }
  }

  // Insert profile
  const { error: profileError } = await supabase.from('profiles').insert({
    id: invitedUser.id,
    organization_id: myProfile.organization_id,
    full_name: fullName,
    avatar_url: null,
  })

  if (profileError) {
    // Cleanup: delete auth user if profile insert failed
    await admin.auth.admin.deleteUser(invitedUser.id)
    return { success: false, error: profileError.message }
  }

  // Insert roles
  if (roles.length > 0) {
    const { error: rolesError } = await supabase
      .from('user_roles')
      .insert(roles.map((role) => ({ 
        user_id: invitedUser.id, 
        role,
        organization_id: myProfile.organization_id 
      })))

    if (rolesError) {
      // Cleanup
      await supabase.from('profiles').delete().eq('id', invitedUser.id)
      await admin.auth.admin.deleteUser(invitedUser.id)
      return { success: false, error: rolesError.message }
    }
  }

  console.log('[Create User] ✅ User created successfully:', {
    userId: invitedUser.id,
    email: trimmedEmail,
    organizationId: myProfile.organization_id
  })

  revalidatePath('/dashboard/system')
  return { success: true }
}
