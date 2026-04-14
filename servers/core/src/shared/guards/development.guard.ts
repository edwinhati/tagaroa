import { CanActivate, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../shared/config/env.validation";

@Injectable()
export class DevelopmentGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  canActivate(): boolean {
    return (
      this.configService.get("NODE_ENV", { infer: true }) === "development"
    );
  }
}
