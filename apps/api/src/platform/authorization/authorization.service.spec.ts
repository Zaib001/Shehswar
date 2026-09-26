/**
 * SHEHSWAR ONE360 - Authorization & Sensitive Data Isolation Unit Tests
 */
import { AuthorizationService } from './authorization.service';
import { Action, Resource, AuthUser } from '@shehswar/types';

describe('AuthorizationService Scoping & Negative Access Tests', () => {
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
    permissions: [
      'sales_order:view',
      'sales_order:create',
      'costing:view_cost', // theoretically assigned in role, but context is parent!
      'costing:view_margin',
      'formula_bom:view',
    ],
    context: { organizationId: 'org-shehswar', companyId: 'comp-child-1' },
  };

  const mockParentManager: AuthUser = {
    id: 'user-parent-mgr',
    email: 'plant.head@shehswar.com',
    firstName: 'Parent',
    lastName: 'Plant Head',
    isActive: true,
    isSuperAdmin: false,
    organizationId: 'org-shehswar',
    companyId: 'comp-parent',
    roles: ['ROLE_PLANT_HEAD'],
    permissions: ['costing:view_cost', 'costing:view_margin', 'formula_bom:view'],
    context: { organizationId: 'org-shehswar', companyId: 'comp-parent' },
  };

  const mockGroupAuditor: AuthUser = {
    id: 'user-group-auditor',
    email: 'auditor@shehswargroup.com',
    firstName: 'Group',
    lastName: 'Auditor',
    isActive: true,
    isSuperAdmin: false,
    organizationId: 'org-shehswar',
    companyId: 'comp-parent',
    roles: ['ROLE_GROUP_AUDITOR'],
    permissions: ['company:cross_company_view', 'sales_order:view'],
    context: { organizationId: 'org-shehswar', companyId: 'comp-parent' },
  };

  beforeEach(() => {
    authzService = new AuthorizationService();
  });

  describe('Super Admin', () => {
    it('should allow Super Admin full access to any resource without explicit permission', () => {
      const allowed = authzService.can({
        user: mockAdminUser,
        action: Action.VIEW_COST,
        resource: Resource.COSTING,
      });
      expect(allowed).toBe(true);
    });
  });

  describe('Negative Case 1: Child Company User Cannot Access Parent Costing/Margin', () => {
    it('Child company user cannot retrieve parent manufacturing cost', () => {
      const allowed = authzService.can({
        user: mockChildUser,
        action: Action.VIEW_COST,
        resource: Resource.COSTING,
        context: { organizationId: 'org-shehswar', companyId: 'comp-parent' }, // Parent context
      });
      expect(allowed).toBe(false);
    });

    it('Child company user cannot retrieve parent margin', () => {
      const allowed = authzService.can({
        user: mockChildUser,
        action: Action.VIEW_MARGIN,
        resource: Resource.COSTING,
        context: { organizationId: 'org-shehswar', companyId: 'comp-parent' }, // Parent context
      });
      expect(allowed).toBe(false);
    });
  });

  describe('Negative Case 2: Child Company User Cannot Access Parent Proprietary Formulas', () => {
    it('Child company user cannot retrieve protected parent formula details', () => {
      const allowed = authzService.can({
        user: mockChildUser,
        action: Action.VIEW,
        resource: Resource.FORMULA_BOM,
        context: { organizationId: 'org-shehswar', companyId: 'comp-parent' },
      });
      expect(allowed).toBe(false);
    });

    it('Child company user targeting parent formula record is blocked at record level', () => {
      const allowed = authzService.can({
        user: mockChildUser,
        action: Action.VIEW,
        resource: Resource.FORMULA_BOM,
        targetRecord: { id: 'bom-001', companyId: 'comp-parent', formulaCode: 'FEED-POULTRY-V2' },
      });
      expect(allowed).toBe(false);
    });
  });

  describe('Negative Case 3: Child Company User Cannot Access Sister Child Records', () => {
    it('Child Co 1 user cannot access Child Co 2 restricted sales records', () => {
      const allowed = authzService.can({
        user: mockChildUser,
        action: Action.VIEW,
        resource: Resource.SALES_ORDER,
        context: { organizationId: 'org-shehswar', companyId: 'comp-child-2' }, // Sister company
        targetRecord: { id: 'so-child2-99', companyId: 'comp-child-2' },
      });
      expect(allowed).toBe(false);
    });
  });

  describe('Positive Case 4: Parent Authorized User Access', () => {
    it('Parent authorized user can access authorized parent cost and formula records', () => {
      const costAllowed = authzService.can({
        user: mockParentManager,
        action: Action.VIEW_COST,
        resource: Resource.COSTING,
        context: { organizationId: 'org-shehswar', companyId: 'comp-parent' },
      });
      expect(costAllowed).toBe(true);

      const formulaAllowed = authzService.can({
        user: mockParentManager,
        action: Action.VIEW,
        resource: Resource.FORMULA_BOM,
        context: { organizationId: 'org-shehswar', companyId: 'comp-parent' },
      });
      expect(formulaAllowed).toBe(true);
    });
  });

  describe('Positive Case 5: Group Authorized User Cross-Company Consolidated Access', () => {
    it('Group user with company:cross_company_view can access consolidated child company orders', () => {
      const allowed = authzService.can({
        user: mockGroupAuditor,
        action: Action.VIEW,
        resource: Resource.SALES_ORDER,
        context: { organizationId: 'org-shehswar', companyId: 'comp-child-1' },
      });
      expect(allowed).toBe(true);
    });
  });

  describe('Negative Case 6: Hard Organization Boundary Isolation', () => {
    it('should deny access across different organizations regardless of roles', () => {
      const allowed = authzService.can({
        user: mockGroupAuditor,
        action: Action.VIEW,
        resource: Resource.SALES_ORDER,
        context: { organizationId: 'foreign-tenant-xyz' },
      });
      expect(allowed).toBe(false);
    });
  });

  describe('Negative Case 7: Missing Required Permission', () => {
    it('should deny access when user completely lacks the required permission', () => {
      const allowed = authzService.can({
        user: mockChildUser,
        action: Action.DELETE,
        resource: Resource.SALES_ORDER,
      });
      expect(allowed).toBe(false);
    });
  });
});
