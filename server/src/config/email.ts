import { Resend } from "resend";
import { env } from "./env.js";
import { logger } from "./logger.js";

const log = logger.child({ name: "email" });

export const resend = new Resend(env.RESEND_API_KEY);

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a transactional email via Resend.
 * Returns true on success. Throws AppError on failure.
 */
export const sendEmail = async (input: SendEmailInput): Promise<boolean> => {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    log.error({ err: error, to: input.to }, "email send failed");
    // Don't throw — we don't want a failed email to roll back a successful signup.
    return false;
  }

  log.info({ id: data?.id, to: input.to }, "email sent");
  return true;
};