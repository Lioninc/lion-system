-- Create dispatch_histories table for job seeker dispatch history
CREATE TABLE dispatch_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  job_seeker_id UUID NOT NULL REFERENCES job_seekers(id) ON DELETE CASCADE,
  company_name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dispatch_histories ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "dispatch_histories_tenant_isolation" ON dispatch_histories
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
