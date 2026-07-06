import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'suporte@menufacil.com';

const transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

export interface EmailAttachment {
  filename: string;
  url: string;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}) {
  if (!transporter) {
    console.log('[Email] SMTP não configurado. E-mail não enviado.');
    console.log('Destinatário:', to);
    console.log('Assunto:', subject);
    console.log('Texto:', text);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    const nodemailerAttachments = attachments
      ? await Promise.all(
          attachments.map(async (att) => {
            try {
              const response = await fetch(att.url);
              if (!response.ok) throw new Error('Failed to fetch attachment');
              const buffer = Buffer.from(await response.arrayBuffer());
              return {
                filename: att.filename,
                content: buffer,
              };
            } catch (err) {
              console.error(`[Email] Erro ao baixar anexo ${att.filename}:`, err);
              return null;
            }
          })
        ).then((results) => results.filter(Boolean) as { filename: string; content: Buffer }[])
      : undefined;

    const info = await transporter.sendMail({
      from: `"MenuFácil Suporte" <${SMTP_FROM}>`,
      to,
      subject,
      text,
      html,
      attachments: nodemailerAttachments,
    });

    console.log('[Email] Enviado:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email] Erro ao enviar:', err);
    return { sent: false, reason: 'send_error', error: err };
  }
}
