import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards
} from '@nestjs/common';
import { UsageLimitError } from '../domain/usage/services/usage.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../infrastructure/http/guards/jwt-auth.guard';
import {
  ChatProviderUnavailableError,
  ConversationMessageAlreadyProcessedError,
  ConversationMessageFingerprintConflictError,
  ConversationMessageInProgressError,
  SendChatMessageUseCase
} from '../use-cases/conversation/send-chat-message.use-case';
import { SendChatMessageDto } from './dtos/send-chat-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly sendChatMessageUseCase: SendChatMessageUseCase) {}

  @Post('message')
  async sendMessage(@Req() request: AuthenticatedRequest, @Body() dto: SendChatMessageDto) {
    try {
      return await this.sendChatMessageUseCase.execute({
        userId: request.user!.id,
        conversationId: dto.conversationId,
        clientMessageId: dto.clientMessageId,
        message: dto.message,
        acceptedLanguage: getHeaderValue(request.headers['accept-language'])
      });
    } catch (error) {
      if (error instanceof ChatProviderUnavailableError) {
        this.logger.warn('Chat provider unavailable; returning HTTP 503');
        throw new ServiceUnavailableException(
          'Não foi possível responder agora. Tente novamente em instantes.'
        );
      }

      if (error instanceof UsageLimitError) {
        const status =
          error.code === 'USAGE_MESSAGE_LIMIT_REACHED' || error.code === 'USAGE_TOKEN_LIMIT_REACHED'
            ? HttpStatus.TOO_MANY_REQUESTS
            : HttpStatus.FORBIDDEN;

        throw new HttpException(
          {
            code: error.code,
            message: error.message,
            details: error.details
          },
          status
        );
      }

      if (error instanceof ConversationMessageFingerprintConflictError) {
        throw new HttpException(
          {
            code: 'CLIENT_MESSAGE_ID_REUSED',
            message: 'Este identificador de mensagem já foi usado em outro conteúdo.'
          },
          HttpStatus.CONFLICT
        );
      }

      if (error instanceof ConversationMessageAlreadyProcessedError) {
        throw new HttpException(
          {
            code: 'MESSAGE_ALREADY_PROCESSED',
            message:
              'Esta mensagem já foi processada. A resposta não é armazenada pelo BBrain por privacidade.'
          },
          HttpStatus.CONFLICT
        );
      }

      if (error instanceof ConversationMessageInProgressError) {
        throw new HttpException(
          {
            code: 'MESSAGE_PROCESSING',
            message: 'Esta mensagem já está sendo processada. Aguarde antes de tentar novamente.'
          },
          HttpStatus.CONFLICT
        );
      }

      throw error;
    }
  }
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
