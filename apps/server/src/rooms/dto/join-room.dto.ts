import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class JoinRoomDto {
  @ApiPropertyOptional({ description: 'Seat position 0-3', minimum: 0, maximum: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  position?: number;
}
