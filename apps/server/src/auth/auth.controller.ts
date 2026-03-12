import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService, LoginResult } from './auth.service';
import { WeChatLoginDto } from './dto/wechat-login.dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('wechat/login')
  @ApiOperation({ summary: 'WeChat miniprogram login (code2Session)' })
  @ApiResponse({ status: 201, description: 'Login success' })
  @ApiResponse({ status: 401, description: 'Invalid code' })
  async wechatLogin(@Body() dto: WeChatLoginDto): Promise<LoginResult> {
    return this.authService.loginWithWeChat(dto.code, dto.nickname, dto.avatar_url);
  }
}
