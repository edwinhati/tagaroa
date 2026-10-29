import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { SESSION_ONLY } from "../../../platform/http/session-only.decorator";
import { rolesOf } from "../../auth/access-policy";
import {
  ACCESS_CONTROL,
  type AccessControl,
} from "../application/access-control.facade";
import {
  REQUIRED_PERMISSION,
  type RequiredPermission,
} from "./requires-permission.decorator";

interface SessionRequest {
  params?: Record<string, string | undefined>;
  session?: {
    session?: { createdAt?: Date | string; id?: string };
    user?: { id?: string; role?: string | null };
  } | null;
}

@Injectable()
export class AccessControlGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_CONTROL) private readonly access: AccessControl,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<RequiredPermission>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (!requirement) {
      const targets = [context.getHandler(), context.getClass()];
      if (this.reflector.getAllAndOverride<boolean>("PUBLIC", targets))
        return true;
      const roles = this.reflector.getAllAndOverride<string[]>(
        "ROLES",
        targets,
      );
      if (
        request.session?.user?.id &&
        (this.reflector.getAllAndOverride<boolean>(SESSION_ONLY, targets) ||
          rolesOf(request.session.user.role).some((role) =>
            roles?.includes(role),
          ))
      )
        return true;
      throw new ForbiddenException({
        code: "ACCESS_DENIED",
        message: "You do not have access to this resource.",
      });
    }

    const session = request.session;
    const organizationId = request.params?.[requirement.organizationParam];
    const teamId = requirement.teamParam
      ? request.params?.[requirement.teamParam]
      : undefined;
    if (
      !session?.user?.id ||
      !session.session?.id ||
      !session.session.createdAt ||
      !organizationId ||
      (requirement.teamParam && !teamId)
    ) {
      throw new ForbiddenException({
        code: "ACCESS_DENIED",
        message: "You do not have access to this resource.",
      });
    }

    const allowed = await this.access.can({
      identityRole: session.user.role,
      organizationId,
      permission: requirement.permission,
      sessionCreatedAt: new Date(session.session.createdAt),
      sessionId: session.session.id,
      teamId: teamId ?? null,
      userId: session.user.id,
    });
    if (!allowed) {
      throw new ForbiddenException({
        code: "ACCESS_DENIED",
        message: "You do not have access to this resource.",
      });
    }
    return true;
  }
}
