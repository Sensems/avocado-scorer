import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { WeChatService } from './wechat.service';

export interface JwtPayload {
  sub: string;
  openid: string;
}

export interface LoginResult {
  access_token: string;
  user: { id: string; openid: string; nickname: string | null; avatar_url: string | null };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly weChatService: WeChatService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async loginWithWeChat(code: string, nickname?: string, avatarUrl?: string): Promise<LoginResult> {
    const { openid } = await this.weChatService.code2Session(code);
    let user = await this.userRepo.findOne({ where: { openid } });
    if (!user) {
      user = this.userRepo.create({
        openid,
        nickname: nickname ?? null,
        avatar_url: avatarUrl ?? null,
      });
      await this.userRepo.save(user);
    } else if (nickname !== undefined || avatarUrl !== undefined) {
      if (nickname !== undefined) user.nickname = nickname;
      if (avatarUrl !== undefined) user.avatar_url = avatarUrl;
      await this.userRepo.save(user);
    }
    const access_token = this.jwtService.sign({
      sub: user.id,
      openid: user.openid,
    } as JwtPayload);
    return {
      access_token,
      user: {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
      },
    };
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }
}
