import {
  type CallHandler,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";

/** The part of the request Better Auth's own guard leaves behind. */
interface SessionRequest {
  session?: { user?: { mustChangePassword?: boolean } } | null;
}

/**
 * ADR-0001: a redirect in `apps/auth` does not stop someone opening a workspace
 * app directly, so a session still holding an admin-issued password is refused
 * here too. An interceptor rather than a guard because every guard — including
 * the Better Auth one that attaches `request.session` — has run by this point,
 * which no ordering between two global guards would promise. An anonymous
 * request carries no session and passes straight through.
 */
@Injectable()
export class TemporaryPasswordInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SessionRequest>();

    if (request.session?.user?.mustChangePassword) {
      throw new ForbiddenException({
        code: "MUST_CHANGE_PASSWORD",
        message: "Replace your temporary password before using the workspace.",
      });
    }

    return next.handle();
  }
}
