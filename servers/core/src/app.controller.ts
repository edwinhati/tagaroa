import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { sql } from "drizzle-orm";

import { DATABASE, type Database } from "./platform/database/database.module";

@Controller("health")
@AllowAnonymous()
// A probe answered 429 reads as an outage.
@SkipThrottle()
export class AppController {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  @Get("live")
  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("ready")
  async readiness(): Promise<{ status: "ok" }> {
    try {
      await this.database.execute(sql`select 1`);
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException({ status: "error" });
    }
  }
}
