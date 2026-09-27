import { db, nowIso, row } from '../infrastructure/db/database.js';

export type BusinessType = 'legal_entity' | 'natural_person' | 'informal';
export type TaxDeclaration = 'obligated' | 'not_obligated' | 'unknown';
export type NitVerificationStatus = 'not_required' | 'pending' | 'invalid_format' | 'locally_validated' | 'officially_verified' | 'manual_review';

export interface CompanyProfile {
  readonly name: string;
  readonly slug: string;
  readonly countryCode: string;
  readonly businessType: BusinessType;
  readonly legalRegistered: boolean;
  readonly legalName: string | null;
  readonly nit: string | null;
  readonly nitDv: string | null;
  readonly nitVerificationStatus: NitVerificationStatus;
  readonly taxDeclaration: TaxDeclaration;
  readonly taxResponsibilities: readonly string[];
  readonly legalSetupCompleted: boolean;
}

const NIT_WEIGHTS = [71,67,59,53,47,43,41,37,29,23,19,17,13,7,3];

function normalizeNit(value: string): string {
  return value.replace(/\D/g, '');
}

function nitCheckDigit(nit: string): number | null {
  const digits = normalizeNit(nit);
  if (digits.length < 6 || digits.length > NIT_WEIGHTS.length) return null;
  const weights = NIT_WEIGHTS.slice(NIT_WEIGHTS.length - digits.length);
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) sum += Number(digits[i]) * weights[i];
  const remainder = sum % 11;
  return remainder < 2 ? remainder : 11 - remainder;
}

export function validateNit(nitInput: string, dvInput?: string | null): { nit: string; dv: string | null; status: NitVerificationStatus; message: string } {
  const nit = normalizeNit(nitInput);
  if (!nit) return { nit: '', dv: null, status: 'pending', message: 'Falta el NIT.' };
  const expected = nitCheckDigit(nit);
  if (expected === null) return { nit, dv: dvInput?.replace(/\D/g, '') || null, status: 'invalid_format', message: 'El NIT no tiene un formato válido.' };
  const dv = String(dvInput ?? '').replace(/\D/g, '');
  if (!dv) return { nit, dv: String(expected), status: 'locally_validated', message: `NIT con dígito de verificación ${expected}. Falta la verificación oficial.` };
  if (dv !== String(expected)) return { nit, dv, status: 'invalid_format', message: `El dígito de verificación no coincide. Debería ser ${expected}.` };
  return { nit, dv, status: 'locally_validated', message: 'Formato y dígito de verificación válidos localmente. Esto no equivale a una verificación oficial ante la DIAN.' };
}

function parseResponsibilities(raw: unknown): string[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function getCompanyProfile(tenantId: string): CompanyProfile {
  const tenant = row<Record<string, unknown>>(db.prepare(`SELECT name,slug,country_code,business_type,legal_registered,legal_name,nit,nit_dv,nit_verification_status,tax_declaration,tax_responsibilities_json,legal_setup_completed FROM tenants WHERE id=?`), tenantId);
  if (!tenant) throw new Error('Empresa no encontrada.');
  return {
    name: String(tenant.name),
    slug: String(tenant.slug),
    countryCode: String(tenant.country_code ?? 'CO'),
    businessType: (tenant.business_type as BusinessType) ?? 'legal_entity',
    legalRegistered: Number(tenant.legal_registered ?? 0) === 1,
    legalName: tenant.legal_name ? String(tenant.legal_name) : null,
    nit: tenant.nit ? String(tenant.nit) : null,
    nitDv: tenant.nit_dv ? String(tenant.nit_dv) : null,
    nitVerificationStatus: (tenant.nit_verification_status as NitVerificationStatus) ?? 'not_required',
    taxDeclaration: (tenant.tax_declaration as TaxDeclaration) ?? 'unknown',
    taxResponsibilities: parseResponsibilities(tenant.tax_responsibilities_json),
    legalSetupCompleted: Number(tenant.legal_setup_completed ?? 0) === 1,
  };
}

export function updateCompanyProfile(tenantId: string, input: Partial<{
  countryCode: string; businessType: BusinessType; legalRegistered: boolean; legalName: string | null; nit: string | null; nitDv: string | null; taxDeclaration: TaxDeclaration; taxResponsibilities: string[];
}>): CompanyProfile {
  const current = getCompanyProfile(tenantId);
  const businessType = input.businessType && ['legal_entity','natural_person','informal'].includes(input.businessType) ? input.businessType : current.businessType;
  const legalRegistered = input.legalRegistered ?? current.legalRegistered;
  const legalName = input.legalName !== undefined ? (input.legalName?.trim().slice(0, 200) || null) : current.legalName;
  const rawNit = input.nit !== undefined ? (input.nit?.trim() || null) : current.nit;
  const rawDv = input.nitDv !== undefined ? (input.nitDv?.trim() || null) : current.nitDv;
  const nitResult = legalRegistered ? validateNit(rawNit ?? '', rawDv) : { nit: '', dv: null, status: 'not_required' as const, message: 'No requiere NIT para este registro local.' };
  if (legalRegistered && !legalName) throw new Error('Falta la razón social o nombre legal.');
  if (legalRegistered && !nitResult.nit) throw new Error('Falta el NIT.');
  const taxDeclaration = input.taxDeclaration && ['obligated','not_obligated','unknown'].includes(input.taxDeclaration) ? input.taxDeclaration : current.taxDeclaration;
  const responsibilities = input.taxResponsibilities ?? current.taxResponsibilities;
  const completed = legalRegistered ? Boolean(legalName && nitResult.nit && nitResult.status !== 'invalid_format' && taxDeclaration !== 'unknown') : Boolean(businessType === 'informal' || taxDeclaration !== 'unknown');

  db.prepare(`UPDATE tenants SET country_code=?,business_type=?,legal_registered=?,legal_name=?,nit=?,nit_dv=?,nit_verification_status=?,tax_declaration=?,tax_responsibilities_json=?,legal_setup_completed=? WHERE id=?`)
    .run(
      (input.countryCode ?? current.countryCode).trim().toUpperCase().slice(0, 2),
      businessType,
      legalRegistered ? 1 : 0,
      legalName,
      legalRegistered ? nitResult.nit : null,
      legalRegistered ? nitResult.dv : null,
      legalRegistered ? nitResult.status : 'not_required',
      taxDeclaration,
      JSON.stringify(responsibilities.filter((item) => typeof item === 'string').slice(0, 30)),
      completed ? 1 : 0,
      tenantId,
    );

  return getCompanyProfile(tenantId);
}

