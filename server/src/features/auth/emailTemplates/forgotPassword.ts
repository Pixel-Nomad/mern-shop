interface ForgotPasswordTemplateInput {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export const forgotPasswordTemplate = (
  input: ForgotPasswordTemplateInput,
): { subject: string; html: string; text: string } => {
  const { name, resetUrl, expiresInMinutes } = input;

  const subject = "Reset your MERN Shop password";

  const text = `Hi ${name},

You (or someone using your email) requested a password reset for your MERN Shop account.

Click this link to set a new password:

${resetUrl}

This link expires in ${expiresInMinutes} minutes. If you didn't request this, ignore this email — your password won't change.

— The MERN Shop Team`;

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f4f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;font-weight:600;color:#111827;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;font-size:15px;line-height:24px;color:#374151;">
                <p style="margin:0 0 16px 0;">Hi ${name},</p>
                <p style="margin:0 0 24px 0;">Someone requested a password reset for your account. If that was you, click the button below to set a new password.</p>
                <p style="margin:0 0 24px 0;">
                  <a href="${resetUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;">Reset password</a>
                </p>
                <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">Or copy this link into your browser:</p>
                <p style="margin:0 0 24px 0;font-size:13px;color:#dc2626;word-break:break-all;">${resetUrl}</p>
                <p style="margin:0;font-size:13px;color:#6b7280;">This link expires in ${expiresInMinutes} minutes.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
                If you didn't request this, you can safely ignore this email — your password won't change.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  return { subject, html, text };
};