/**
 * SHEHSWAR ONE360 - Settings & Storage Contracts
 */
import { ConfigurationScope, DataClassification, StorageProvider } from './enums.js';

export interface SystemSettingValue {
  key: string;
  value: unknown;
  scope: ConfigurationScope;
  scopeId?: string; // organizationId or companyId or branchId
  isEncrypted: boolean;
}

export interface FileUploadMetadata {
  id: string;
  organizationId: string;
  companyId?: string;
  provider: StorageProvider;
  storageKey: string;
  bucket: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  classification: DataClassification;
  entityType?: string;
  entityId?: string;
  uploadedById: string;
  createdAt: Date;
}

export interface StoragePresignedUrlResult {
  uploadUrl?: string;
  downloadUrl?: string;
  key: string;
  expiresInSeconds: number;
}
