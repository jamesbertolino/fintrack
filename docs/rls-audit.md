# Auditoria de RLS — PoupaUp

> Última revisão: 2026-05-07

## O que é o service role key

O `SUPABASE_SERVICE_ROLE_KEY` **bypassa todas as políticas RLS** do banco.
Deve ser usado **somente** em operações que legítimamente precisam de acesso
privilegiado e nunca deve ser exposto ao cliente.

---

## Usos classificados

| Arquivo | Justificativa | Status |
|---|---|---|
| `app/api/whatsapp/receber/route.ts` | Webhook externo — não há sessão de usuário autenticado; precisa de acesso cross-user para localizar grupo e perfil pelo número WhatsApp | ✅ Justificado |
| `app/api/whatsapp/alertas/route.ts` | Envia alertas para múltiplos usuários de um grupo — acesso cross-user obrigatório | ✅ Justificado |
| `app/api/webhook/[userid]/route.ts` | Webhook de integração externa (Evolution) sem sessão — precisa inserir transações para o usuário-alvo | ✅ Justificado |
| `app/api/evolution/status/[instancia]/route.ts` | Setup inicial de instância — chamado durante onboarding antes do setup_completo; precisa atualizar perfil sem sessão completa | ✅ Justificado |
| `app/api/evolution/connect/route.ts` | Criação de instância WhatsApp — chamado com userId como parâmetro, não há sessão de API aqui | ✅ Justificado |
| `app/api/lancamento/[id]/route.ts` — `getServiceClient()` | Usado **somente** para nullificar FK em `whatsapp_logs` antes de deletar (cascade manual). O user já foi verificado pelo cliente autenticado na linha anterior | ✅ Justificado — escopo limitado |
| `app/api/grupo/convidar/route.ts` | Envia convite pelo número WhatsApp do destinatário — acesso cross-user para buscar instância do grupo | ✅ Justificado |
| `app/api/grupo/aceitar/route.ts` | Aceita convite via token público — não há sessão no momento do aceite | ✅ Justificado |
| `app/api/grupo/ranking/route.ts` | Agrega dados de múltiplos membros do grupo — acesso cross-user por design | ✅ Justificado |
| `app/api/conta/excluir/route.ts` | Cascade delete de transações vinculadas à conta — service role necessário para deletar registros de outros owners se houver compartilhamento | ⚠️ Revisar — verificar se o user tem ownership antes de chamar service role |
| `app/api/bancos/atualizar/route.ts` | Sincronização de dados de bancos (admin) — operação de manutenção | ⚠️ Revisar — adicionar verificação de role admin |
| `app/api/whatsapp/parse/route.ts` | Protegido por `x-n8n-secret`; busca profile por número WhatsApp (cross-user) | ✅ Justificado — protegido por secret |

---

## Regras a seguir

1. **Nunca** retornar o service role key em resposta de API.
2. **Sempre** validar o usuário com o cliente autenticado antes de usar o service role para operações que afetam dados daquele usuário.
3. Os dois itens marcados com ⚠️ devem ser priorizados na próxima revisão de segurança.
4. Para multi-tenant futuro, avaliar Row Security com `set_config('app.current_user_id', ...)`.
