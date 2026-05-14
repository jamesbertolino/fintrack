export const APP_VERSION = '2.13.0'
export const APP_BUILD   = '2026.05.14'

/**
 * Histórico de versões
 * MAJOR.MINOR.PATCH — MINOR sobe em novos recursos essenciais, PATCH em melhorias/fixes
 *
 * 1.0.0 · 2026.05.07 — MVP: dashboard, transações, metas, WhatsApp, IA básica
 * 1.1.0 · 2026.05.08 — Conquistas, sistema de XP e níveis medievais
 * 1.2.0 · 2026.05.09 — Stripe: checkout, portal, webhook, cron de reconciliação
 * 1.3.0 · 2026.05.10 — Segurança: rate limit, RLS auditado, webhooks autenticados
 * 1.4.0 · 2026.05.10 — Tarefas unificadas (Missões + Desafios + Conquistas) + widget
 * 1.5.0 · 2026.05.11 — E-mail transacional (Resend) + onboarding no fluxo + landing checkout
 * 1.6.0 · 2026.05.12 — Testes automatizados (Jest, 24 testes) + versioning semântico da aside
 * 1.7.0 · 2026.05.12 — Tour guiado v2: foco em importação de extrato, WhatsApp e tema medieval
 * 1.8.0 · 2026.05.12 — PWA: manifest, service worker, notificações push (VAPID + web-push)
 * 1.9.0 · 2026.05.12 — Relatório mensal em PDF: extrato, categorias, metas, exportação nativa
 * 2.0.0 · 2026.05.12 — Push integrado: conquistas, metas atingidas, orçamento estourado, missões diárias
 * 2.1.0 · 2026.05.12 — Sistema de indicação: link /ref/[userId], +500 XP por indicação, card "Convidar amigos"
 * 2.2.0 · 2026.05.12 — Importação OFX: parser nativo SGML, deduplicação por FITID, mapeamento de bancos por ISPB
 * 2.3.0 · 2026.05.12 — Multicontas: OFX lê agência/conta, match automático, criação rápida com 1 clique no import
 * 2.3.1 · 2026.05.12 — Dashboard admin: abas Users, Audit Log, Referral stats, gestão de planos
 * 2.3.2 · 2026.05.12 — Fix: audit_log join, xp_bonus, Invalid Date em created_at
 * 2.3.3 · 2026.05.13 — Fix: deduplicação em importações CSV/imagem (ref_externa) + /confirmar trata erro 23505
 * 2.4.0 · 2026.05.13 — Dashboard de importações: tabela importacoes, API, cards com barra inseridas/duplicatas
 * 2.4.1 · 2026.05.13 — Cards de importação expansíveis: lista transações do lote, importacao_id em transactions
 * 2.4.2 · 2026.05.13 — Toast pós-importação: resumo de lançados e duplicatas ignoradas
 * 2.4.3 · 2026.05.13 — Fix: CSV via IA agora gera ref_externa para deduplicação em reimportações
 * 2.4.4 · 2026.05.13 — Modal de edição completo: toggle débito/crédito, valor editável, badge de origem
 * 2.5.0 · 2026.05.13 — Gastos: filtro por conta + exportar CSV com BOM UTF-8
 * 2.5.1 · 2026.05.13 — Filtrar histórico por lote de importação: botão no card expansível + banner
 * 2.6.0 · 2026.05.13 — Dashboard: gráfico de saldo dos últimos 30 dias (SVG inline, sem libs extras)
 * 2.7.0 · 2026.05.13 — Dashboard: widget de orçamento por categoria com barras de progresso e alerta de excesso
 * 2.8.0 · 2026.05.13 — Família App: convite por e-mail, membros com permissão leitura/edição, aba "Pessoas" no perfil
 * 2.9.0 · 2026.05.13 — Dashboard: mapa de calor de gastos por dia (calendário clicável, sem libs externas)
 * 2.10.0 · 2026.05.13 — Dashboard: comparativo mês a mês — receitas, gastos, saldo e top 5 categorias com barras duplas
 * 2.11.0 · 2026.05.13 — Busca global: modal Ctrl+K, filtra por descrição/categoria/valor, atalhos rápidos de navegação
 * 2.12.0 · 2026.05.14 — PWA offline: SW v2 com cache estratégico, banner offline com último saldo, reload automático ao reconectar
 * 2.13.0 · 2026.05.14 — Onboarding revisado: 3 passos (objetivo financeiro, conta bancária, primeiro lançamento) com barra de progresso
 */
