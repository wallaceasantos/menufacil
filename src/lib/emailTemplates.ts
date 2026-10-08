export interface EmailTemplate {
  subject: string
  text: string
  html: string
}

function shell(title: string, bodyHtml: string, footer: string): string {
  return `
  <div style="background:#f4f4f5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#ea580c;padding:20px 24px;">
          <span style="color:#ffffff;font-size:20px;font-weight:bold;">MenuFácil</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px;">
          <h1 style="margin:0 0 16px;font-size:18px;color:#18181b;">${title}</h1>
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background:#f4f4f5;padding:16px 24px;font-size:12px;color:#71717a;">
          ${footer}
        </td>
      </tr>
    </table>
  </div>`
}

function buttonHtml(link: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:#ea580c;border-radius:8px;">
        <a href="${link}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;">${label}</a>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 16px;font-size:13px;color:#71717a;">
    Se o botão não funcionar, copie e cole este link no navegador:<br/>
    <span style="word-break:break-all;color:#ea580c;">${link}</span>
  </p>`
}

export function resetPasswordEmail(name: string, resetLink: string): EmailTemplate {
  return {
    subject: 'Recuperação de senha — MenuFácil',
    text: `Olá, ${name}.\n\nRecebemos uma solicitação para redefinir sua senha no MenuFácil.\n\nAcesse o link abaixo para criar uma nova senha (válido por 1 hora):\n${resetLink}\n\nSe você não solicitou esta alteração, ignore este email. Sua senha permanecerá a mesma.`,
    html: shell(
      'Redefina sua senha',
      `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">Olá, <strong>${name}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
        Recebemos uma solicitação para redefinir sua senha no <strong>MenuFácil</strong>.
      </p>
      ${buttonHtml(resetLink, 'Criar nova senha')}
      <p style="margin:0 0 8px;font-size:13px;color:#71717a;">⏱ Este link é válido por <strong>1 hora</strong> e pode ser usado uma única vez.</p>
      <p style="margin:0;font-size:13px;color:#71717a;">
        Se você não solicitou esta alteração, ignore este email. Sua senha permanecerá a mesma.
      </p>`,
      'Você recebeu este email porque há uma recuperação de senha em andamento na sua conta.'
    ),
  }
}

export function passwordChangedEmail(name: string): EmailTemplate {
  return {
    subject: 'Sua senha foi alterada — MenuFácil',
    text: `Olá, ${name}.\n\nSua senha no MenuFácil foi alterada com sucesso.\n\nSe você não fez esta alteração, recupere seu acesso imediatamente pela opção "Esqueci minha senha" na tela de login.`,
    html: shell(
      'Senha alterada',
      `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">Olá, <strong>${name}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
        Sua senha no <strong>MenuFácil</strong> foi alterada com sucesso.
      </p>
      <p style="margin:0;padding:12px 16px;background:#fef2f2;border-radius:8px;font-size:13px;color:#b91c1c;">
        <strong>Não foi você?</strong> Recupere seu acesso imediatamente pela opção <strong>"Esqueci minha senha"</strong> na tela de login.
      </p>`,
      'Este é um aviso automático de segurança da sua conta MenuFácil.'
    ),
  }
}