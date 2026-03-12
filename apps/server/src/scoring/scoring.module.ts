import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../entities/room.entity';
import { RoomPlayer } from '../entities/room-player.entity';
import { ScoreLog } from '../entities/score-log.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomPlayer, ScoreLog]),
    RoomsModule,
    GatewayModule,
  ],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
