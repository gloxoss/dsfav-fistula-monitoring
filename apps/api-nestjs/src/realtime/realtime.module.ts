import { Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module.js';
import { ConfigModule } from '../modules/config/config.module.js';
import { PrismaModule } from '../common/prisma.module.js';
import { CaptureGateway, DeviceGateway } from './realtime.gateway.js';
import { RealtimeRelayService } from './realtime.relay.js';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule],
  providers: [RealtimeRelayService, DeviceGateway, CaptureGateway],
  exports: [RealtimeRelayService],
})
export class RealtimeModule {}
