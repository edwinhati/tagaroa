import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Respect @AllowAnonymous() / @Public() decorators (metadata key used by nestjs-better-auth)
    const isPublic = this.reflector.getAllAndOverride<boolean>("PUBLIC", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx
      .switchToHttp()
      .getRequest<{ session?: { user?: unknown } }>();
    if (!req.session?.user) {
      throw new UnauthorizedException("Session required");
    }
    return true;
  }
}
