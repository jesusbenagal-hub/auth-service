import { Controller, Get } from "@nestjs/common";

export interface HealthStatus {
  status: "ok";
}

/** Liveness check for Cloud Run and for us: answers while the process is up. */
@Controller("health")
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: "ok" };
  }
}
