import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';

export class WeChatLoginDto {
  @ApiProperty({ description: 'WeChat wx.login code' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiPropertyOptional({ description: 'User nickname' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @IsOptional()
  @IsString()
  avatar_url?: string;
}
