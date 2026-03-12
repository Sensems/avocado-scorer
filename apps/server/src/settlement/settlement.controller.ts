import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { SettlementResult, SettlementService } from './settlement.service';

interface RequestWithUser extends Request {
  user?: User;
}

@ApiTags('settlement')
@Controller('rooms/:roomId')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post('finish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finish game (owner only)' })
  @ApiResponse({ status: 200, description: 'Settlement result' })
  async finish(@Param('roomId') roomId: string, @Req() req: RequestWithUser): Promise<SettlementResult> {
    if (!req.user) throw new Error('Unauthorized');
    return this.settlementService.finishRoom(roomId, req.user.id);
  }

  @Public()
  @Get('settlement')
  @ApiOperation({ summary: 'Get settlement data (for poster)' })
  @ApiResponse({ status: 200, description: 'Settlement with titles and visual hints' })
  async getSettlement(@Param('roomId') roomId: string): Promise<SettlementResult> {
    return this.settlementService.getSettlement(roomId);
  }
}
