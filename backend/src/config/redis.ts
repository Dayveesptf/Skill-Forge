/**
 * Generic cache-aside layer backed by Redis.
 *
 * Fully optional: if REDIS_URL isn't set, every helper here degrades to
 * a plain pass-through (call the fetcher, return its result, cache
 * nothing) — nothing else in the app needs to know whether caching is
 * actually active.
 */
import Redis from "ioredis";
import { env } from "./env";

let client: Redis | undefined;
let connectionFailed = false;

export function isCacheConfigured(): boolean {
  return Boolean(env.redisUrl) && !connectionFailed;
}

function getClient(): Redis | undefined {
  if (!env.redisUrl || connectionFailed) {
    return undefined;
  }

  if (!client) {
    client = new Redis(env.redisUrl, {
      // Don't let a Redis outage take the app down or spam retries
      // forever — cached reads just fall back to the database.
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    client.on("error", (error) => {
      console.error("Redis error — caching disabled for this process:", error.message);
      connectionFailed = true;
    });

    client.connect().catch((error) => {
      console.error("Redis connection failed — caching disabled:", error.message);
      connectionFailed = true;
    });
  }

  return client;
}

/**
 * Cache-aside read: return the cached value for `key` if present,
 * otherwise call `fetcher`, cache its result for `ttlSeconds`, and
 * return it. Falls back to calling `fetcher` directly (no caching)
 * whenever Redis isn't configured or is unavailable.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = getClient();

  if (!redis) {
    return fetcher();
  }

  try {
    const existing = await redis.get(key);
    if (existing !== null) {
      return JSON.parse(existing) as T;
    }
  } catch (error) {
    // A read failure should never break the actual request — just skip
    // the cache and hit the database as if it weren't configured.
    console.error(`Cache read failed for "${key}":`, (error as Error).message);
  }

  const value = await fetcher();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.error(`Cache write failed for "${key}":`, (error as Error).message);
  }

  return value;
}

/**
 * Invalidate one or more cache keys, e.g. after a write that would make
 * a cached read stale. Safe to call even when Redis isn't configured.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  const redis = getClient();
  if (!redis || keys.length === 0) return;

  try {
    await redis.del(...keys);
  } catch (error) {
    console.error("Cache invalidation failed:", (error as Error).message);
  }
}

/**
 * Invalidate every key matching a prefix (e.g. all cached pages for one
 * organization). Uses SCAN rather than KEYS so it's safe on a large
 * keyspace / shared Redis instance.
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  try {
    const keysToDelete: string[] = [];
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  } catch (error) {
    console.error("Cache prefix invalidation failed:", (error as Error).message);
  }
}