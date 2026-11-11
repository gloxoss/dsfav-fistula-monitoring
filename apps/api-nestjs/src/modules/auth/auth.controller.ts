import { Controller, Post, Get, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './auth.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

interface RequestWithUser {
  user: {
    sub: string;
    role: string;
    email: string;
  };
}

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: RequestWithUser) {
    return this.authService.getMe(req.user.sub);
  }
}
