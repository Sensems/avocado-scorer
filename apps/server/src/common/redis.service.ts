import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('REDIS_URL');
    if (url) {
      this.client = new Redis(url, { maxRetriesPerRequest: null });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds != null) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  isAvailable(): boolean {
    return this.client != null;
  }

  /**
   * Run fn with a Redis lock. If Redis is unavailable, runs without lock.
   * @param key e.g. lock:room:uuid
   * @param ttlSeconds lock TTL to avoid deadlock
   */
  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const lockKey = `lock:${key}`;
    if (!this.client) return fn();
    const ok = await this.client.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
    if (!ok) throw new Error('Lock not acquired');
    try {
      return await fn();
    } finally {
      await this.del(lockKey);
    }
  }
}
