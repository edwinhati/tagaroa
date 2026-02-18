import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const id = (req.headers["x-request-id"] as string) ?? crypto.randomUUID();
    (req as Request & { requestId: string }).requestId = id;
    res.setHeader("x-request-id", id);
    next();
  }
}
