-- Speed up org-scoped email uniqueness checks used in bulk upload preview
CREATE INDEX IF NOT EXISTS idx_employees_org_email
  ON public.employees(organization_id, lower(email));

-- Speed up location lookups by org (used to validate work_location field)
CREATE INDEX IF NOT EXISTS idx_organization_location_org_id
  ON public.organization_location(organization_id);
