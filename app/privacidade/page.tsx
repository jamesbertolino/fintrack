import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — PoupaUp',
  description: 'Como o PoupaUp coleta, usa e protege seus dados pessoais.',
}

const S = {
  page:    { minHeight: '100vh', background: '#080b0f', color: '#ededed', fontFamily: 'system-ui, sans-serif', padding: '0 1.5rem 4rem' } as React.CSSProperties,
  header:  { maxWidth: 780, margin: '0 auto', padding: '2rem 0 1.5rem', borderBottom: '1px solid #1e2d1e' } as React.CSSProperties,
  body:    { maxWidth: 780, margin: '0 auto', paddingTop: '2.5rem' } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 } as React.CSSProperties,
  meta:    { fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 8 } as React.CSSProperties,
  h2:      { fontSize: 17, fontWeight: 600, color: '#4ade80', marginTop: '2.5rem', marginBottom: '.75rem' } as React.CSSProperties,
  h3:      { fontSize: 14, fontWeight: 600, color: '#ededed', marginTop: '1.5rem', marginBottom: '.5rem' } as React.CSSProperties,
  p:       { fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,.7)', margin: '0 0 1rem' } as React.CSSProperties,
  ul:      { fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,.7)', paddingLeft: '1.5rem', margin: '0 0 1rem' } as React.CSSProperties,
  divider: { border: 'none', borderTop: '1px solid #1e2d1e', margin: '2rem 0' } as React.CSSProperties,
  back:    { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none' } as React.CSSProperties,
}

