import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards
} from '@nestjs/common';
import { UsageLimitError } from '../../domain/usage/services/usage.service';
import {
  AuthenticatedRequest,
  JwtAuthGuard
} from '../../infrastructure/http/guards/jwt-auth.guard';
import { SendChatMessageDto } from './chat.dto';
import {
  ChatMessageAlreadyProcessedError,
  ChatMessageConflictError,
  ChatMessageInProgressError,
  ChatProviderUnavailableError,
  SendChatMessageService
} from './send-chat-message.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly service: SendChatMessageService) {}

  @Post('message')
  async send(@Req() request: AuthenticatedRequest, @Body() dto: SendChatMessageDto) {
    try {
      return await this.service.execute({
        userId: request.user!.id,
        conversationId: dto.conversationId,
        clientMessageId: dto.clientMessageId,
        message: dto.message,
        acceptedLanguage: header(request.headers['accept-language'])
      });
    } catch (error) {
      if (error instanceof UsageLimitError) {
        throw new HttpException(
          { code: error.code, message: error.message, details: error.details },
          error.code.includes('LIMIT') ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.FORBIDDEN
        );
      }
      if (error instanceof ChatMessageConflictError) {
        throw new HttpException(
          {
            code: 'CLIENT_MESSAGE_ID_REUSED',
            message: 'Este identificador já foi usado em outro conteúdo.'
          },
          HttpStatus.CONFLICT
        );
      }
      if (error instanceof ChatMessageAlreadyProcessedError) {
        throw new HttpException(
          {
            code: 'MESSAGE_ALREADY_PROCESSED',
            message: 'Esta mensagem já foi processada e a resposta não é armazenada.'
          },
          HttpStatus.CONFLICT
        );
      }
      if (error instanceof ChatMessageInProgressError) {
        throw new HttpException(
          { code: 'MESSAGE_PROCESSING', message: 'Esta mensagem já está sendo processada.' },
          HttpStatus.CONFLICT
        );
      }
      if (error instanceof ChatProviderUnavailableError) {
        throw new ServiceUnavailableException(
          'Não foi possível responder agora. Tente novamente em instantes.'
        );
      }
      throw error;
    }
  }
}

function header(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
