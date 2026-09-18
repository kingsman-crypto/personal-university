import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { renderEmailHtml } from '@/lib/emailTemplate';
import { NewsletterIssue, NewsletterSettings } from '@/lib/types';
import { recordDispatch } from '@/lib/dispatchHistory';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { issue, settings } = body as {
      issue: NewsletterIssue;
      settings: NewsletterSettings;
    };

    if (!issue || !settings) {
      return NextResponse.json({ error: 'Issue and settings are required' }, { status: 400 });
    }

    const htmlContent = renderEmailHtml(issue, settings);

    const effectiveGmailUser = (
      settings.gmailUser ||
      process.env.GMAIL_USER ||
      (settings.recipientEmail && settings.recipientEmail.includes('@') ? settings.recipientEmail : '')
    ).trim();
    const effectiveGmailPassword = (
      settings.gmailAppPassword ||
      process.env.GMAIL_APP_PASSWORD ||
      ''
    ).trim().replace(/\s+/g, '');
    const effectiveResendKey = (settings.resendApiKey || process.env.RESEND_API_KEY || '').trim();

    const useGmail =
      settings.emailProvider === 'gmail' ||
      (effectiveGmailUser.length > 3 && effectiveGmailPassword.length > 5 && settings.emailProvider !== 'resend');

    const useResend =
      !useGmail &&
      (settings.emailProvider === 'resend' || effectiveResendKey.length > 5);

    // 1. Google / Gmail SMTP Delivery
    if (useGmail) {
      if (!effectiveGmailUser || !effectiveGmailPassword) {
        return NextResponse.json(
          {
            success: false,
            mode: 'gmail_error',
            error: 'Gmail address or App Password missing. Please configure them in Settings or .env.local.',
          },
          { status: 400 }
        );
      }

      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: effectiveGmailUser,
            pass: effectiveGmailPassword,
          },
        });

        const senderTitle = settings.title || 'Personal University';
        const info = await transporter.sendMail({
          from: `"${senderTitle}" <${effectiveGmailUser}>`,
          to: settings.recipientEmail,
          subject: `${issue.title} — ${issue.date}`,
          html: htmlContent,
        });

        recordDispatch(issue);

        return NextResponse.json({
          success: true,
          mode: 'gmail',
          id: info.messageId,
          message: `Newsletter delivered via Google/Gmail from ${effectiveGmailUser} to ${settings.recipientEmail}`,
        });
      } catch (err: unknown) {
        console.error('Gmail send exception:', err);
        const errMsg = err instanceof Error ? err.message : 'Unknown Gmail error';
        let friendlyMsg = errMsg;
        if (
          errMsg.includes('Invalid login') ||
          errMsg.includes('Username and Password not accepted') ||
          errMsg.includes('535-5.7.8')
        ) {
          friendlyMsg =
            'Google login rejected. Make sure you use a 16-character Google App Password (not your normal Gmail password). 2-Step Verification must be enabled on your Google account.';
        }
        return NextResponse.json(
          {
            success: false,
            mode: 'gmail_error',
            error: friendlyMsg,
          },
          { status: 400 }
        );
      }
    }

    // 2. Resend API Delivery
    if (useResend && effectiveResendKey.length > 5) {
      let senderAddress = (settings.senderEmail || '').trim();
      if (!senderAddress || senderAddress.includes('personaluniversity.edu')) {
        senderAddress = 'Personal University <onboarding@resend.dev>';
      }

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${effectiveResendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: senderAddress,
            to: [settings.recipientEmail],
            subject: `${issue.title} — ${issue.date}`,
            html: htmlContent,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          let errorMsg = data.message || 'Resend delivery failed';
          if (errorMsg.includes('domain') && errorMsg.includes('not verified')) {
            errorMsg = `Resend error: Sender domain is not verified. Use 'onboarding@resend.dev' or verify your custom domain in Resend. (${data.message})`;
          } else if (errorMsg.includes('only send testing emails to your own email address')) {
            errorMsg = `Resend sandbox restriction: With 'onboarding@resend.dev', you can only send to the email address registered to your Resend account. (${data.message})`;
          }

          return NextResponse.json(
            { success: false, error: errorMsg, mode: 'resend_error' },
            { status: 400 }
          );
        }

        recordDispatch(issue);

        return NextResponse.json({
          success: true,
          mode: 'resend',
          id: data.id,
          message: `Newsletter delivered via Resend to ${settings.recipientEmail}`,
        });
      } catch (err: unknown) {
        console.error('Resend delivery exception:', err);
        const errorMsg = err instanceof Error ? err.message : 'Network error connecting to Resend';
        return NextResponse.json(
          { success: false, error: `Failed to contact Resend API: ${errorMsg}`, mode: 'resend_error' },
          { status: 502 }
        );
      }
    }

    // 3. Default: Mock simulated delivery
    return NextResponse.json({
      success: true,
      mode: 'mock',
      recipient: settings.recipientEmail,
      subject: `${issue.title} — ${issue.date}`,
      timestamp: new Date().toISOString(),
      message: `Simulated Dispatch: Issue previewed for ${settings.recipientEmail}. To deliver real emails to your inbox, configure Google/Gmail or Resend in Settings or .env.local.`,
      htmlPreview: htmlContent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Send API error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const hasServerResendKey = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 5
  );
  const hasServerGmail = Boolean(
    process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  );
  return NextResponse.json({
    configured: hasServerResendKey || hasServerGmail,
    hasResend: hasServerResendKey,
    hasGmail: hasServerGmail,
  });
}
