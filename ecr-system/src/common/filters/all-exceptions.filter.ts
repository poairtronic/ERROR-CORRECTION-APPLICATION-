import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getCorrelationId, getRequestId } from '../trace-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    }

    const correlationId = getCorrelationId();
    const requestId = getRequestId();

    // Check validation / database failures for diagnostic tags
    const exceptionMessage = exception instanceof Error ? exception.message : String(exception);
    const exceptionStack = exception instanceof Error ? exception.stack : '';

    let failureCategory = 'UNKNOWN';
    if (exceptionMessage.includes('validation') || (message && typeof message === 'object' && 'message' in message && Array.isArray((message as any).message))) {
      failureCategory = 'VALIDATION_FAILURE';
    } else if (exceptionMessage.includes('QueryFailedError') || exceptionMessage.includes('database') || exceptionMessage.includes('postgres') || exceptionMessage.includes('Neon')) {
      failureCategory = 'DATABASE_FAILURE';
    } else if (exceptionMessage.includes('mail') || exceptionMessage.includes('SMTP') || exceptionMessage.includes('Google Apps Script')) {
      failureCategory = 'EMAIL_FAILURE';
    } else if (exceptionMessage.includes('Queue') || exceptionMessage.includes('queue')) {
      failureCategory = 'QUEUE_FAILURE';
    } else if (exceptionMessage.includes('Socket') || exceptionMessage.includes('websocket') || exceptionMessage.includes('gateway')) {
      failureCategory = 'SOCKET_FAILURE';
    }

    // Structured diagnostic logs
    this.logger.error({
      message: `Unhandled Exception captured by Filter: ${exceptionMessage}`,
      failureCategory,
      statusCode: status,
      route: request.url,
      method: request.method,
      correlationId,
      requestId,
    }, exceptionStack);

    // Send standardized response back to client (preserving API compatibility)
    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
      message: typeof message === 'string' ? message : (message as any)?.message || message || 'Internal server error',
      error: typeof message === 'string' ? message : (message as any)?.message || message || 'Internal server error',
    });
  }
}
