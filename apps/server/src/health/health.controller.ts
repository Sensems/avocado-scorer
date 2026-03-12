import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { RedisService } from '../common/redis.service';
import { Public } from '../auth/public.decorator';

export interface HealthResponse {
  status: 'ok';
  db: 'ok' | 'down';
  redis: 'ok' | 'down' | 'unavailable';
}

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check(): Promise<HealthResponse> {
    const db = await this.checkDb();
    const redis = await this.checkRedis();
    return {
      status: 'ok',
      db,
      redis,
    };
  }

  private async checkDb(): Promise<'ok' | 'down'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'ok' | 'down' | 'unavailable'> {
    if (!this.redis.isAvailable()) return 'unavailable';
    try {
      const client = this.redis.getClient();
      if (client) {
        await client.ping();
        return 'ok';
      }
      return 'unavailable';
    } catch {
      return 'down';
    }
  }
}
