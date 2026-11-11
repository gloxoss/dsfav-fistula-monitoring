import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      select: { role: true, isActive: true },
      orderBy: { role: 'asc' },
    });
    return users.map(({ role, isActive }) => ({
      role,
      status: isActive ? 'ACTIVE' as const : 'DISABLED' as const,
    }));
  }
}
