import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomPlayer } from '../entities/room-player.entity';
import { User } from '../entities/user.entity';
import { RoomStatus } from '../entities/enums';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const MIN_PLAYERS_TO_START = 4;

function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export interface CreateRoomResult {
  roomId: string;
  roomCode: string;
}

export interface RoomDetailDto {
  id: string;
  roomCode: string;
  ownerId: string;
  status: RoomStatus;
  config: Record<string, unknown> | null;
  createdAt: string;
  players: Array<{
    id: string;
    userId: string | null;
    isVirtual: boolean;
    alias: string | null;
    position: number;
    initialScore: number;
    currentScore: number;
  }>;
}

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomPlayer) private readonly playerRepo: Repository<RoomPlayer>,
  ) {}

  async createRoom(owner: User): Promise<CreateRoomResult> {
    let code: string;
    let attempts = 0;
    do {
      code = randomRoomCode();
      const existing = await this.roomRepo.findOne({ where: { roomCode: code } });
      if (!existing) break;
      attempts++;
      if (attempts > 20) throw new BadRequestException('Failed to generate unique room code');
    } while (true);

    const room = this.roomRepo.create({
      roomCode: code,
      ownerId: owner.id,
      status: RoomStatus.WAITING,
    });
    await this.roomRepo.save(room);

    const ownerPlayer = this.playerRepo.create({
      roomId: room.id,
      userId: owner.id,
      isVirtual: false,
      position: 0,
    });
    await this.playerRepo.save(ownerPlayer);

    return { roomId: room.id, roomCode: room.roomCode };
  }

  async findByCode(roomCode: string): Promise<Room> {
    const room = await this.roomRepo.findOne({
      where: { roomCode: roomCode.toUpperCase() },
      relations: ['players', 'players.user'],
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async findById(roomId: string): Promise<Room> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: ['players', 'players.user'],
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async joinByCode(roomCode: string, user: User, position?: number): Promise<RoomDetailDto> {
    const room = await this.findByCode(roomCode);
    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException('Room is not waiting for players');
    }
    const players = room.players ?? (await this.playerRepo.find({ where: { roomId: room.id } }));
    const takenPositions = new Set(players.map((p) => p.position));
    let targetPosition = position;
    if (targetPosition === undefined) {
      for (let i = 0; i < 4; i++) {
        if (!takenPositions.has(i)) {
          targetPosition = i;
          break;
        }
      }
      if (targetPosition === undefined) throw new ConflictException('Room is full');
    } else {
      if (takenPositions.has(targetPosition)) throw new ConflictException('Position taken');
    }
    const alreadyIn = players.some((p) => p.userId === user.id);
    if (alreadyIn) return this.toRoomDetail(room);

    const newPlayer = this.playerRepo.create({
      roomId: room.id,
      userId: user.id,
      isVirtual: false,
      position: targetPosition,
    });
    await this.playerRepo.save(newPlayer);
    return this.toRoomDetail(await this.findById(room.id));
  }

  async addVirtualPlayer(roomId: string, owner: User, alias: string, position: number): Promise<RoomDetailDto> {
    const room = await this.findById(roomId);
    if (room.ownerId !== owner.id) throw new ForbiddenException('Only owner can add virtual players');
    if (room.status !== RoomStatus.WAITING) throw new BadRequestException('Room is not in waiting state');
    const players = room.players ?? (await this.playerRepo.find({ where: { roomId: room.id } }));
    const taken = players.some((p) => p.position === position);
    if (taken) throw new ConflictException('Position taken');
    if (players.length >= 4) throw new ConflictException('Room is full');

    const virtual = this.playerRepo.create({
      roomId: room.id,
      userId: null,
      isVirtual: true,
      alias,
      position,
    });
    await this.playerRepo.save(virtual);
    return this.toRoomDetail(await this.findById(room.id));
  }

  async startGame(roomId: string, owner: User): Promise<RoomDetailDto> {
    const room = await this.findById(roomId);
    if (room.ownerId !== owner.id) throw new ForbiddenException('Only owner can start');
    if (room.status !== RoomStatus.WAITING) throw new BadRequestException('Room already started or finished');
    const players = room.players ?? (await this.playerRepo.find({ where: { roomId: room.id } }));
    if (players.length < MIN_PLAYERS_TO_START) {
      throw new BadRequestException(`Need at least ${MIN_PLAYERS_TO_START} players to start`);
    }
    room.status = RoomStatus.PLAYING;
    await this.roomRepo.save(room);
    return this.toRoomDetail(await this.findById(room.id));
  }

  async getRoomDetail(roomIdOrCode: string): Promise<RoomDetailDto> {
    const isUuid = /^[0-9a-f-]{36}$/i.test(roomIdOrCode);
    const room = isUuid ? await this.findById(roomIdOrCode) : await this.findByCode(roomIdOrCode);
    return this.toRoomDetail(room);
  }

  async listRooms(status?: RoomStatus): Promise<RoomDetailDto[]> {
    const where = status ? { status } : {};
    const rooms = await this.roomRepo.find({
      where,
      relations: ['players', 'players.user'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rooms.map((r) => this.toRoomDetail(r));
  }

  isOwner(room: Room, user: User): boolean {
    return room.ownerId === user.id;
  }

  private toRoomDetail(room: Room): RoomDetailDto {
    const players = (room.players ?? []).map((p) => ({
      id: p.id,
      userId: p.userId,
      isVirtual: p.isVirtual,
      alias: p.alias,
      position: p.position,
      initialScore: p.initialScore,
      currentScore: p.currentScore,
    }));
    return {
      id: room.id,
      roomCode: room.roomCode,
      ownerId: room.ownerId,
      status: room.status,
      config: room.config,
      createdAt: room.createdAt.toISOString(),
      players,
    };
  }
}