export default function PrivacidadePage() {
  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/" style={S.back}>← Voltar ao início</Link>
        <h1 style={{ ...S.h1, marginTop: '1.5rem' }}>Política de Privacidade</h1>
        <p style={S.meta}>Última atualização: 7 de maio de 2026 · Versão 1.0</p>
      </header>

      <div style={S.body}>
        <p style={S.p}>
          O <strong style={{ color: '#fff' }}>PoupaUp</strong> é uma plataforma de controle financeiro pessoal e familiar. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais, em conformidade com a <strong style={{ color: '#fff' }}>Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)</strong>.
        </p>

        {/* ── 1. Controlador ── */}
        <h2 style={S.h2}>1. Controlador dos Dados</h2>
        <p style={S.p}>
          O controlador dos dados pessoais coletados por esta plataforma é o <strong style={{ color: '#fff' }}>PoupaUp</strong>. Para dúvidas ou solicitações relacionadas a privacidade, entre em contato pelo e-mail <strong style={{ color: '#4ade80' }}>privacidade@poupaup.com.br</strong>.
        </p>

        {/* ── 2. Dados coletados ── */}
        <h2 style={S.h2}>2. Dados Pessoais Coletados</h2>
        <h3 style={S.h3}>2.1 Dados fornecidos por você</h3>
        <ul style={S.ul}>
          <li>Nome e sobrenome</li>
          <li>Endereço de e-mail</li>
          <li>Número de WhatsApp (opcional, para integração)</li>
          <li>Data de nascimento e gênero (opcional)</li>
          <li>Dados financeiros: lançamentos, categorias, metas, orçamentos e contas bancárias</li>
        </ul>
        <h3 style={S.h3}>2.2 Dados coletados automaticamente</h3>
        <ul style={S.ul}>
          <li>Endereço IP (para rate limiting e segurança)</li>
          <li>Fuso horário e idioma do navegador</li>
          <li>Logs de acesso às APIs (sem conteúdo de mensagens)</li>
        </ul>

        {/* ── 3. Finalidade ── */}
        <h2 style={S.h2}>3. Finalidade e Base Legal</h2>
        <ul style={S.ul}>
          <li><strong style={{ color: '#fff' }}>Execução de contrato:</strong> prover o serviço de controle financeiro, incluindo lançamentos via WhatsApp.</li>
          <li><strong style={{ color: '#fff' }}>Legítimo interesse:</strong> segurança da plataforma, prevenção de abusos e rate limiting.</li>
          <li><strong style={{ color: '#fff' }}>Consentimento:</strong> envio de notificações e funcionalidades de IA financeira. Você pode revogar a qualquer momento.</li>
        </ul>

        {/* ── 4. Compartilhamento ── */}
        <h2 style={S.h2}>4. Compartilhamento de Dados</h2>
        <p style={S.p}>Seus dados <strong style={{ color: '#fff' }}>não são vendidos</strong> a terceiros. Utilizamos os seguintes subprocessadores:</p>
        <ul style={S.ul}>
          <li><strong style={{ color: '#fff' }}>Supabase</strong> — banco de dados e autenticação (servidores na AWS, região us-east-1)</li>
          <li><strong style={{ color: '#fff' }}>Vercel</strong> — hospedagem da aplicação</li>
          <li><strong style={{ color: '#fff' }}>Anthropic / OpenAI</strong> — processamento de linguagem natural para categorização (dados enviados de forma anônima sempre que possível)</li>
          <li><strong style={{ color: '#fff' }}>Evolution API</strong> — integração com WhatsApp (auto-hospedada)</li>
        </ul>

        {/* ── 5. Retenção ── */}
        <h2 style={S.h2}>5. Retenção de Dados</h2>
        <ul style={S.ul}>
          <li>Dados de conta e financeiros: mantidos enquanto a conta estiver ativa.</li>
          <li>Logs de acesso: 90 dias.</li>
          <li>Após exclusão da conta: dados removidos em até 30 dias, salvo obrigação legal.</li>
        </ul>

        {/* ── 6. Direitos LGPD ── */}
        <h2 style={S.h2}>6. Seus Direitos (LGPD Art. 18)</h2>
        <p style={S.p}>Você tem direito a:</p>
        <ul style={S.ul}>
          <li>Confirmar a existência de tratamento dos seus dados</li>
          <li>Acessar seus dados pessoais</li>
          <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
          <li>Solicitar anonimização, bloqueio ou eliminação</li>
          <li>Portabilidade dos dados (exportação em formato aberto)</li>
          <li>Revogar consentimento a qualquer momento</li>
          <li>Opor-se ao tratamento em caso de descumprimento da LGPD</li>
        </ul>
        <p style={S.p}>
          Para exercer seus direitos, acesse as configurações do seu perfil ou envie e-mail para <strong style={{ color: '#4ade80' }}>privacidade@poupaup.com.br</strong>. Responderemos em até 15 dias úteis.
        </p>

        {/* ── 7. Segurança ── */}
        <h2 style={S.h2}>7. Segurança</h2>
        <ul style={S.ul}>
          <li>Comunicações protegidas por TLS/HTTPS</li>
          <li>Autenticação gerenciada pelo Supabase Auth com tokens JWT</li>
          <li>Políticas de Row Level Security (RLS) no banco de dados</li>
          <li>Rate limiting nas APIs para prevenir abusos</li>
          <li>Sem armazenamento de senhas em texto claro</li>
        </ul>

        <hr style={S.divider} />

        {/* ── Termos de Uso ── */}
        <h2 id="termos" style={S.h2}>Termos de Uso</h2>
        <p style={S.p}>
          Ao utilizar o PoupaUp, você concorda com os seguintes termos:
        </p>
        <ul style={S.ul}>
          <li>O serviço é fornecido <em>como está</em>, sem garantias de disponibilidade ininterrupta.</li>
          <li>Você é responsável pela veracidade dos dados financeiros inseridos.</li>
          <li>É proibido usar a plataforma para fins ilegais, fraude ou engenharia reversa.</li>
          <li>O PoupaUp pode suspender contas que violem estes termos.</li>
          <li>A integração via WhatsApp depende da disponibilidade de serviços de terceiros.</li>
          <li>Dados financeiros são de uso exclusivo do titular da conta.</li>
        </ul>
        <p style={S.p}>
          O uso continuado do serviço após alterações nesta política constitui aceitação dos novos termos.
        </p>

        <hr style={S.divider} />
        <p style={{ ...S.p, fontSize: 12, color: 'rgba(255,255,255,.25)' }}>
          PoupaUp · privacidade@poupaup.com.br · Versão 1.0 · 2026-05-07
        </p>
      </div>
    </div>
  )
}
