import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (body === null || body === undefined) {
          return body;
        }

        if (typeof body !== "object") {
          return body;
        }

        if ("data" in body || "errors" in body) {
          return body;
        }

        return { data: body };
      }),
    );
  }
}
