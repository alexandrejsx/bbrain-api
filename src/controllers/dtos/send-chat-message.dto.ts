import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendChatMessageDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  conversationId?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  message: string;
}
