-- Adiciona whatsapp opcional em familia_membros (unificação família + WhatsApp)
alter table public.familia_membros add column if not exists whatsapp text;
