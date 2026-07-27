import { LoggerService, Injectable, Scope } from '@nestjs/common';
import { getTraceContext } from './trace-context';
import { GlobalTelemetry } from './global-telemetry';

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLogger implements LoggerService {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  log(message: any, ...optionalParams: any[]) {
    this.print('INFO', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.print('ERROR', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.print('WARN', message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    if (this.isProduction) return;
    this.print('DEBUG', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    if (this.isProduction) return;
    this.print('VERBOSE', message, optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]) {
    this.print('FATAL', message, optionalParams);
  }

  private print(level: string, message: any, optionalParams: any[]) {
    const trace = getTraceContext();
    const context = optionalParams[optionalParams.length - 1] || 'App';
    
    const errorStack = level === 'ERROR' || level === 'FATAL' 
      ? optionalParams.find(p => p instanceof Error || (typeof p === 'string' && p.includes('\n'))) 
      : undefined;

    let payload: any = {};
    let msgString = '';

    if (typeof message === 'object' && message !== null) {
      const { message: msg, ...rest } = message;
      msgString = msg || '';
      payload = rest;
    } else {
      msgString = String(message);
    }

    const memoryMb = GlobalTelemetry.latestMemoryMb;
    const cpuPercent = GlobalTelemetry.latestCpuSec;

    const duration = payload.duration || payload.executionTimeMs || undefined;
    const category = payload.category || 'GENERAL';

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      category,
      message: msgString,
      duration,
      memoryMb,
      cpuSec: cpuPercent,
      correlationId: trace?.correlationId || 'N/A',
      requestId: trace?.requestId || 'N/A',
      userId: trace?.req?.user?.id || trace?.req?.user?.sub || 'N/A',
      role: trace?.req?.user?.role || 'N/A',
      route: trace?.req?.url || undefined,
      method: trace?.req?.method || undefined,
      ...payload,
    };

    if (errorStack) {
      logEntry['stack'] = errorStack instanceof Error ? errorStack.stack : errorStack;
    }

    if (this.isProduction) {
      if (level === 'ERROR' || level === 'FATAL') {
        console.error(JSON.stringify(logEntry));
      } else {
        console.log(JSON.stringify(logEntry));
      }
    } else {
      const colors = {
        RESET: '\x1b[0m',
        FATAL: '\x1b[31;1m',
        ERROR: '\x1b[31m',
        WARN: '\x1b[33m',
        INFO: '\x1b[32m',
        DEBUG: '\x1b[36m',
        VERBOSE: '\x1b[35m',
      };

      const color = colors[level] || colors.RESET;
      const timeStr = logEntry.timestamp.split('T')[1].substring(0, 12);
      const reqIdStr = logEntry.requestId !== 'N/A' ? ` [Req: ${logEntry.requestId.substring(0, 8)}]` : '';
      const durationStr = duration !== undefined ? ` (${duration}ms)` : '';
      const contextStr = `[${context}][${category}]`;

      const output = `${color}${level.padEnd(7)}${colors.RESET} | ${timeStr} | ${colors.DEBUG}${contextStr.padEnd(25)}${colors.RESET} | ${msgString}${durationStr}${reqIdStr} [RAM: ${memoryMb}MB]`;

      if (level === 'ERROR' || level === 'FATAL') {
        console.error(output);
        if (errorStack) {
          console.error(errorStack instanceof Error ? errorStack.stack : errorStack);
        }
      } else {
        console.log(output);
      }
    }
  }
}
