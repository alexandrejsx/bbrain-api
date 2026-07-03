import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class EmailService {
  constructor(private readonly configService: ConfigService) {}

  async send(message: EmailMessage): Promise<void> {
    const provider = this.configService.get<'log' | 'resend'>('email.provider') || 'log';

    if (provider === 'resend') {
      await this.sendWithResend(message);
      return;
    }

    this.logEmail(message);
  }

  private async sendWithResend(message: EmailMessage): Promise<void> {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    const fromEmail = this.configService.get<string>('email.fromEmail');
    const fromName = this.configService.get<string>('email.fromName') || 'BBrain';

    if (!apiKey || !fromEmail) {
      this.logEmail(message);
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Failed to send email with Resend: ${details || response.statusText}`);
    }
  }

  private logEmail(message: EmailMessage): void {
    console.log(
      JSON.stringify(
        {
          type: 'email-preview',
          to: message.to,
          subject: message.subject,
          text: message.text
        },
        null,
        2
      )
    );
  }
}
