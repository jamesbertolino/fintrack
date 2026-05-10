-- Tabela de participação do usuário em desafios
-- O catálogo de desafios fica em lib/desafios.ts (sem necessidade de tabela)
CREATE TABLE IF NOT EXISTS desafios_usuario (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  desafio_id   text NOT NULL,
  iniciado_em  timestamptz NOT NULL DEFAULT now(),
  termina_em   timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'ativo'
               CHECK (status IN ('ativo', 'concluido', 'falhou', 'abandonado')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, desafio_id, DATE(iniciado_em))
);

CREATE INDEX IF NOT EXISTS idx_desafios_usuario_user_status
  ON desafios_usuario(user_id, status);

ALTER TABLE desafios_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario acessa seus desafios"
  ON desafios_usuario FOR ALL
  USING (auth.uid() = user_id);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION set_desafios_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_desafios_usuario_updated_at
  BEFORE UPDATE ON desafios_usuario
  FOR EACH ROW EXECUTE FUNCTION set_desafios_updated_at();
