-- Tabela orcamentos já existia com schema antigo (limite, mes int, ano int)
-- Esta migration adapta para o novo schema usado pela aplicação

-- 1. Adiciona valor_planejado (migra de limite)
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS valor_planejado numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.orcamentos SET valor_planejado = limite WHERE valor_planejado = 0;

-- 2. Converte mes (int) + ano (int) para mes texto YYYY-MM
ALTER TABLE public.orcamentos RENAME COLUMN mes TO mes_num;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS mes text;
UPDATE public.orcamentos SET mes = ano::text || '-' || lpad(mes_num::text, 2, '0');
ALTER TABLE public.orcamentos ALTER COLUMN mes SET NOT NULL;

-- 3. Unique constraint para upsert por (user_id, categoria, mes)
ALTER TABLE public.orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_user_id_categoria_mes_key;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_user_id_categoria_mes_key UNIQUE (user_id, categoria, mes);

-- 4. RLS (idempotente)
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orcamentos' AND policyname = 'users_own_orcamentos'
  ) THEN
    CREATE POLICY "users_own_orcamentos" ON public.orcamentos
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
