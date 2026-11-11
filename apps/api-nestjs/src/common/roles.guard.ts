import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator.js';
import { isRoleAllowedForApiPath, type AuthorizationRole } from './authorization.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_fr: 'Accès refusé pour ce profil',
        retryable: false,
      });
    }

    const role = user.role as UserRole;
    const routePolicy = isRoleAllowedForApiPath(request.path ?? request.route?.path ?? '', role as AuthorizationRole, request.method);
    const hasRole = requiredRoles.includes(role) && routePolicy !== false;
    if (!hasRole) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_fr: 'Accès refusé pour ce profil',
        retryable: false,
      });
    }

    return true;
  }
}
