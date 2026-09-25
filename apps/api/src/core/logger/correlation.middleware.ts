/**
 * SHEHSWAR ONE360 - Correlation ID Middleware
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContext } from '@shehswar/shared';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    const organizationId = req.headers['x-organization-id'] as string | undefined;
    const companyId = req.headers['x-company-id'] as string | undefined;

    res.setHeader('x-correlation-id', correlationId);

    RequestContext.run(
      {
        correlationId,
        organizationId,
        companyId,
        startTime: Date.now(),
      },
      () => {
        next();
      },
    );
  }
}
