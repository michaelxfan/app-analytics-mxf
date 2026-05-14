import { Resend } from "resend";

export async function sendWeeklyEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  const from = process.env.RESEND_FROM_EMAIL || "App Analytics <onboarding@resend.dev>";
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
  });
  return { id: result.data?.id ?? null };
}
