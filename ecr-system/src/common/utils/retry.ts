export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  maxDelayMs?: number;
  exponential: boolean;
  jitter: boolean;
  retryable?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  logger?: { warn: (msg: string) => void; error: (msg: string) => void },
): Promise<T> {
  let attempt = 0;
  let delay = options.delayMs;

  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (error: any) {
      if (attempt >= options.maxAttempts || (options.retryable && !options.retryable(error))) {
        throw error;
      }

      let actualDelay = delay;
      if (options.jitter) {
        // Add random jitter to prevent thundering herd problem
        actualDelay = delay * 0.5 + Math.random() * delay * 0.5;
      }

      if (logger) {
        logger.warn(`[RETRY] Attempt ${attempt}/${options.maxAttempts} failed: ${error.message}. Retrying in ${Math.round(actualDelay)}ms...`);
      }

      await new Promise((resolve) => setTimeout(resolve, actualDelay));

      if (options.exponential) {
        delay = Math.min(delay * 2, options.maxDelayMs || 30000);
      }
    }
  }
}
