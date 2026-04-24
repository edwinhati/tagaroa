import type { SecondaryStorage } from "better-auth";

import { RedisClient } from "bun";

const createRedisClient = (): RedisClient | undefined => {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;

  // TLS is handled automatically by the rediss:// scheme
  return new RedisClient(url, {
    maxRetries: 3,
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
        await redis.set(key, value);
        if (ttl) {
          await redis.expire(key, ttl);
        }
      },
      delete: async (key: string) => {
        await redis.del(key);
      },
    }
  : undefined;
