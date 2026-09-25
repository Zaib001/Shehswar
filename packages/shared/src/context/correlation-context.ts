/**
 * SHEHSWAR ONE360 - Correlation ID & Request Context Store
 *
 * Uses Node.js AsyncLocalStorage to propagate correlationId, tenantId,
 * and actorId across async call stacks, database queries, and background jobs.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestStore {
  correlationId: string;
  organizationId?: string;
  companyId?: string;
  actorId?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestStore>();

export class RequestContext {
  static run<R>(store: RequestStore, callback: () => R): R {
    return asyncLocalStorage.run(store, callback);
  }

  static getStore(): RequestStore | undefined {
    return asyncLocalStorage.getStore();
  }

  static getCorrelationId(): string {
    const store = asyncLocalStorage.getStore();
    return store?.correlationId ?? 'untracked-req';
  }

  static getOrganizationId(): string | undefined {
    return asyncLocalStorage.getStore()?.organizationId;
  }

  static getCompanyId(): string | undefined {
    return asyncLocalStorage.getStore()?.companyId;
  }

  static getActorId(): string | undefined {
    return asyncLocalStorage.getStore()?.actorId;
  }
}
