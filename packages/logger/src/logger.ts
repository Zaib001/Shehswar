/**
 * SHEHSWAR ONE360 - Structured Pino Logger
 *
 * Provides production JSON output, development colorized pretty-printing,
 * automated sensitive data redaction, and automatic correlationId injection.
 */
import pino from 'pino';
import { RequestContext } from '@shehswar/shared';

const SENSITIVE_KEYS = [
  'password',
  'newPassword',
  'oldPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'authorization',
  'cookie',
  'creditCard',
  'cardNumber',
  'cvv',
  'apiKey',
  'secretKey',
];

export interface LogContext {
  module?: string;
  component?: string;
  actorId?: string;
  organizationId?: string;
  companyId?: string;
  [key: string]: unknown;
}

export function createLogger(serviceName = 'shehswar-core', logLevel = 'info') {
  const isDev = process.env.NODE_ENV !== 'production';

  return pino({
    name: serviceName,
    level: logLevel,
    redact: {
      paths: SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
      censor: '[REDACTED_BY_SECURITY]',
    },
    mixin() {
      return {
        correlationId: RequestContext.getCorrelationId(),
        organizationId: RequestContext.getOrganizationId(),
        companyId: RequestContext.getCompanyId(),
        actorId: RequestContext.getActorId(),
      };
    },
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

export const logger = createLogger('shehswar-one360', process.env.LOG_LEVEL || 'info');
