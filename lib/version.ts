export const APP_VERSION = '2.33.2'
export const APP_BUILD   = '2026.05.25'

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
 * 2.14.0 · 2026.05.14 — Relatório IA mensal: análise por IA com resumo, gastos, tendências e recomendações personalizadas pelo objetivo
 * 2.15.0 · 2026.05.14 — Notificações inteligentes: cron diário com resumo semanal, aviso de meta e alerta de orçamento; toggles no perfil
 * 2.16.0 · 2026.05.14 — Modo TV/Kiosk: tela cheia com relógio, saldo total, métricas do mês, contas, categorias, metas e transações
 * 2.17.0 · 2026.05.14 — Planejamento anual: projeção de 12 meses com cenários pessimista/realista/otimista, gráfico SVG e tabela detalhada
 * 2.18.0 · 2026.05.14 — Simulador de dívidas: métodos bola de neve e avalanche, gráfico comparativo, cronograma por dívida
 * 2.19.0 · 2026.05.14 — Score financeiro 0-1000: 6 dimensões, gauge SVG, dicas personalizadas e widget no dashboard
 * 2.20.0 · 2026.05.14 — Família avançada: dashboard consolidado com saldo, receitas, gastos, metas e comparativo por membro
 * 2.21.0 · 2026.05.14 — Categorias personalizadas: criar, editar, colorir com paleta e ícones emoji; gerenciar do sidebar
 * 2.22.0 · 2026.05.14 — Alerta de orçamento no lançamento: banner ⚠️/🚨 mostra % usado ou estouro ao selecionar categoria com limite
 * 2.23.0 · 2026.05.14 — Metas com aportes: registrar aportes manuais, histórico, remoção e projeção de conclusão pela média dos últimos 3
 * 2.24.0 · 2026.05.14 — Meta compartilhada: compartilhar meta com família via 🔗, aba Família com aportes de todos os membros
 * 2.25.0 · 2026.05.14 — Relatório PDF: donut SVG de categorias, barras semanais receita/despesa, cards de meta, rodapé e impressão otimizada
 * 2.26.0 · 2026.05.14 — Finanças do grupo familiar: fontes (conta/espécie/cheque) com saldo, extrato consolidado com running balance e totais
 * 2.27.0 · 2026.05.14 — Importação melhorada: padrões aprendidos (🧠 memorizado / 🔑 palavra-chave / 🤖 IA) com persistência em categoria_aprendida
 * 2.28.0 · 2026.05.15 — Correção de 12 bugs críticos: parsers de importação, score financeiro e segurança
 * 2.28.1 · 2026.05.24 — Fix: login mobile coluna única, botão Sair + versão no menu mobile
 * 2.28.2 · 2026.05.24 — Fix: SW auto-reload na atualização, botão Sair visível, manifest version
 * 2.28.3 · 2026.05.24 — Fix: banner instalar PWA no mobile, ícone velocímetro na tela inicial
 * 2.28.4 · 2026.05.25 — Fix: SW registro global, MobileBottomNav em todas as páginas
 * 2.28.5 · 2026.05.25 — Fix: captura beforeinstallprompt antes do React montar (banner PWA Android)
 * 2.28.6 · 2026.05.25 — Fix: lint InstallPWA — useRef para prompt evita setState síncrono no effect
 * 2.28.7 · 2026.05.25 — Chore: bump de versão para forçar atualização do SW no celular
 * 2.28.8 · 2026.05.25 — Chore: bump de versão para forçar atualização do SW no celular
 * 2.28.9 · 2026.05.25 — Chore: bump de versão para forçar atualização do SW no celular
 * 2.29.0 · 2026.05.25 — Fix: banner instalar PWA sempre aparece no mobile (sem depender de beforeinstallprompt); remove pull-to-refresh via overscroll-behavior:none
 * 2.29.1 · 2026.05.25 — Chore: bump de versão para forçar atualização do SW no celular
 * 2.29.2 · 2026.05.25 — Fix: remove avatar/perfil resumido da aside, mantém apenas no topo direito
 * 2.29.3 · 2026.05.25 — Fix: remove banner PWA falso (enganoso), APK real via PWABuilder + assetlinks.json pendente
 * 2.29.4 · 2026.05.25 — Fix: remove espaço em branco no final de todas as páginas no mobile (spacer div substitui padding no layout)
 * 2.29.5 · 2026.05.25 — Fix: barra branca no fundo do mobile — body sem background herdava branco do browser
 * 2.29.6 · 2026.05.25 — Fix: mobile-bottom-nav some no mobile — display:none global sobrescrevia o @media; invertido para min-width
 * 2.29.7 · 2026.05.25 — Chore: bump de versão para forçar atualização do SW no celular
 * 2.29.8 · 2026.05.25 — Fix: orçamentos mobile — layout em card com 3 colunas de valores, barra de progresso e botões largos
 * 2.29.9 · 2026.05.25 — Chore: bump de versão para forçar atualização do SW no celular
 * 2.30.0 · 2026.05.25 — Fix: metadataBase corrige URLs localhost no HTML; manifest aponta para launchericon-512x512.png
 * 2.30.1 · 2026.05.25 — Fix: manifest via app/manifest.ts (Next.js nativo) resolve redirect 307 do Vercel no /manifest.json
 * 2.30.2 · 2026.05.25 — Fix: remove manifest link manual do metadata; app/manifest.ts gera /manifest.webmanifest com ícone 512x512 correto
 * 2.30.3 · 2026.05.25 — Fix: adiciona launchericon-512x512.png como link icon no HTML para PWABuilder detectar
 * 2.30.4 · 2026.05.25 — Fix: middleware não intercepta mais sw.js e manifest.webmanifest (retornavam HTML para PWABuilder)
 * 2.30.5 · 2026.05.25 — Fix: MobileBottomNav z-index 9000 + translateZ(0) para nunca sumir em modals ou APK
 * 2.30.6 · 2026.05.25 — Fix: mensagem de loading do dashboard respeita tema — medieval "Convocando o Reino..." / padrão "Carregando seu painel..."
 * 2.30.7 · 2026.05.25 — UX: tema escuro — textMuted .4→.65, textFaint .25→.45, cards mais brilhantes para melhor legibilidade
 * 2.30.8 · 2026.05.25 — Fix: gastos mobile — layout em lista com descrição grande na linha 1, categoria+data pequenos na linha 2
 * 2.30.9 · 2026.05.25 — Fix: MobileBottomNav sempre visível no APK — layout flex com scroll interno, nav estático no rodapé
 * 2.31.0 · 2026.05.25 — Fix: filtros de gastos mobile — 3 linhas organizadas (busca / tipo+categoria / conta+ações) em vez de flex-wrap descontrolado
 * 2.31.1 · 2026.05.25 — Fix: dashboard home mobile — aside oculto + layout flex corrigido via dashboard-page-root; nav sempre visível
 * 2.31.2 · 2026.05.25 — Fix: nav mobile volta a position:fixed; remove flex-layout que causava 2 colunas no APK; padding-bottom no conteúdo
 * 2.31.3 · 2026.05.25 — Fix: MobileBottomNav display:flex no inline style — botões voltam a ser horizontais
 * 2.31.4 · 2026.05.25 — Fix: aside do dashboard some no mobile via display:none inline (sem depender de transform ou CSS externo)
 * 2.31.5 · 2026.05.25 — Fix: useIsMobile usa matchMedia em vez de innerWidth — funciona corretamente no Android WebView/TWA
 * 2.32.0 · 2026.05.25 — Fix: aside oculto por CSS global (mobile-first, show só no desktop); cards Receitas/Gastos navegam para gastos?tipo=credito/debito
 * 2.32.1 · 2026.05.25 — Fix: useSearchParams envolto em Suspense — corrige erro de build no /dashboard/gastos
 * 2.32.2 · 2026.05.25 — Fix: aside do dashboard não renderiza no servidor nem no mobile — elimina menu fantasma no APK
 * 2.33.0 · 2026.05.25 — Filtro de data livre em gastos (de/até com inputs date); cards dashboard passam período exato via URL
 * 2.33.1 · 2026.05.25 — Fix: lint — eslint-disable no setMounted effect
 * 2.33.2 · 2026.05.25 — UX: filtro de período em gastos retraído no mobile — botão compacto que expande ao tocar
 */
