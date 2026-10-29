import {
  type CallHandler,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";

import { isPrivilegedRole } from "./access-policy";

interface SessionRequest {
  originalUrl?: string;
  session?: {
    user?: { role?: string | null; twoFactorEnabled?: boolean };
  } | null;
}

/** Privileged sessions may reach auth itself to enroll, but no business API. */
@Injectable()
export class PrivilegedMfaInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (request.originalUrl?.startsWith("/api/auth/")) return next.handle();

    const user = request.session?.user;
    if (isPrivilegedRole(user?.role) && !user?.twoFactorEnabled) {
      throw new ForbiddenException({
        code: "PRIVILEGED_TWO_FACTOR_REQUIRED",
        message:
          "Set up two-factor authentication before using administration.",
      });
    }
    return next.handle();
  }
}
