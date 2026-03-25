-- Add company_type_v2 column (dispatch / direct / client)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS company_type_v2 VARCHAR(20);

-- Migrate existing data
UPDATE companies SET company_type_v2 = company_type WHERE company_type_v2 IS NULL;

-- Add client_company_id to jobs (派遣先企業)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS client_company_id UUID REFERENCES companies(id);
