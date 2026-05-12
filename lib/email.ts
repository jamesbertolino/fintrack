import { Resend } from 'resend'

const FROM = 'PoupaUp <noreply@poupaup.com.br>'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

// ─── Boas-vindas ──────────────────────────────────────────────────────────────

export async function enviarEmailBoasVindas(para: string, nome: string) {
  if (!process.env.RESEND_API_KEY) return
  const resend = getResend()
  await resend.emails.send({
    from: FROM,
    to: para,
    subject: `Bem-vindo ao PoupaUp, ${nome}! 🏰`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">🏰</div>
      <div style="color:#fff;font-size:22px;font-weight:700">Bem-vindo ao PoupaUp!</div>
      <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:4px">Sua jornada financeira começa agora</div>
    </div>
    <div style="padding:32px 40px">
      <p style="color:#e2e8f0;font-size:16px;margin:0 0 16px">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px">
        Você acaba de dar o primeiro passo para dominar suas finanças. No PoupaUp você vai conseguir:
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:28px">
        ${['📊 Controlar receitas e despesas com facilidade','🎯 Criar metas e acompanhar seu progresso','⚔️ Completar desafios e subir de nível','🏆 Desbloquear conquistas ao longo da jornada'].map(item => `
        <div style="display:flex;align-items:center;gap:10px;background:#0f0f1a;border:1px solid #2a2a4a;border-radius:8px;padding:12px 16px">
          <span style="font-size:18px">${item.split(' ')[0]}</span>
          <span style="color:#cbd5e1;font-size:13px">${item.split(' ').slice(1).join(' ')}</span>
        </div>`).join('')}
      </div>
      <div style="text-align:center;margin-bottom:28px">
        <a href="https://poupaup.com.br/dashboard"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">
          Acessar meu painel →
        </a>
      </div>
      <p style="color:#64748b;font-size:12px;text-align:center;margin:0">
        Qualquer dúvida, responda este e-mail — estamos aqui para ajudar.
      </p>
    </div>
    <div style="background:#0f0f1a;padding:16px 40px;text-align:center;border-top:1px solid #2a2a4a">
      <p style="color:#475569;font-size:11px;margin:0">© ${new Date().getFullYear()} PoupaUp · <a href="https://poupaup.com.br/privacidade" style="color:#6366f1;text-decoration:none">Privacidade</a></p>
    </div>
  </div>
</body>
</html>`,
  })
}

// ─── Pagamento confirmado ─────────────────────────────────────────────────────

export async function enviarEmailPagamentoConfirmado(para: string, nome: string, plano: string) {
  if (!process.env.RESEND_API_KEY) return
  const resend = getResend()
  const nomeFormatado = plano.charAt(0).toUpperCase() + plano.slice(1)
  await resend.emails.send({
    from: FROM,
    to: para,
    subject: `Plano ${nomeFormatado} ativado com sucesso! 🎉`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 40px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">✅</div>
      <div style="color:#fff;font-size:22px;font-weight:700">Pagamento confirmado!</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">Plano ${nomeFormatado} ativado</div>
    </div>
    <div style="padding:32px 40px">
      <p style="color:#e2e8f0;font-size:16px;margin:0 0 16px">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px">
        Seu plano <strong style="color:#10b981">${nomeFormatado}</strong> foi ativado com sucesso.
        Você agora tem acesso completo a todos os recursos premium.
      </p>
      <div style="background:#0f0f1a;border:1px solid #059669;border-radius:8px;padding:16px 20px;margin-bottom:28px">
        <p style="color:#6ee7b7;font-size:13px;font-weight:600;margin:0 0 8px">O que você ganhou:</p>
        <ul style="color:#94a3b8;font-size:13px;line-height:1.8;margin:0;padding-left:18px">
          <li>Inteligência artificial ilimitada para análise de gastos</li>
          <li>WhatsApp integrado para lançar transações por mensagem</li>
          <li>Relatórios e gráficos avançados</li>
          <li>Exportação de dados em qualquer formato</li>
        </ul>
      </div>
      <div style="text-align:center;margin-bottom:28px">
        <a href="https://poupaup.com.br/dashboard"
           style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">
          Ir para o painel →
        </a>
      </div>
      <p style="color:#64748b;font-size:12px;text-align:center;margin:0">
        Você pode gerenciar sua assinatura a qualquer momento em <a href="https://poupaup.com.br/dashboard/perfil" style="color:#6366f1;text-decoration:none">Configurações → Perfil</a>.
      </p>
    </div>
    <div style="background:#0f0f1a;padding:16px 40px;text-align:center;border-top:1px solid #2a2a4a">
      <p style="color:#475569;font-size:11px;margin:0">© ${new Date().getFullYear()} PoupaUp · <a href="https://poupaup.com.br/privacidade" style="color:#6366f1;text-decoration:none">Privacidade</a></p>
    </div>
  </div>
</body>
</html>`,
  })
}

// ─── Falha de cobrança ────────────────────────────────────────────────────────

export async function enviarEmailFalhaCobranca(para: string, nome: string) {
  if (!process.env.RESEND_API_KEY) return
  const resend = getResend()
  await resend.emails.send({
    from: FROM,
    to: para,
    subject: 'Ação necessária: problema com seu pagamento ⚠️',
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#b45309,#d97706);padding:32px 40px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">⚠️</div>
      <div style="color:#fff;font-size:22px;font-weight:700">Problema no pagamento</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">Ação necessária para manter seu plano</div>
    </div>
    <div style="padding:32px 40px">
      <p style="color:#e2e8f0;font-size:16px;margin:0 0 16px">Olá, <strong>${nome}</strong>!</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px">
        Não conseguimos processar o pagamento da sua assinatura.
        Para evitar a perda de acesso aos recursos premium, atualize seu método de pagamento.
      </p>
      <div style="background:#431407;border:1px solid #b45309;border-radius:8px;padding:14px 18px;margin-bottom:28px">
        <p style="color:#fbbf24;font-size:13px;margin:0">
          ⏱️ Se o pagamento não for regularizado em breve, seu plano será revertido para o gratuito automaticamente.
        </p>
      </div>
      <div style="text-align:center;margin-bottom:28px">
        <a href="https://poupaup.com.br/api/stripe/portal"
           style="display:inline-block;background:linear-gradient(135deg,#b45309,#d97706);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">
          Atualizar método de pagamento →
        </a>
      </div>
      <p style="color:#64748b;font-size:12px;text-align:center;margin:0">
        Precisa de ajuda? Responda este e-mail e te auxiliamos.
      </p>
    </div>
    <div style="background:#0f0f1a;padding:16px 40px;text-align:center;border-top:1px solid #2a2a4a">
      <p style="color:#475569;font-size:11px;margin:0">© ${new Date().getFullYear()} PoupaUp · <a href="https://poupaup.com.br/privacidade" style="color:#6366f1;text-decoration:none">Privacidade</a></p>
    </div>
  </div>
</body>
</html>`,
  })
}
