// src/utils/rateLimiter.ts

type QueueResolver = () => void;

export class RateLimiter {
  private readonly queue: QueueResolver[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  constructor(private readonly requestsPerSecond: number) {
    if (requestsPerSecond <= 0) {
      throw new Error("requestsPerSecond must be greater than 0");
    }
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minTimeBetweenRequests = 1000 / this.requestsPerSecond;

      if (timeSinceLastRequest < minTimeBetweenRequests) {
        await new Promise((resolve) =>
          setTimeout(resolve, minTimeBetweenRequests - timeSinceLastRequest)
        );
      }

      const resolve = this.queue.shift();
      if (resolve) {
        this.lastRequestTime = Date.now();
        resolve();
      }
    }

    this.isProcessing = false;
  }
}
