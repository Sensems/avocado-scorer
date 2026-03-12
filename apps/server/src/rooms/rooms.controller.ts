import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoomStatus } from '../entities/enums';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { RoomsService, RoomDetailDto, CreateRoomResult } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { AddVirtualPlayerDto } from './dto/add-virtual.dto';

interface RequestWithUser extends Request {
  user: User;
}

@ApiTags('rooms')
@Controller('rooms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: 201, description: 'Room created' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateRoomDto): Promise<CreateRoomResult> {
    return this.roomsService.createRoom(req.user);
  }

  @Post('by-code/:roomCode/join')
  @ApiOperation({ summary: 'Join room by code (scan or link)' })
  @ApiResponse({ status: 200, description: 'Joined room' })
  async joinByCode(
    @Param('roomCode') roomCode: string,
    @Req() req: RequestWithUser,
    @Body() dto: JoinRoomDto,
  ): Promise<RoomDetailDto> {
    return this.roomsService.joinByCode(roomCode, req.user, dto.position);
  }

  @Post(':roomId/players/virtual')
  @ApiOperation({ summary: 'Add virtual placeholder (owner only)' })
  @ApiResponse({ status: 200, description: 'Virtual player added' })
  async addVirtual(
    @Param('roomId') roomId: string,
    @Req() req: RequestWithUser,
    @Body() dto: AddVirtualPlayerDto,
  ): Promise<RoomDetailDto> {
    return this.roomsService.addVirtualPlayer(roomId, req.user, dto.alias, dto.position);
  }

  @Post(':roomId/start')
  @ApiOperation({ summary: 'Start game (owner only, 4 players)' })
  @ApiResponse({ status: 200, description: 'Game started' })
  async start(@Param('roomId') roomId: string, @Req() req: RequestWithUser): Promise<RoomDetailDto> {
    return this.roomsService.startGame(roomId, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List rooms (optional filter by status)' })
  async list(@Query('status') status?: string): Promise<RoomDetailDto[]> {
    const s = status as string | undefined;
    const statusEnum =
      s && ['waiting', 'playing', 'finished'].includes(s) ? (s as RoomStatus) : undefined;
    return this.roomsService.listRooms(statusEnum);
  }

  @Public()
  @Get('by-code/:roomCode')
  @ApiOperation({ summary: 'Get room by code (spectator allowed)' })
  async getByCode(@Param('roomCode') roomCode: string): Promise<RoomDetailDto> {
    return this.roomsService.getRoomDetail(roomCode);
  }

  @Public()
  @Get(':roomId')
  @ApiOperation({ summary: 'Get room by id (spectator allowed)' })
  async getById(@Param('roomId') roomId: string): Promise<RoomDetailDto> {
    return this.roomsService.getRoomDetail(roomId);
  }
}
