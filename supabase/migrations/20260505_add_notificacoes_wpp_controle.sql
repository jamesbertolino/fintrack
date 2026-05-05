-- Controle de opt-in de notificações no celular por usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notificacoes_celular boolean NOT NULL DEFAULT true;

-- Timestamp de envio WhatsApp para controle do limite diário
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS whatsapp_enviado_at timestamptz;

-- Índice para a query de "já enviados hoje"
CREATE INDEX IF NOT EXISTS idx_notifications_wpp_enviado
  ON public.notifications (user_id, enviado_whatsapp, whatsapp_enviado_at)
  WHERE enviado_whatsapp = true;

NOTIFY pgrst, 'reload schema';
