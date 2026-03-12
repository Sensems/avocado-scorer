import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomPlayer } from '../entities/room-player.entity';
import { ScoreLog } from '../entities/score-log.entity';
import { User } from '../entities/user.entity';
import { RoomStatus, ScoreLogType } from '../entities/enums';
import { RedisService } from '../common/redis.service';
import { ScoringGateway, ScoreUpdatedPayload } from '../gateway/scoring.gateway';
import { RoomsService } from '../rooms/rooms.service';

const LOCK_TTL = 10;

export interface ScoreSnapshot {
  players: Array<{ id: string; currentScore: number }>;
  lastLog: {
    id: string;
    fromPlayerId: string;
    toPlayerId: string;
    amount: number;
    type: string;
  };
}

@Injectable()
export class ScoringService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomPlayer) private readonly playerRepo: Repository<RoomPlayer>,
    @InjectRepository(ScoreLog) private readonly scoreLogRepo: Repository<ScoreLog>,
    private readonly roomsService: RoomsService,
    private readonly redis: RedisService,
    private readonly gateway: ScoringGateway,
  ) {}

  async scoreOneToOne(
    roomId: string,
    operator: User,
    fromPlayerId: string,
    toPlayerId: string,
    amount: number,
  ): Promise<ScoreSnapshot> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: ['players'],
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== RoomStatus.PLAYING) throw new BadRequestException('Room is not in play');
    if (!this.roomsService.isOwner(room, operator)) throw new ForbiddenException('Only owner can score');
    const players = room.players ?? (await this.playerRepo.find({ where: { roomId } }));
    const from = players.find((p) => p.id === fromPlayerId);
    const to = players.find((p) => p.id === toPlayerId);
    if (!from || !to) throw new BadRequestException('Invalid player ids');
    if (from.id === to.id) throw new BadRequestException('From and to must differ');

    const snapshot = await this.dataSource.transaction(async (tx) => {
      const fromP = await tx.getRepository(RoomPlayer).findOne({ where: { id: fromPlayerId }, lock: { mode: 'pessimistic_write' } });
      const toP = await tx.getRepository(RoomPlayer).findOne({ where: { id: toPlayerId }, lock: { mode: 'pessimistic_write' } });
      if (!fromP || !toP) throw new BadRequestException('Player not found');
      fromP.currentScore -= amount;
      toP.currentScore += amount;
      await tx.getRepository(RoomPlayer).save([fromP, toP]);
      const log = tx.getRepository(ScoreLog).create({
        roomId,
        operatorId: operator.id,
        fromPlayerId,
        toPlayerId,
        amount,
        type: ScoreLogType.NORMAL,
      });
      await tx.getRepository(ScoreLog).save(log);
      const allPlayers = await tx.getRepository(RoomPlayer).find({ where: { roomId }, order: { position: 'ASC' } });
      return this.buildSnapshot(allPlayers, log);
    });

    await this.updateRedisScores(roomId, snapshot.players);
    this.gateway.emitScoreUpdated(roomId, {
      roomId,
      players: snapshot.players,
      lastLog: snapshot.lastLog,
    });
    return snapshot;
  }

  async scoreAllIn(
    roomId: string,
    operator: User,
    winnerPlayerId: string,
    baseAmount: number,
  ): Promise<ScoreSnapshot> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: ['players'],
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== RoomStatus.PLAYING) throw new BadRequestException('Room is not in play');
    if (!this.roomsService.isOwner(room, operator)) throw new ForbiddenException('Only owner can score');
    const players = room.players ?? (await this.playerRepo.find({ where: { roomId } }));
    const winner = players.find((p) => p.id === winnerPlayerId);
    if (!winner) throw new BadRequestException('Winner player not found');
    const losers = players.filter((p) => p.id !== winnerPlayerId);
    if (losers.length !== 3) throw new BadRequestException('Exactly 4 players required for all-in');

    const snapshot = await this.redis.withLock(`room:${roomId}`, LOCK_TTL, async () => {
      return this.dataSource.transaction(async (tx) => {
        const repo = tx.getRepository(RoomPlayer);
        const winnerP = await repo.findOne({ where: { id: winnerPlayerId }, lock: { mode: 'pessimistic_write' } });
        const loserIds = losers.map((l) => l.id);
        const loserPs = await repo.find({ where: loserIds.map((id) => ({ id })), lock: { mode: 'pessimistic_write' } });
        if (!winnerP || loserPs.length !== 3) throw new BadRequestException('Players not found');
        winnerP.currentScore += baseAmount * 3;
        for (const p of loserPs) {
          p.currentScore -= baseAmount;
        }
        await repo.save([winnerP, ...loserPs]);
        const logRepo = tx.getRepository(ScoreLog);
        for (const lp of loserPs) {
          await logRepo.save(
            logRepo.create({
              roomId,
              operatorId: operator.id,
              fromPlayerId: lp.id,
              toPlayerId: winnerPlayerId,
              amount: baseAmount,
              type: ScoreLogType.ALL_IN,
            }),
          );
        }
        const latestLog = await logRepo.findOne({
          where: { roomId },
          order: { id: 'DESC' },
        });
        const allPlayers = await repo.find({ where: { roomId }, order: { position: 'ASC' } });
        const lastLogPayload = latestLog
          ? {
              id: String(latestLog.id),
              fromPlayerId: latestLog.fromPlayerId,
              toPlayerId: latestLog.toPlayerId,
              amount: latestLog.amount,
              type: latestLog.type,
            }
          : { id: '', fromPlayerId: '', toPlayerId: '', amount: 0, type: ScoreLogType.ALL_IN };
        return this.buildSnapshot(allPlayers, lastLogPayload);
      });
    });

    await this.updateRedisScores(roomId, snapshot.players);
    this.gateway.emitScoreUpdated(roomId, {
      roomId,
      players: snapshot.players,
      lastLog: snapshot.lastLog,
    });
    return snapshot;
  }

  async undo(roomId: string, operator: User): Promise<ScoreSnapshot> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: ['players'],
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== RoomStatus.PLAYING) throw new BadRequestException('Room is not in play');
    if (!this.roomsService.isOwner(room, operator)) throw new ForbiddenException('Only owner can undo');

    const lastLog = await this.scoreLogRepo.findOne({
      where: { roomId, isRevoked: false },
      order: { id: 'DESC' },
    });
    if (!lastLog) throw new BadRequestException('No log to undo');

    const snapshot = await this.dataSource.transaction(async (tx) => {
      const logRepo = tx.getRepository(ScoreLog);
      const playerRepo = tx.getRepository(RoomPlayer);
      const fromP = await playerRepo.findOne({ where: { id: lastLog.fromPlayerId }, lock: { mode: 'pessimistic_write' } });
      const toP = await playerRepo.findOne({ where: { id: lastLog.toPlayerId }, lock: { mode: 'pessimistic_write' } });
      if (!fromP || !toP) throw new BadRequestException('Player not found');
      fromP.currentScore += lastLog.amount;
      toP.currentScore -= lastLog.amount;
      await playerRepo.save([fromP, toP]);
      lastLog.isRevoked = true;
      await logRepo.save(lastLog);
      await logRepo.save(
        logRepo.create({
          roomId,
          operatorId: operator.id,
          fromPlayerId: lastLog.fromPlayerId,
          toPlayerId: lastLog.toPlayerId,
          amount: -lastLog.amount,
          type: ScoreLogType.UNDO,
        }),
      );
      const allPlayers = await playerRepo.find({ where: { roomId }, order: { position: 'ASC' } });
      return this.buildSnapshot(allPlayers, {
        id: String(lastLog.id),
        fromPlayerId: lastLog.fromPlayerId,
        toPlayerId: lastLog.toPlayerId,
        amount: lastLog.amount,
        type: lastLog.type,
      });
    });

    await this.updateRedisScores(roomId, snapshot.players);
    this.gateway.emitScoreUpdated(roomId, {
      roomId,
      players: snapshot.players,
      lastLog: snapshot.lastLog,
    });
    return snapshot;
  }

  private buildSnapshot(
    players: RoomPlayer[],
    lastLog: { id: string; fromPlayerId: string; toPlayerId: string; amount: number; type: string },
  ): ScoreSnapshot {
    return {
      players: players.map((p) => ({ id: p.id, currentScore: p.currentScore })),
      lastLog: {
        id: lastLog.id,
        fromPlayerId: lastLog.fromPlayerId,
        toPlayerId: lastLog.toPlayerId,
        amount: lastLog.amount,
        type: lastLog.type,
      },
    };
  }

  private async updateRedisScores(
    roomId: string,
    players: Array<{ id: string; currentScore: number }>,
  ): Promise<void> {
    const key = `room:${roomId}:scores`;
    await this.redis.set(key, JSON.stringify(players), 86400);
  }
}
