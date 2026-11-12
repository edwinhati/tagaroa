import {
  type CallHandler,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";

import { sessionRefusal } from "./session-policy";

/**
 * ADR-0001: a redirect in `apps/auth` does not stop someone opening a workspace
 * app directly, so the session rules are enforced on every core route too. An
 * interceptor rather than a guard because every guard — including the Better
 * Auth one that attaches `request.session` — has run by this point, which no
 * ordering between two global guards would promise.
 */
@Injectable()
export class SessionPolicyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      session?: Parameters<typeof sessionRefusal>[0];
    }>();
    const refusal = sessionRefusal(request.session, request.method);
    if (refusal) throw new ForbiddenException(refusal);
    return next.handle();
  }
}
