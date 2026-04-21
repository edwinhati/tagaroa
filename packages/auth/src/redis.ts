import type { SecondaryStorage } from "better-auth";

import Redis from "ioredis";

const createRedisClient = (): Redis | undefined => {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;

  const useTls = url.startsWith("rediss://");

  return new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    tls: useTls ? { rejectUnauthorized: false } : undefined,
  });
};

const redis = createRedisClient();

export const secondaryStorage: SecondaryStorage | undefined = redis
  ? {
      get: async (key: string) => {
        const value = await redis.get(key);
        return value ?? null;
      },
      set: async (key: string, value: string, ttl?: number) => {
        if (ttl) {
          await redis.set(key, value, "EX", ttl);
        } else {
          await redis.set(key, value);
        }
      },
      delete: async (key: string) => {
        await redis.del(key);
      },
    }
  : undefined;
