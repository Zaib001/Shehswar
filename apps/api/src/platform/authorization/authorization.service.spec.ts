/**
 * SHEHSWAR ONE360 - Authorization Service Unit Tests
 */
import { AuthorizationService } from './authorization.service';
import { Action, Resource, AuthUser } from '@shehswar/types';

describe('AuthorizationService', () => {
  let authzService: AuthorizationService;

  const mockAdminUser: AuthUser = {
    id: 'user-admin-1',
    email: 'admin@shehswar.com',
    firstName: 'System',
    lastName: 'Admin',
    isActive: true,
    isSuperAdmin: true,
    organizationId: 'org-shehswar',
    companyId: 'comp-parent',
    roles: ['ROLE_SUPER_ADMIN'],
    permissions: [],
    context: { organizationId: 'org-shehswar', companyId: 'comp-parent' },
  };

  const mockChildUser: AuthUser = {
    id: 'user-child-1',
    email: 'sales@childco.com',
    firstName: 'Child',
    lastName: 'Salesperson',
    isActive: true,
    isSuperAdmin: false,
    organizationId: 'org-shehswar',
    companyId: 'comp-child-1',
    roles: ['ROLE_SALES'],
    permissions: ['sales_order:view', 'sales_order:create'],
    context: { organizationId: 'org-shehswar', companyId: 'comp-child-1' },
  };

  beforeEach(() => {
    authzService = new AuthorizationService();
  });

  it('should allow Super Admin full access to any resource without explicit permission', () => {
    const allowed = authzService.can({
      user: mockAdminUser,
      action: Action.VIEW_COST,
      resource: Resource.COSTING,
    });
    expect(allowed).toBe(true);
  });

  it('should grant access when user possesses the required permission', () => {
    const allowed = authzService.can({
      user: mockChildUser,
      action: Action.VIEW,
      resource: Resource.SALES_ORDER,
      context: { organizationId: 'org-shehswar', companyId: 'comp-child-1' },
    });
    expect(allowed).toBe(true);
  });

  it('should deny access when user lacks the required permission', () => {
    const allowed = authzService.can({
      user: mockChildUser,
      action: Action.DELETE,
      resource: Resource.SALES_ORDER,
    });
    expect(allowed).toBe(false);
  });

  it('should strictly deny child company user from viewing parent costing or margins', () => {
    const allowed = authzService.can({
      user: mockChildUser,
      action: Action.VIEW_COST,
      resource: Resource.COSTING,
      context: { organizationId: 'org-shehswar', companyId: 'comp-parent' },
    });
    expect(allowed).toBe(false);
  });

  it('should deny access across different organizations (hard tenant boundary)', () => {
    const allowed = authzService.can({
      user: mockChildUser,
      action: Action.VIEW,
      resource: Resource.SALES_ORDER,
      context: { organizationId: 'foreign-tenant-xyz' },
    });
    expect(allowed).toBe(false);
  });
});
