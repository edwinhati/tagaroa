/**
 * Simple token-bucket rate limiter.
 * Provides `acquire()` which resolves when a token is available,
 * refilling at `refillRate` tokens per second up to `maxTokens`.
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number,
    /** tokens per second */
    private readonly refillRate: number,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait until a token is available
    const msPerToken = 1000 / this.refillRate;
    await new Promise<void>((resolve) => setTimeout(resolve, msPerToken));
    return this.acquire();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const refilled = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + refilled);
    this.lastRefill = now;
  }
}

// Per-provider singletons
// CoinGecko free tier: 10 req/min → ~0.17/s
export const coinGeckoRateLimiter = new RateLimiter(10, 10 / 60);
// Yahoo Finance (unofficial): 30 req/min to be safe
export const yahooRateLimiter = new RateLimiter(30, 30 / 60);
// ECB: very permissive, 60 req/min
export const ecbRateLimiter = new RateLimiter(60, 60 / 60);
