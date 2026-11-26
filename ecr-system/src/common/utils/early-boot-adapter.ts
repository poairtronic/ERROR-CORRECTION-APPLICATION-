import { ExpressAdapter } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';

export interface EarlyBootGate {
  markReady: () => void;
  markFailed: (message?: string) => void;
  isReady: () => boolean;
}

/**
 * Reuses a pre-bound HTTP/HTTPS server inside NestJS ExpressAdapter so `/api/health/live`
 * can respond before synchronous TypeORM connection/migrations finish, while preserving
 * NestJS middleware, Socket.IO upgrades, and graceful `app.close()` teardown.
 */
export class EarlyBootExpressAdapter extends ExpressAdapter {
  private preBoundServer?: http.Server | https.Server;

  constructor(expressInstance?: any) {
    super(expressInstance);
  }

  setPreBoundServer(server: http.Server | https.Server): void {
    this.preBoundServer = server;
    this.httpServer = server;
  }

  initHttpServer(options?: any): void {
    if (this.preBoundServer) {
      this.httpServer = this.preBoundServer;
      if (options?.forceCloseConnections) {
        (this as any).trackOpenConnections?.();
      }
      return;
    }
    super.initHttpServer(options);
  }

  listen(port: string | number, ...args: any[]): any {
    if (this.preBoundServer?.listening) {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
      if (callback) {
        callback();
      }
      return this.preBoundServer;
    }
    return super.listen(port, ...args);
  }
}

/**
 * Mounts an early-boot guard on an Express instance so `/api/health/live` responds `200 OK`
 * immediately while NestJS/TypeORM initializes, and all other routes fail closed (`503`) until ready.
 */
export function attachEarlyBootMiddleware(expressInstance: any): EarlyBootGate {
  let bootState: 'booting' | 'ready' | 'failed' = 'booting';
  let failureMessage: string | null = null;

  expressInstance.use((req: Request, res: Response, next: NextFunction) => {
    if (bootState === 'ready') {
      return next();
    }

    const reqPath = req.path || req.url?.split('?')[0] || '';
    if (req.method === 'GET' && (reqPath === '/api/health/live' || reqPath === '/health/live')) {
      return res.status(bootState === 'failed' ? 503 : 200).json({
        status: bootState === 'failed' ? 'unhealthy' : 'live',
        booting: bootState === 'booting',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(503).json({
      status: 'starting',
      message: failureMessage || 'Service is initializing',
    });
  });

  return {
    markReady: () => {
      bootState = 'ready';
    },
    markFailed: (message?: string) => {
      bootState = 'failed';
      failureMessage = message || 'Service initialization failed';
    },
    isReady: () => bootState === 'ready',
  };
}
