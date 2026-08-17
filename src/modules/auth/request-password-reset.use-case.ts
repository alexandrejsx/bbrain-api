import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { Email } from '../../domain/users/value-objects/email.vo';
import { buildPasswordResetEmailTemplate } from '../../shared/email-templates/password-reset-email.template';
import { EmailService } from '../../shared/services/email.service';
import { PasswordHashService } from '../../shared/services/password-hash.service';
import { AccountLifecycleService } from './account-lifecycle.service';

export interface RequestPasswordResetInput {
  email: string;
}

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly passwordHashService: PasswordHashService,
    private readonly emailService: EmailService,
    private readonly accountLifecycleService: AccountLifecycleService
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<{ message: string }> {
    const email = new Email(input.email);
    const user = await this.userRepository.findByEmail(email.value);

    if (!user) {
      return this.genericResponse();
    }

    if (user.isDeletionDue()) {
      await this.accountLifecycleService.purgeUserAccount(user.id.value);
      return this.genericResponse();
    }

    const code = this.generateCode();
    const codeHash = await this.passwordHashService.hash(code);
    const ttlMinutes = this.configService.get<number>('auth.passwordResetCodeTtlMinutes') || 15;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    user.schedulePasswordReset(codeHash, expiresAt, now);
    await this.userRepository.save(user);

    const emailTemplate = buildPasswordResetEmailTemplate({
      code,
      userName: user.name.value,
      expiresInMinutes: ttlMinutes
    });

    await this.emailService.send({
      to: user.email.value,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    });

    return this.genericResponse();
  }

  private generateCode(): string {
    return String(randomInt(100000, 1000000));
  }

  private genericResponse() {
    return {
      message:
        'Se encontrarmos uma conta com este email, enviaremos um codigo de confirmacao em instantes.'
    };
  }
}
