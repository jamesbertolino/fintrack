-- Campo admin em profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Log de consumo de IA por requisição
CREATE TABLE IF NOT EXISTS ia_usage_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint         text NOT NULL,   -- '/api/ia' | '/api/notificacoes/ia' | '/api/orcamento/ia' | '/api/lancamento/upload'
  provider         text NOT NULL,   -- 'anthropic' | 'openai'
  modelo           text,
  prompt_tokens    int  NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens     int  NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_usage_user_created
  ON ia_usage_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ia_usage_created
  ON ia_usage_logs(created_at DESC);

-- Admins leem tudo; usuários não acessam
ALTER TABLE ia_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins leem ia_usage_logs"
  ON ia_usage_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
