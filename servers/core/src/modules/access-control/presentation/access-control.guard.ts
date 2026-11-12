import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAnyRole } from "@repo/contracts/identity";

import { SESSION_ONLY } from "../../../platform/http/session-only.decorator";
import {
  ACCESS_CONTROL,
  type AccessControl,
} from "../application/access-control.facade";
import {
  REQUIRED_PERMISSION,
  type RequiredPermission,
} from "./requires-permission.decorator";

/** The metadata keys `@AllowAnonymous()` and `@Roles()` set in nestjs-better-auth. */
const LIBRARY_PUBLIC = "PUBLIC";
const LIBRARY_ROLES = "ROLES";

interface SessionRequest {
  params?: Record<string, string | undefined>;
  session?: {
    session?: { id?: string };
    user?: { id?: string; role?: string | null };
  } | null;
}

const denied = () =>
  new ForbiddenException({
    code: "ACCESS_DENIED",
    message: "You do not have access to this resource.",
  });

/**
 * Every route declares who may reach it, and one that declares nothing is
 * refused (docs/agents/authorization.md). A `@RequiresPermission` route is
 * decided by business access in the scope its parameters name.
 */
@Injectable()
export class AccessControlGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_CONTROL) private readonly access: AccessControl,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const declared = <T>(key: string | symbol) =>
      this.reflector.getAllAndOverride<T>(key, targets);
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const user = request.session?.user;
    const requirement = declared<RequiredPermission>(REQUIRED_PERMISSION);

    if (!requirement) {
      if (declared<boolean>(LIBRARY_PUBLIC)) return true;
      if (
        user?.id &&
        (declared<boolean>(SESSION_ONLY) ||
          hasAnyRole(user.role, declared<string[]>(LIBRARY_ROLES) ?? []))
      )
        return true;
      throw denied();
    }

    const sessionId = request.session?.session?.id;
    const organizationId = request.params?.[requirement.organizationParam];
    const teamId = requirement.teamParam
      ? request.params?.[requirement.teamParam]
      : undefined;
    if (
      !user?.id ||
      !sessionId ||
      !organizationId ||
      (requirement.teamParam && !teamId)
    )
      throw denied();

    const allowed = await this.access.can({
      operator: { id: user.id, role: user.role, sessionId },
      organizationId,
      permission: requirement.permission,
      teamId: teamId ?? null,
    });
    if (!allowed) throw denied();
    return true;
  }
}
