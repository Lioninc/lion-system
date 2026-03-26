-- Add payment_month and refund_reason to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_month VARCHAR(7),
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;
