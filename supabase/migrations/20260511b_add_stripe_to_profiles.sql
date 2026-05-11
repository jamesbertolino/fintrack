-- Campos de integração Stripe no perfil
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
