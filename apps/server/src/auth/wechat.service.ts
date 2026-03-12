import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Code2SessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
}

interface WeChatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WeChatService {
  private readonly baseUrl = 'https://api.weixin.qq.com';

  constructor(private readonly configService: ConfigService) {}

  async code2Session(code: string): Promise<Code2SessionResult> {
    const appId = this.configService.get<string>('WECHAT_APPID');
    const secret = this.configService.get<string>('WECHAT_SECRET');
    if (!appId || !secret) {
      throw new UnauthorizedException('WeChat app not configured');
    }
    const url = `${this.baseUrl}/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = (await res.json()) as WeChatCode2SessionResponse;
    if (data.errcode && data.errcode !== 0) {
      throw new UnauthorizedException(data.errmsg ?? 'WeChat login failed');
    }
    if (!data.openid || !data.session_key) {
      throw new UnauthorizedException('Invalid WeChat response');
    }
    return {
      openid: data.openid,
      session_key: data.session_key,
      unionid: data.unionid,
    };
  }
}
