import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @ApiPropertyOptional({ description: 'Room config (e.g. base score, shortcuts)' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
