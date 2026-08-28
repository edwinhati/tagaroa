import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { sql } from "drizzle-orm";

import { DATABASE, type Database } from "./shared/database/database.module";

@Controller("health")
@AllowAnonymous()
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
