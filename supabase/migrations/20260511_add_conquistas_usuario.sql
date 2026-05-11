-- Conquistas desbloqueáveis por usuário
CREATE TABLE IF NOT EXISTS conquistas_usuario (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conquista_id text NOT NULL,
  desbloqueada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, conquista_id)
);

ALTER TABLE conquistas_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios veem proprias conquistas"
  ON conquistas_usuario FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "sistema insere conquistas"
  ON conquistas_usuario FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Índice para lookup rápido
CREATE INDEX IF NOT EXISTS idx_conquistas_usuario_user_id
  ON conquistas_usuario (user_id);
