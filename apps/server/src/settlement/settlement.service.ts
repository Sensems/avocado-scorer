import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScoringGateway } from '../gateway/scoring.gateway';
import { Room } from '../entities/room.entity';
import { RoomPlayer } from '../entities/room-player.entity';
import { ScoreLog } from '../entities/score-log.entity';
import { RoomStatus, ScoreLogType } from '../entities/enums';
import * as path from 'path';
import * as fs from 'fs';

const titlePhrases: Record<string, string[]> = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'title-phrases.json'), 'utf-8'),
);

export type TitleKey =
  | '1_absolute_ruler'
  | '2_ultimate_philanthropist'
  | '3_comeback_king'
  | '4_rollercoaster'
  | '5_tool_person';

export type VisualHint = 'winner' | 'loser' | 'comeback' | 'neutral';

export interface PlayerSettlementItem {
  playerId: string;
  aliasOrName: string | null;
  finalScore: number;
  titleKey: TitleKey | null;
  titleText: string | null;
  visualHint: VisualHint;
}

export interface SettlementResult {
  roomId: string;
  players: PlayerSettlementItem[];
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomPlayer) private readonly playerRepo: Repository<RoomPlayer>,
    @InjectRepository(ScoreLog) private readonly scoreLogRepo: Repository<ScoreLog>,
    private readonly gateway: ScoringGateway,
  ) {}

  async finishRoom(roomId: string, ownerId: string): Promise<SettlementResult> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: ['players', 'players.user'],
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== ownerId) throw new ForbiddenException('Only owner can finish');
    if (room.status !== RoomStatus.PLAYING) throw new NotFoundException('Room not in play');

    room.status = RoomStatus.FINISHED;
    await this.roomRepo.save(room);

    const result = await this.computeSettlement(roomId);
    this.gateway.emitRoomFinished(roomId, {
      roomId,
      settlementUrl: `/api/rooms/${roomId}/settlement`,
    });
    return result;
  }

  async getSettlement(roomId: string): Promise<SettlementResult> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== RoomStatus.FINISHED) throw new NotFoundException('Room not finished');
    return this.computeSettlement(roomId);
  }

  private async computeSettlement(roomId: string): Promise<SettlementResult> {
    const players = await this.playerRepo.find({
      where: { roomId },
      relations: ['user'],
      order: { position: 'ASC' },
    });
    const logs = await this.scoreLogRepo.find({
      where: { roomId, isRevoked: false },
      order: { id: 'ASC' },
    });

    const netScores = new Map<string, number>();
    for (const p of players) {
      netScores.set(p.id, p.currentScore - p.initialScore);
    }

    const totalWon = [...netScores.values()].filter((s) => s > 0).reduce((a, b) => a + b, 0);
    const totalLost = [...netScores.values()].filter((s) => s < 0).reduce((a, b) => a + Math.abs(b), 0);

    const cumulativeByPlayer = new Map<string, number[]>();
    for (const p of players) {
      cumulativeByPlayer.set(p.id, [p.initialScore]);
    }
    let running = new Map<string, number>();
    for (const p of players) {
      running.set(p.id, p.initialScore);
    }
    for (const log of logs) {
      if (log.type === ScoreLogType.UNDO) continue;
      const fromCur = running.get(log.fromPlayerId) ?? 0;
      const toCur = running.get(log.toPlayerId) ?? 0;
      running.set(log.fromPlayerId, fromCur - log.amount);
      running.set(log.toPlayerId, toCur + log.amount);
      for (const [pid, score] of running) {
        const arr = cumulativeByPlayer.get(pid) ?? [];
        arr.push(score);
        cumulativeByPlayer.set(pid, arr);
      }
    }

    const sortedByScore = [...players].sort(
      (a, b) => (netScores.get(b.id) ?? 0) - (netScores.get(a.id) ?? 0),
    );
    const rank = new Map<string, number>();
    sortedByScore.forEach((p, i) => rank.set(p.id, i + 1));

    const totalLogs = logs.filter((l) => l.type !== ScoreLogType.UNDO).length;
    const threshold80 = Math.floor(totalLogs * 0.8);

    const items: PlayerSettlementItem[] = [];
    const assignedTitle = new Set<string>();

    for (const p of players) {
      const net = netScores.get(p.id) ?? 0;
      const aliasOrName = p.alias ?? p.user?.nickname ?? null;
      let titleKey: TitleKey | null = null;
      let titleText: string | null = null;
      let visualHint: VisualHint = 'neutral';

      if (totalLost > 0 && net >= 0 && net / totalLost >= 0.6) {
        titleKey = '1_absolute_ruler';
        titleText = pickRandom(titlePhrases['1_absolute_ruler']);
        visualHint = 'winner';
        assignedTitle.add(p.id);
      }
      if (!assignedTitle.has(p.id) && totalWon > 0 && net <= 0 && Math.abs(net) / totalWon >= 0.6) {
        titleKey = '2_ultimate_philanthropist';
        titleText = pickRandom(titlePhrases['2_ultimate_philanthropist']);
        visualHint = 'loser';
        assignedTitle.add(p.id);
      }
      if (!assignedTitle.has(p.id)) {
        const cum = cumulativeByPlayer.get(p.id) ?? [];
        const at80 = cum[Math.min(threshold80, cum.length - 1)];
        const wasNegativeUntil80 = threshold80 > 0 && at80 !== undefined && at80 < 0;
        const finalScore = netScores.get(p.id) ?? 0;
        const topTwo = rank.get(p.id) !== undefined && (rank.get(p.id) ?? 0) <= 2;
        if (wasNegativeUntil80 && finalScore >= 0 && topTwo) {
          titleKey = '3_comeback_king';
          titleText = pickRandom(titlePhrases['3_comeback_king']);
          visualHint = 'comeback';
          assignedTitle.add(p.id);
        }
      }
      if (!assignedTitle.has(p.id)) {
        const cum = cumulativeByPlayer.get(p.id) ?? [];
        const maxPos = Math.max(0, ...cum.filter((c) => c > 0));
        const maxNeg = Math.min(0, ...cum.filter((c) => c < 0));
        const range = maxPos - maxNeg;
        const avgRange =
          players.length > 0
            ? players.reduce((s, q) => {
                const c = cumulativeByPlayer.get(q.id) ?? [];
                const mp = Math.max(0, ...c.filter((x) => x > 0));
                const mn = Math.min(0, ...c.filter((x) => x < 0));
                return s + (mp - mn);
              }, 0) / players.length
            : 0;
        const net = netScores.get(p.id) ?? 0;
        const nearZero = net >= -totalWon * 0.05 && net <= totalWon * 0.05;
        if (avgRange > 0 && range >= avgRange * 0.5 && nearZero) {
          titleKey = '4_rollercoaster';
          titleText = pickRandom(titlePhrases['4_rollercoaster']);
          visualHint = 'neutral';
          assignedTitle.add(p.id);
        }
      }
      if (!assignedTitle.has(p.id)) {
        const net = netScores.get(p.id) ?? 0;
        const participation = totalLogs > 0 ? (logs.filter((l) => l.fromPlayerId === p.id || l.toPlayerId === p.id).length / totalLogs) : 0;
        const flow = totalWon + totalLost > 0 ? Math.abs(net) / (totalWon + totalLost) : 0;
        if (participation >= 0.8 && flow <= 0.05) {
          titleKey = '5_tool_person';
          titleText = pickRandom(titlePhrases['5_tool_person']);
          visualHint = 'neutral';
        }
      }

      items.push({
        playerId: p.id,
        aliasOrName,
        finalScore: net,
        titleKey,
        titleText,
        visualHint,
      });
    }

    return { roomId, players: items };
  }
}
