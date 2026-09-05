import nodemailer, { Transporter } from "nodemailer";
import pino from "pino";

const logger = pino({
  name: "ethereal-mailer",
  level: process.env.LOG_LEVEL || "info",
});

interface SendEmailParams {
  host?: string;
  port?: number;
  user: string;
  pass: string;
  from?: string;
  to: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

let cachedTestAccount: nodemailer.TestAccount | null = null;

async function getOrCreateTestAccount(): Promise<nodemailer.TestAccount> {
  if (!cachedTestAccount) {
    logger.info("Creating new Ethereal sandbox test account...");
    cachedTestAccount = await nodemailer.createTestAccount();
    logger.info({ user: cachedTestAccount.user }, "Ethereal test account ready");
  }
  return cachedTestAccount;
}

export async function sendEmailViaEthereal(params: SendEmailParams): Promise<SendEmailResult> {
  let user = params.user;
  let pass = params.pass;
  let host = params.host || "smtp.ethereal.email";
  let port = params.port || 587;

  const isInvalidAuth =
    !user ||
    user.includes("placeholder") ||
    user.includes("dev_user") ||
    user.includes("scheduler_sender") ||
    !pass ||
    pass.includes("placeholder") ||
    pass.includes("fake");

  if (isInvalidAuth) {
    const testAccount = await getOrCreateTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    host = testAccount.smtp.host;
    port = testAccount.smtp.port;
  }

  const createTransporter = (u: string, p: string, h: string, prt: number): Transporter => {
    return nodemailer.createTransport({
      host: h,
      port: prt,
      secure: prt === 465,
      auth: {
        user: u,
        pass: p,
      },
    });
  };

  let transporter = createTransporter(user, pass, host, port);

  const mailOptions = {
    from: params.from || user,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: `<p>${params.body.replace(/\n/g, "<br>")}</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    logger.info(
      {
        messageId: info.messageId,
        to: params.to,
        previewUrl,
      },
      "Email sent successfully via Ethereal SMTP"
    );

    return {
      messageId: info.messageId,
      previewUrl,
    };
  } catch (authErr: any) {
    if (authErr?.responseCode === 535 || authErr?.code === "EAUTH") {
      logger.warn("SMTP authentication failed with provided credentials. Falling back to fresh Ethereal sandbox account.");
      const freshAccount = await nodemailer.createTestAccount();
      transporter = createTransporter(
        freshAccount.user,
        freshAccount.pass,
        freshAccount.smtp.host,
        freshAccount.smtp.port
      );
      mailOptions.from = freshAccount.user;
      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);

      logger.info(
        {
          messageId: info.messageId,
          to: params.to,
          previewUrl,
        },
        "Email sent successfully via fallback Ethereal account"
      );

      return {
        messageId: info.messageId,
        previewUrl,
      };
    }
    throw authErr;
  }
}
