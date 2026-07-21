import { LoggerService, Injectable, Scope } from '@nestjs/common';
import { getTraceContext } from './trace-context';

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLogger implements LoggerService {
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
    this.print('DEBUG', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.print('VERBOSE', message, optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]) {
    this.print('FATAL', message, optionalParams);
  }

  private print(level: string, message: any, optionalParams: any[]) {
    const trace = getTraceContext();
    const context = optionalParams[optionalParams.length - 1] || 'App';
    
    // Find stack trace if present
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

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: msgString,
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

    // Direct JSON output for Render log ingestion
    if (level === 'ERROR' || level === 'FATAL') {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
}
