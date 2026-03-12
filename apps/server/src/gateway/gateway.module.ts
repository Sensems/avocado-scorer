import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScoringGateway } from './scoring.gateway';

@Module({
  imports: [AuthModule],
  providers: [ScoringGateway],
  exports: [ScoringGateway],
})
export class GatewayModule {}
