import {
  type CallHandler,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";

import { OWN_OPERATOR_ACCOUNT_REQUIRED } from "./access-policy";

interface SessionRequest {
  method?: string;
  session?: { session?: { impersonatedBy?: string | null } } | null;
}

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * An impersonated session may read and stop impersonating, nothing else.
 * `/api/auth` never reaches Nest; `auth.ts` holds its own allowlist.
 */
@Injectable()
export class ImpersonationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (
      request.session?.session?.impersonatedBy &&
      !READS.has(request.method ?? "GET")
    )
      throw new ForbiddenException({
        code: "IMPERSONATED_SESSION",
        message: OWN_OPERATOR_ACCOUNT_REQUIRED,
      });
    return next.handle();
  }
}
