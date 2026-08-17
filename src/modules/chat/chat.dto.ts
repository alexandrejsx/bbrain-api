import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendChatMessageDto {
  @IsOptional() @IsUUID() conversationId?: string;
  @IsOptional() @IsUUID() clientMessageId?: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(12000)
  message: string;
}
