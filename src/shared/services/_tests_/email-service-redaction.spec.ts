import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';

const resetEmail = {
  to: 'private.person@example.com',
  subject: 'Código para redefinir sua senha',
  html: '<p>Seu código é 928174</p>',
  text: 'Seu código é 928174'
};

function serviceWith(values: Record<string, unknown>): EmailService {
  return new EmailService({
    get: jest.fn((key: string) => values[key])
  } as unknown as ConfigService);
}

describe('EmailService sensitive log redaction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not log recipient, subject or reset body in preview mode', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await serviceWith({ 'email.provider': 'log' }).send(resetEmail);

    const serializedLogs = JSON.stringify(log.mock.calls);
    expect(serializedLogs).toContain('email-preview');
    expect(serializedLogs).toContain('suppressed');
    expect(serializedLogs).not.toContain(resetEmail.to);
    expect(serializedLogs).not.toContain(resetEmail.subject);
    expect(serializedLogs).not.toContain('928174');
  });

  it('does not include a Resend response body in the propagated error', async () => {
    const responseText = jest.fn().mockResolvedValue('recipient and provider secret details');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: responseText
    } as unknown as Response);
    const service = serviceWith({
      'email.provider': 'resend',
      'email.resendApiKey': 'secret-api-key',
      'email.fromEmail': 'noreply@example.com',
      'email.fromName': 'BBrain'
    });

    await expect(service.send(resetEmail)).rejects.toThrow(
      'Email provider request failed status=422'
    );
    expect(responseText).not.toHaveBeenCalled();
  });

  it('fails closed instead of suppressing delivery when Resend credentials are incomplete', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(serviceWith({ 'email.provider': 'resend' }).send(resetEmail)).rejects.toThrow(
      'Email provider credentials are incomplete'
    );
    expect(log).not.toHaveBeenCalled();
  });
});
