-- Create work_start_contacts table for follow-up contact management
CREATE TABLE work_start_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  contact_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(referral_id, contact_type)
);

-- Enable RLS
ALTER TABLE work_start_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "work_start_contacts_tenant_isolation" ON work_start_contacts
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
