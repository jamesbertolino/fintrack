ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completo boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
