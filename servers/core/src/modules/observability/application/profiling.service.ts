import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../shared/config/env.validation";

interface ProfileSample {
  timestamp: number;
  cpuUsage: NodeJS.CpuUsage;
  memoryUsage: NodeJS.MemoryUsage;
}

@Injectable()
export class BunProfilingService implements OnApplicationShutdown {
  private readonly logger = new Logger(BunProfilingService.name);
  private interval: Timer | null = null;
  private samples: ProfileSample[] = [];
  private readonly isEnabled: boolean;
  private readonly sampleIntervalMs: number;
  private readonly maxSamples: number;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    this.isEnabled =
      this.configService.get("PROFILING_ENABLED", { infer: true }) ?? false;
    this.sampleIntervalMs =
      this.configService.get("PROFILING_INTERVAL_MS", { infer: true }) ?? 5000;
    this.maxSamples =
      this.configService.get("PROFILING_MAX_SAMPLES", { infer: true }) ?? 1000;
  }

  onApplicationShutdown() {
    this.stopProfiling();
  }

  startProfiling(): void {
    if (!this.isEnabled) {
      this.logger.log("Profiling is disabled");
      return;
    }

    this.logger.log(
      `Starting profiling (interval: ${this.sampleIntervalMs}ms, max samples: ${this.maxSamples})`,
    );

    this.recordSample();

    this.interval = setInterval(() => {
      this.recordSample();

      if (this.samples.length > this.maxSamples) {
        this.samples = this.samples.slice(-this.maxSamples);
      }
    }, this.sampleIntervalMs);
  }

  stopProfiling(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.log("Profiling stopped");
  }

  private recordSample(): void {
    this.samples.push({
      timestamp: Date.now(),
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
    });
  }

  getStats(): {
    samples: number;
    duration: number;
    avgMemoryMB: number;
    peakMemoryMB: number;
    currentMemoryMB: number;
  } {
    const first = this.samples[0];
    const last = this.samples.at(-1);

    if (!first || !last) {
      return {
        samples: 0,
        duration: 0,
        avgMemoryMB: 0,
        peakMemoryMB: 0,
        currentMemoryMB: 0,
      };
    }

    const memories = this.samples.map((s) => s.memoryUsage.heapUsed);
    const avgMemory =
      memories.reduce((a, b) => a + b, 0) / memories.length / 1024 / 1024;
    const peakMemory = Math.max(...memories) / 1024 / 1024;

    // We use ?? 0 as a fallback to satisfy TypeScript,
    // though we know the array isn't empty here.
    const currentMemoryRaw = memories.at(-1) ?? 0;
    const currentMemory = currentMemoryRaw / 1024 / 1024;

    const duration = last.timestamp - first.timestamp;

    return {
      samples: this.samples.length,
      duration,
      avgMemoryMB: Math.round(avgMemory * 100) / 100,
      peakMemoryMB: Math.round(peakMemory * 100) / 100,
      currentMemoryMB: Math.round(currentMemory * 100) / 100,
    };
  }

  generateReport(): string {
    const stats = this.getStats();
    const recentSamples = this.samples.slice(-10);

    let report = "## Profiling Report\n\n";
    report += `**Total Samples:** ${stats.samples}\n`;
    report += `**Duration:** ${(stats.duration / 1000).toFixed(1)}s\n`;
    report += `**Avg Memory:** ${stats.avgMemoryMB} MB\n`;
    report += `**Peak Memory:** ${stats.peakMemoryMB} MB\n`;
    report += `**Current Memory:** ${stats.currentMemoryMB} MB\n\n`;

    if (recentSamples.length > 0) {
      report += "### Recent Samples\n\n";
      report += "| Time | Heap Used (MB) | RSS (MB) |\n";
      report += "|------|----------------|----------|\n";

      for (const sample of recentSamples) {
        const time = new Date(sample.timestamp).toLocaleTimeString();
        const heapMB = (sample.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const rssMB = (sample.memoryUsage.rss / 1024 / 1024).toFixed(2);
        report += `| ${time} | ${heapMB} | ${rssMB} |\n`;
      }
    }

    return report;
  }

  exportToJSON(): string {
    return JSON.stringify(
      {
        metadata: {
          generatedAt: new Date().toISOString(),
          sampleCount: this.samples.length,
          runtime: "Bun",
          version: process.version,
        },
        samples: this.samples,
      },
      null,
      2,
    );
  }
}
