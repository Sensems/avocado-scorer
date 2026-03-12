import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ScoringService, ScoreSnapshot } from './scoring.service';
import { ScoreOneToOneDto, ScoreAllInDto } from './dto/score.dto';

interface RequestWithUser extends Request {
  user: User;
}

@ApiTags('scoring')
@Controller('rooms/:roomId/score')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Post()
  @ApiOperation({ summary: '1v1 score' })
  @ApiResponse({ status: 200, description: 'Score updated' })
  async score(
    @Param('roomId') roomId: string,
    @Req() req: RequestWithUser,
    @Body() dto: ScoreOneToOneDto,
  ): Promise<ScoreSnapshot> {
    return this.scoringService.scoreOneToOne(
      roomId,
      req.user,
      dto.from_player_id,
      dto.to_player_id,
      dto.amount,
    );
  }

  @Post('all-in')
  @ApiOperation({ summary: 'All-in (1x3)' })
  @ApiResponse({ status: 200, description: 'Scores updated' })
  async allIn(
    @Param('roomId') roomId: string,
    @Req() req: RequestWithUser,
    @Body() dto: ScoreAllInDto,
  ): Promise<ScoreSnapshot> {
    return this.scoringService.scoreAllIn(roomId, req.user, dto.winner_player_id, dto.base_amount);
  }

  @Post('undo')
  @ApiOperation({ summary: 'Undo last score' })
  @ApiResponse({ status: 200, description: 'Undone' })
  @ApiResponse({ status: 400, description: 'No log to undo' })
  async undo(@Param('roomId') roomId: string, @Req() req: RequestWithUser): Promise<ScoreSnapshot> {
    return this.scoringService.undo(roomId, req.user);
  }
}
