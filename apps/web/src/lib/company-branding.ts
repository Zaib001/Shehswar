import { SHEHSWAR_LOGO_BASE64 } from './shehswar-logo-base64';

export interface CompanyBranding {
  id?: string;
  code?: string;
  name: string;
  legalName?: string | null;
  logoUrl?: string | null;
  taxId?: string | null;
  strnId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ResolvedCompanyBranding {
  id?: string;
  code?: string;
  name: string;
  legalName?: string | null;
  logo: string;
  hasCustomLogo: boolean;
  taxId?: string | null;
  strnId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  metaLine: string;
}

const ACTIVE_BRANDING_STORAGE_KEY = 'shehswar_active_company_branding';
const DEFAULT_COMPANY_NAME = 'SHEHSWAR CHEMICALS & AGRO-FERTILIZERS (PVT) LTD';

let inMemoryActiveBranding: CompanyBranding | null = null;
const inMemoryCompanyRegistry = new Map<string, CompanyBranding>();

export function setAuthorizedCompaniesBranding(companies: Array<Partial<CompanyBranding> & { id?: string; name?: string }>) {
  inMemoryCompanyRegistry.clear();
  for (const c of companies) {
    if (c.id && c.name) {
      inMemoryCompanyRegistry.set(c.id, {
        id: c.id,
        code: c.code,
        name: c.name,
        legalName: c.legalName,
        logoUrl: c.logoUrl,
        taxId: c.taxId,
        strnId: c.strnId,
        address: c.address,
        phone: c.phone,
        email: c.email,
      });
    }
  }
}

export function setActiveCompanyBranding(company: CompanyBranding | null) {
  inMemoryActiveBranding = company
    ? {
        id: company.id,
        code: company.code,
        name: company.name,
        legalName: company.legalName,
        logoUrl: company.logoUrl,
        taxId: company.taxId,
        strnId: company.strnId,
        address: company.address,
        phone: company.phone,
        email: company.email,
      }
    : null;

  if (typeof window !== 'undefined') {
    try {
      if (inMemoryActiveBranding) {
        localStorage.setItem(ACTIVE_BRANDING_STORAGE_KEY, JSON.stringify(inMemoryActiveBranding));
      } else {
        localStorage.removeItem(ACTIVE_BRANDING_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors cleanly; inMemoryActiveBranding still holds the data
    }
  }
}

export function getActiveCompanyBranding(): CompanyBranding | null {
  if (inMemoryActiveBranding) return inMemoryActiveBranding;

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ACTIVE_BRANDING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CompanyBranding;
        if (parsed && parsed.name) {
          inMemoryActiveBranding = parsed;
          return parsed;
        }
      }
      const fallbackName = localStorage.getItem('shehswar_active_company_name');
      const fallbackId = localStorage.getItem('shehswar_active_company');
      if (fallbackName) {
        return { id: fallbackId || undefined, name: fallbackName };
      }
    } catch {
      // Ignore parse/storage errors
    }
  }

  return null;
}

export interface ResolveBrandingOptions {
  company?: Partial<CompanyBranding> | null;
  companyName?: string | null;
  companyLogo?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  defaultDivision?: string;
}

/**
 * Resolves company name, logo, and statutory metadata for PDFs, invoices, ledgers, and modals.
 * Priority:
 * 1. Explicit document-level company (merged with authorized registry & active company if matching)
 * 2. Active company selected in the top header
 * 3. Default Shehswar branding fallback
 */
export function resolveCompanyBranding(options?: ResolveBrandingOptions): ResolvedCompanyBranding {
  const active = getActiveCompanyBranding();
  const docComp = options?.company;
  const registryMatch = docComp?.id ? inMemoryCompanyRegistry.get(docComp.id) : undefined;

  const explicitLogo = options?.companyLogo || docComp?.logoUrl || registryMatch?.logoUrl;
  const activeLogo = active?.logoUrl;

  const isDocDifferentCompany =
    Boolean(docComp?.id && active?.id && docComp.id !== active.id);

  // Use header active company name when document didn't specify a specific company object
  const name =
    docComp?.name ||
    options?.companyName ||
    active?.name ||
    DEFAULT_COMPANY_NAME;

  const resolvedLogo =
    explicitLogo ||
    (!isDocDifferentCompany ? activeLogo : null) ||
    SHEHSWAR_LOGO_BASE64;

  const legalName = docComp?.legalName || registryMatch?.legalName || (!isDocDifferentCompany ? active?.legalName : null);
  const taxId = docComp?.taxId || registryMatch?.taxId || (!isDocDifferentCompany ? active?.taxId : null);
  const strnId = docComp?.strnId || registryMatch?.strnId || (!isDocDifferentCompany ? active?.strnId : null);
  const address = options?.companyAddress || docComp?.address || registryMatch?.address || (!isDocDifferentCompany ? active?.address : null);
  const phone = options?.companyPhone || docComp?.phone || registryMatch?.phone || (!isDocDifferentCompany ? active?.phone : null);
  const email = docComp?.email || registryMatch?.email || (!isDocDifferentCompany ? active?.email : null);

  const metaParts: string[] = [];
  if (address) metaParts.push(address);
  if (phone) metaParts.push(`Tel: ${phone}`);
  if (taxId) metaParts.push(`NTN: ${taxId}`);
  if (strnId) metaParts.push(`STRN: ${strnId}`);

  const metaLine =
    metaParts.length > 0
      ? metaParts.join(' • ')
      : legalName && legalName !== name
        ? legalName
        : options?.defaultDivision || 'Enterprise ERP & Authoritative Accounting Records';

  return {
    id: docComp?.id || active?.id,
    code: docComp?.code || registryMatch?.code || active?.code,
    name,
    legalName,
    logo: resolvedLogo,
    hasCustomLogo: Boolean(explicitLogo || (!isDocDifferentCompany && activeLogo)),
    taxId,
    strnId,
    address,
    phone,
    email,
    metaLine,
  };
}

export function getCompanyBrandingById(companyId?: string | null): CompanyBranding | null {
  if (!companyId) return null;
  const found = inMemoryCompanyRegistry.get(companyId);
  if (found) return found;
  const active = getActiveCompanyBranding();
  if (active?.id === companyId) return active;
  return null;
}
