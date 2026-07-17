import { AsyncLocalStorage } from 'async_hooks';
import * as crypto from 'crypto';

export interface TraceContext {
  correlationId: string;
  requestId: string;
  req?: any;
}

export const traceLocalStorage = new AsyncLocalStorage<TraceContext>();

export function getTraceContext(): TraceContext | undefined {
  return traceLocalStorage.getStore();
}

export function runWithTraceContext<T>(context: TraceContext, fn: () => T): T {
  return traceLocalStorage.run(context, fn);
}

export function getCorrelationId(): string {
  const store = getTraceContext();
  return store?.correlationId || 'N/A';
}

export function getRequestId(): string {
  const store = getTraceContext();
  return store?.requestId || 'N/A';
}
