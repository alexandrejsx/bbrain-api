type PasswordResetEmailTemplateInput = {
  code: string;
  userName: string;
  expiresInMinutes: number;
};

export function buildPasswordResetEmailTemplate({
  code,
  userName,
  expiresInMinutes
}: PasswordResetEmailTemplateInput) {
  const subject = 'Seu codigo de confirmacao do BBrain';
  const greetingName = userName.trim().split(' ')[0] || 'voce';
  const html = `
    <div style="margin:0;padding:32px 16px;background:#f4f1ea;font-family:Inter,Segoe UI,Arial,sans-serif;color:#163127;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="margin-bottom:18px;">
          <span style="display:inline-block;padding:8px 14px;border-radius:999px;background:#dcefe6;color:#225240;font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;">
            BBrain
          </span>
        </div>
        <div style="background:#fffdf8;border:1px solid #dfe5db;border-radius:28px;overflow:hidden;box-shadow:0 18px 40px rgba(35,58,46,0.08);">
          <div style="padding:40px 40px 28px;background:linear-gradient(135deg,#f7f5ef 0%,#eef7f1 100%);border-bottom:1px solid #e5eadf;">
            <div style="display:inline-block;padding:10px 14px;border-radius:16px;background:#ffffff;color:#225240;font-size:13px;font-weight:700;">
              Recuperacao de senha
            </div>
            <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.15;color:#163127;">
              Vamos cuidar do seu acesso com seguranca.
            </h1>
            <p style="margin:0;font-size:16px;line-height:1.7;color:#486156;">
              Oi, ${greetingName}. Recebemos um pedido para redefinir sua senha no BBrain.
            </p>
          </div>
          <div style="padding:32px 40px 36px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#31493f;">
              Use o codigo abaixo para confirmar que foi voce. Ele expira em ${expiresInMinutes} minutos.
            </p>
            <div style="margin:28px 0;padding:24px;border-radius:24px;background:#163127;color:#f8fbf9;text-align:center;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.72;">
                Codigo de confirmacao
              </div>
              <div style="margin-top:10px;font-size:40px;font-weight:800;letter-spacing:0.28em;">
                ${code}
              </div>
            </div>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#486156;">
              Se voce nao pediu essa alteracao, pode ignorar este email com tranquilidade. Sua senha atual continua protegida.
            </p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#60766c;">
              O BBrain nao pede este codigo por telefone, chat ou redes sociais.
            </p>
          </div>
        </div>
      </div>
    </div>
  `.trim();

  const text = [
    'BBrain - Recuperacao de senha',
    '',
    `Oi, ${greetingName}.`,
    `Use este codigo para redefinir sua senha: ${code}`,
    `Ele expira em ${expiresInMinutes} minutos.`,
    '',
    'Se voce nao pediu essa alteracao, ignore este email.'
  ].join('\n');

  return { subject, html, text };
}
