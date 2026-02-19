'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { ProfileSchema } from '@/lib/data/employee-permissions'

const GROUP_DISPLAY_ORDER = [
  'Personal Information',
  'Contact Information',
  'Address Information',
  'Financial Information',
  'Education',
  'Work Experience',
  'Training & Certifications',
  'Emergency Contacts',
  'Family',
  'Dependants',
  'Employment Details',
] as const

interface EmployeePermissionsSettingsProps {
  initialSchema: ProfileSchema | null
  organizationId: string
}

export function EmployeePermissionsSettings({
  initialSchema,
  organizationId,
}: EmployeePermissionsSettingsProps) {
  const [schema, setSchema] = useState<ProfileSchema | null>(initialSchema)
  const [loading, setLoading] = useState(!initialSchema)
  const [updating, setUpdating] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    if (!initialSchema) {
      // Fetch schema if not provided
      const fetchSchema = async () => {
        setLoading(true)
        const { data, error } = await supabase.rpc('get_employee_profile_schema', {
          org_id: organizationId,
        })

        if (error) {
          console.error('Failed to fetch schema:', error)
          toast.error('Failed to load permissions')
        } else {
          setSchema(data as ProfileSchema)
        }
        setLoading(false)
      }
      fetchSchema()
    }
  }, [initialSchema, organizationId, supabase])

  const updatePermission = async (
    fieldKey: string,
    permission: 'can_read' | 'can_write',
    value: boolean
  ) => {
    await updatePermissionField(fieldKey, permission, value)
  }

  const updatePermissionField = async (
    fieldKey: string,
    permission: 'can_read' | 'can_write',
    value: boolean
  ) => {
    const updateKey = `${fieldKey}-${permission}`
    setUpdating((prev) => new Set(prev).add(updateKey))

    try {
      // Get current field data
      const { data: currentField, error: fetchError } = await supabase
        .from('employee_self_field_permissions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('field_key', fieldKey)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "not found" - we'll handle that below
        throw fetchError
      }

      const updateData: { can_read?: boolean; can_write?: boolean } = {}
      if (permission === 'can_read') {
        updateData.can_read = value
        // If disabling read, also disable write
        if (!value) {
          updateData.can_write = false
        } else {
          // Keep existing can_write value when enabling read
          updateData.can_write = currentField?.can_write ?? false
        }
      } else {
        updateData.can_write = value
        // Keep existing can_read value when updating write
        updateData.can_read = currentField?.can_read ?? false
      }

      if (currentField) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('employee_self_field_permissions')
          .update(updateData)
          .eq('organization_id', organizationId)
          .eq('field_key', fieldKey)

        if (updateError) throw updateError
      } else {
        // Insert new record - get defaults from system table
        const { data: systemField } = await supabase
          .from('system_employee_self_field_permissions')
          .select('label, group_name, can_read, can_write')
          .eq('field_key', fieldKey)
          .single()

        if (!systemField) {
          throw new Error('Field not found in system permissions')
        }

        const insertData: {
          organization_id: string
          field_key: string
          label: string
          group_name: string
          can_read: boolean
          can_write: boolean
        } = {
          organization_id: organizationId,
          field_key: fieldKey,
          label: systemField.label,
          group_name: systemField.group_name,
          can_read:
            permission === 'can_read' ? value : systemField.can_read ?? false,
          can_write:
            permission === 'can_write'
              ? value
              : permission === 'can_read' && !value
                ? false
                : systemField.can_write ?? false,
        }

        const { error: insertError } = await supabase
          .from('employee_self_field_permissions')
          .insert(insertData)

        if (insertError) throw insertError
      }

      // Update local state
      setSchema((prev) => {
        if (!prev) return null
        const newSchema = { ...prev }
        Object.keys(newSchema).forEach((groupName) => {
          newSchema[groupName] = newSchema[groupName].map((field) => {
            if (field.field_key === fieldKey) {
              return {
                ...field,
                can_read:
                  permission === 'can_read' ? value : field.can_read,
                can_write:
                  permission === 'can_write'
                    ? value
                    : permission === 'can_read' && !value
                      ? false
                      : field.can_write,
              }
            }
            return field
          })
        })
        return newSchema
      })

      toast.success('Permission updated')
    } catch (error) {
      console.error('Failed to update permission:', error)
      toast.error('Failed to update permission')
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev)
        next.delete(updateKey)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <div className="space-y-2 pl-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!schema) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No permissions schema found. Please ensure permissions have been cloned for your organization.
      </div>
    )
  }

  const groupNames = Object.keys(schema).sort((a, b) => {
    const indexA = GROUP_DISPLAY_ORDER.indexOf(a as typeof GROUP_DISPLAY_ORDER[number])
    const indexB = GROUP_DISPLAY_ORDER.indexOf(b as typeof GROUP_DISPLAY_ORDER[number])
    
    // If both are in the order array, sort by their index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }
    // If only A is in the order, it comes first
    if (indexA !== -1) return -1
    // If only B is in the order, it comes first
    if (indexB !== -1) return 1
    // If neither is in the order, maintain alphabetical order
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-10">
      {groupNames.map((groupName) => {
        const fields = schema[groupName]
        return (
          <div key={groupName} className="space-y-3">
            <h3 className="text-lg font-semibold ml-2">{groupName}</h3>
            <div className="space-y-4 py-5 pl-4 border pr-4 border-border rounded-sm">
              {fields.map((field) => {
                const readKey = `${field.field_key}-can_read`
                const writeKey = `${field.field_key}-can_write`
                const isUpdatingRead = updating.has(readKey)
                const isUpdatingWrite = updating.has(writeKey)

                return (
                  <div
                    key={field.field_key}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <Label className="text-sm font-semibold">{field.label}</Label>
                      {/* <p className="text-xs text-muted-foreground mt-0.5">
                        {field.field_key}
                      </p> */}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`read-${field.field_key}`}
                          className="text-sm cursor-pointer"
                        >
                          Read
                        </Label>
                        <Switch
                          id={`read-${field.field_key}`}
                          checked={field.can_read}
                          disabled={isUpdatingRead}
                          onCheckedChange={(checked) =>
                            updatePermission(field.field_key, 'can_read', checked)
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`write-${field.field_key}`}
                          className="text-sm cursor-pointer"
                        >
                          Write
                        </Label>
                        <Switch
                          id={`write-${field.field_key}`}
                          checked={field.can_write}
                          disabled={!field.can_read || isUpdatingWrite}
                          onCheckedChange={(checked) =>
                            updatePermission(field.field_key, 'can_write', checked)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
