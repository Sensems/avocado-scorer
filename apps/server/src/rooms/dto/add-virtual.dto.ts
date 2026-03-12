import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, Max, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class AddVirtualPlayerDto {
  @ApiProperty({ description: 'Display name for virtual player' })
  @IsString()
  @MinLength(1)
  alias: string;

  @ApiProperty({ description: 'Seat position 0-3', minimum: 0, maximum: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  position: number;
}
