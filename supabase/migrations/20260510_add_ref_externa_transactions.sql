-- Adiciona ref_externa para deduplicação de importações
-- Formato: "DD/MM/YYYY:DOCUMENTO" (se banco fornecer) ou "DD/MM/YYYY:VALOR:DESCRICAO"
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ref_externa TEXT;

-- Índice único por usuário — impede duplicata exata no banco
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_ref_externa
  ON transactions(user_id, ref_externa)
  WHERE ref_externa IS NOT NULL;
