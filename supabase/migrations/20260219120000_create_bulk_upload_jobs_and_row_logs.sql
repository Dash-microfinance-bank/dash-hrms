-- Bulk upload support: jobs and row logs
-- Tables created only if they do not exist.
-- Indexes: organization_id, job_id, status. RLS for multi-tenant safety.

-- Enums for bulk upload status
DO $$ BEGIN
  CREATE TYPE bulk_upload_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bulk_upload_row_status AS ENUM ('valid', 'inserted', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1) bulk_upload_jobs
CREATE TABLE IF NOT EXISTS public.bulk_upload_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  file_url text,
  status bulk_upload_job_status NOT NULL DEFAULT 'pending',
  total_rows integer NOT NULL DEFAULT 0,
  successful_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bulk_upload_jobs IS 'Tracks bulk upload jobs per organization for multi-tenant safety';

-- 2) bulk_upload_row_logs
CREATE TABLE IF NOT EXISTS public.bulk_upload_row_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.bulk_upload_jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw_data jsonb,
  status bulk_upload_row_status NOT NULL DEFAULT 'valid',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bulk_upload_row_logs IS 'Per-row log for bulk uploads; scoped by job and organization';

-- Indexes for list/filter and multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_bulk_upload_jobs_organization_id
  ON public.bulk_upload_jobs(organization_id);

CREATE INDEX IF NOT EXISTS idx_bulk_upload_jobs_status
  ON public.bulk_upload_jobs(status);

CREATE INDEX IF NOT EXISTS idx_bulk_upload_jobs_organization_id_created_at
  ON public.bulk_upload_jobs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_upload_row_logs_job_id
  ON public.bulk_upload_row_logs(job_id);

CREATE INDEX IF NOT EXISTS idx_bulk_upload_row_logs_organization_id
  ON public.bulk_upload_row_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_bulk_upload_row_logs_status
  ON public.bulk_upload_row_logs(status);

CREATE INDEX IF NOT EXISTS idx_bulk_upload_row_logs_job_id_row_number
  ON public.bulk_upload_row_logs(job_id, row_number);

-- RLS: enable and restrict to same organization as current user (via profiles)
ALTER TABLE public.bulk_upload_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_upload_row_logs ENABLE ROW LEVEL SECURITY;

-- Policy helper: user's organization_id (used in policies)
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- bulk_upload_jobs policies
CREATE POLICY bulk_upload_jobs_select_own_org
  ON public.bulk_upload_jobs FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY bulk_upload_jobs_insert_own_org
  ON public.bulk_upload_jobs FOR INSERT
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY bulk_upload_jobs_update_own_org
  ON public.bulk_upload_jobs FOR UPDATE
  USING (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY bulk_upload_jobs_delete_own_org
  ON public.bulk_upload_jobs FOR DELETE
  USING (organization_id = public.current_user_organization_id());

-- bulk_upload_row_logs policies (scoped by organization_id)
CREATE POLICY bulk_upload_row_logs_select_own_org
  ON public.bulk_upload_row_logs FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY bulk_upload_row_logs_insert_own_org
  ON public.bulk_upload_row_logs FOR INSERT
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY bulk_upload_row_logs_update_own_org
  ON public.bulk_upload_row_logs FOR UPDATE
  USING (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY bulk_upload_row_logs_delete_own_org
  ON public.bulk_upload_row_logs FOR DELETE
  USING (organization_id = public.current_user_organization_id());

-- Trigger to keep bulk_upload_jobs.updated_at in sync
CREATE OR REPLACE FUNCTION public.set_bulk_upload_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bulk_upload_jobs_updated_at ON public.bulk_upload_jobs;
CREATE TRIGGER bulk_upload_jobs_updated_at
  BEFORE UPDATE ON public.bulk_upload_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bulk_upload_jobs_updated_at();
