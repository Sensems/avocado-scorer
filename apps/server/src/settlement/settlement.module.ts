import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../entities/room.entity';
import { RoomPlayer } from '../entities/room-player.entity';
import { ScoreLog } from '../entities/score-log.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomPlayer, ScoreLog]),
    GatewayModule,
  ],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
