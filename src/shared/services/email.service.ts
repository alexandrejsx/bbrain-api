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
    const provider = this.configService.get<'log' | 'resend'>('email.provider');

    if (provider === 'resend') {
      await this.sendWithResend(message);
      return;
    }

    if (provider === 'log') {
      this.logEmail();
      return;
    }

    throw new Error('Email provider is not configured');
  }

  private async sendWithResend(message: EmailMessage): Promise<void> {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    const fromEmail = this.configService.get<string>('email.fromEmail');
    const fromName = this.configService.get<string>('email.fromName') || 'BBrain';

    if (!apiKey || !fromEmail) {
      throw new Error('Email provider credentials are incomplete');
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
      throw new Error(`Email provider request failed status=${response.status}`);
    }
  }

  private logEmail(): void {
    console.log(
      JSON.stringify(
        {
          type: 'email-preview',
          delivery: 'suppressed'
        },
        null,
        2
      )
    );
  }
}
