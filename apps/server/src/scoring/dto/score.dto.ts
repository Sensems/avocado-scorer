import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class ScoreOneToOneDto {
  @ApiProperty()
  @IsUUID()
  from_player_id: string;

  @ApiProperty()
  @IsUUID()
  to_player_id: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  amount: number;
}

export class ScoreAllInDto {
  @ApiProperty()
  @IsUUID()
  winner_player_id: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  base_amount: number;
}
