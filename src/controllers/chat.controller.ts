import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards
} from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from '../infrastructure/http/guards/jwt-auth.guard';
import {
  ChatProviderUnavailableError,
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
        message: dto.message
      });
    } catch (error) {
      if (error instanceof ChatProviderUnavailableError) {
        this.logger.warn('Chat provider unavailable; returning HTTP 503');
        throw new ServiceUnavailableException(
          'Não foi possível responder agora. Tente novamente em instantes.'
        );
      }

      throw error;
    }
  }
}
