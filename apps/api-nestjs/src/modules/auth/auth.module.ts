import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PrismaModule } from '../../common/prisma.module.js';

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  // Tests are an explicit local setup: use an ephemeral secret, never a tracked value.
  if (process.env.NODE_ENV === 'test') {
    return randomBytes(32).toString('hex');
  }
  throw new Error('JWT_SECRET must be set before starting the API');
}

const jwtSecret = resolveJwtSecret();

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
