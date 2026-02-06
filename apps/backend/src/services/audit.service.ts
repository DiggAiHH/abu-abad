/**
 * GDPR-Compliant Audit Logging Service
 * DSGVO Art. 30: Verarbeitungsverzeichnis
 * DSGVO Art. 32: Protokollierung von Zugriffen
 * ISO 27001: Audit Trail Requirements
 * 
 * @security Immutable audit logs mit strukturiertem GDPR-Category Mapping
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

/**
 * GDPR Datenverarbeitungs-Kategorien (Art. 30 DSGVO)
 */
export enum GDPRCategory {
  /** Verarbeitung von Gesundheitsdaten (Art. 9 DSGVO - besondere Kategorien) */
  HEALTH_DATA = 'health_data',
  
  /** Authentifizierung & Zugriffskontrolle */
  AUTHENTICATION = 'authentication',
  
  /** Patientendaten lesen */
  DATA_ACCESS = 'data_access',
  
  /** Patientendaten ändern */
  DATA_MODIFICATION = 'data_modification',
  
  /** Patientendaten löschen (Art. 17) */
  DATA_DELETION = 'data_deletion',
  
  /** Datenauskunft (Art. 15) */
  DATA_EXPORT = 'data_export',
  
  /** Einwilligung & Consent Management (Art. 6) */
  CONSENT = 'consent',
  
  /** Zahlungsdaten (PCI-DSS relevant) */
  PAYMENT = 'payment',
  
  /** Kommunikation (verschlüsselte Nachrichten) */
  COMMUNICATION = 'communication',
  
  /** System-Administration */
  SYSTEM_ADMIN = 'system_admin'
}

/**
 * Audit Action Types
 */
export enum AuditAction {
  // Auth
  LOGIN = 'auth.login',
  LOGOUT = 'auth.logout',
  LOGIN_FAILED = 'auth.login_failed',
  PASSWORD_CHANGED = 'auth.password_changed',
  
  // Data Access (Read)
  PATIENT_VIEWED = 'data.patient_viewed',
  APPOINTMENT_VIEWED = 'data.appointment_viewed',
  MESSAGE_READ = 'data.message_read',
  DOCUMENT_DOWNLOADED = 'data.document_downloaded',
  
  // Data Modification
  PATIENT_CREATED = 'data.patient_created',
  PATIENT_UPDATED = 'data.patient_updated',
  APPOINTMENT_CREATED = 'data.appointment_created',
  APPOINTMENT_UPDATED = 'data.appointment_updated',
  MESSAGE_SENT = 'data.message_sent',
  
  // Data Deletion (Art. 17)
  PATIENT_DELETED = 'data.patient_deleted',
  ACCOUNT_DELETED = 'data.account_deleted',
  
  // GDPR Rights
  DATA_EXPORT_REQUESTED = 'gdpr.export_requested',
  DATA_EXPORT_COMPLETED = 'gdpr.export_completed',
  CONSENT_GIVEN = 'gdpr.consent_given',
  CONSENT_REVOKED = 'gdpr.consent_revoked',
  
  // Payment
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  
  // Security Events
  UNAUTHORIZED_ACCESS = 'security.unauthorized_access',
  ENCRYPTION_KEY_ROTATED = 'security.key_rotated',
  SUSPICIOUS_ACTIVITY = 'security.suspicious_activity'
}

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  action: AuditAction;
  userId: string;
  userRole?: string;
  ipAddress: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  gdprCategory: GDPRCategory;
  dataChanges?: any;
  success: boolean;
  errorMessage?: string;
  retentionDate: Date;
}

/**
 * Audit Service
 * Immutable Logs mit automatischer Retention Policy
 */
export class AuditService {
  private pool: Pool;
  
  // Retention Periods gemäß DSGVO & Medizinrecht
  private readonly RETENTION_PERIODS = {
    [GDPRCategory.HEALTH_DATA]: 10 * 365, // 10 Jahre (Medizinische Aufbewahrungspflicht)
    [GDPRCategory.AUTHENTICATION]: 2 * 365, // 2 Jahre
    [GDPRCategory.DATA_ACCESS]: 2 * 365,
    [GDPRCategory.DATA_MODIFICATION]: 7 * 365, // 7 Jahre (Buchhaltung)
    [GDPRCategory.DATA_DELETION]: 7 * 365,
    [GDPRCategory.DATA_EXPORT]: 3 * 365,
    [GDPRCategory.CONSENT]: 7 * 365,
    [GDPRCategory.PAYMENT]: 10 * 365, // 10 Jahre (HGB §147)
    [GDPRCategory.COMMUNICATION]: 2 * 365,
    [GDPRCategory.SYSTEM_ADMIN]: 1 * 365
  };

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Log Audit Event
   * IMMUTABLE: Logs können nicht gelöscht/geändert werden (nur automatisch nach Retention)
   */
  async log(entry: Omit<AuditLogEntry, 'retentionDate' | 'gdprCategory'>): Promise<void> {
    try {
      // Bestimme GDPR Category basierend auf Action
      const gdprCategory = this.classifyGDPR(entry.action);
      
      // Berechne Retention Date
      const retentionDays = this.RETENTION_PERIODS[gdprCategory];
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() + retentionDays);

      // Insert immutable log entry
      await this.pool.query(
        `INSERT INTO audit_logs (
          action, user_id, user_role, ip_address, user_agent,
          resource_type, resource_id, gdpr_category,
          data_changes, success, error_message, retention_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          entry.action,
          entry.userId,
          entry.userRole || null,
          entry.ipAddress,
          entry.userAgent || null,
          entry.resourceType || null,
          entry.resourceId || null,
          gdprCategory,
          entry.dataChanges ? JSON.stringify(entry.dataChanges) : null,
          entry.success,
          entry.errorMessage || null,
          retentionDate
        ]
      );

      logger.info('Audit log created', {
        action: entry.action,
        userId: entry.userId,
        gdprCategory
      });

    } catch (error) {
      // CRITICAL: Audit Logging darf nicht fehlschlagen
      logger.error('CRITICAL: Audit logging failed', error);
      // In Production: Alert-System triggern
    }
  }

  /**
   * Query Audit Logs (für Compliance Reports)
   * Nur für Admins & GDPR Data Subject Access Requests
   */
  async query(filters: {
    userId?: string;
    action?: AuditAction;
    gdprCategory?: GDPRCategory;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (filters.userId) {
      query += ` AND user_id = $${paramCount++}`;
      params.push(filters.userId);
    }

    if (filters.action) {
      query += ` AND action = $${paramCount++}`;
      params.push(filters.action);
    }

    if (filters.gdprCategory) {
      query += ` AND gdpr_category = $${paramCount++}`;
      params.push(filters.gdprCategory);
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramCount++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramCount++}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(filters.limit || 100);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Automatische Löschung abgelaufener Logs
   * Cron Job: Täglich ausführen
   */
  async cleanupExpiredLogs(): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM audit_logs WHERE retention_date < NOW() RETURNING id'
    );
    
    const deletedCount = result.rowCount || 0;
    logger.info(`Audit logs cleanup: ${deletedCount} expired logs deleted`);
    
    return deletedCount;
  }

  /**
   * Klassifiziere Action zu GDPR Category
   */
  private classifyGDPR(action: AuditAction): GDPRCategory {
    // Auth
    if (action.startsWith('auth.')) return GDPRCategory.AUTHENTICATION;
    
    // GDPR Rights
    if (action.startsWith('gdpr.')) {
      if (action.includes('export')) return GDPRCategory.DATA_EXPORT;
      if (action.includes('consent')) return GDPRCategory.CONSENT;
    }
    
    // Payment
    if (action.startsWith('payment.')) return GDPRCategory.PAYMENT;
    
    // Data Operations
    if (action.includes('deleted')) return GDPRCategory.DATA_DELETION;
    if (action.includes('viewed') || action.includes('read')) return GDPRCategory.DATA_ACCESS;
    if (action.includes('created') || action.includes('updated')) return GDPRCategory.DATA_MODIFICATION;
    
    // Health Data (Default für Patientendaten)
    if (action.includes('patient') || action.includes('appointment') || action.includes('document')) {
      return GDPRCategory.HEALTH_DATA;
    }
    
    // Communication
    if (action.includes('message')) return GDPRCategory.COMMUNICATION;
    
    // Security
    if (action.startsWith('security.')) return GDPRCategory.SYSTEM_ADMIN;
    
    // Fallback
    return GDPRCategory.DATA_ACCESS;
  }

  /**
   * Diff Calculator für Data Changes
   * Nur Änderungen loggen, nicht ganze Objekte (Datenminimierung)
   */
  calculateDiff(before: any, after: any): any {
    const changes: any = {};
    
    for (const key in after) {
      if (after[key] !== before[key]) {
        changes[key] = {
          from: before[key],
          to: after[key]
        };
      }
    }
    
    return Object.keys(changes).length > 0 ? changes : null;
  }
}

/**
 * Database Migration für Audit Logs Table
 * 
 * CREATE TABLE audit_logs (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   action VARCHAR(100) NOT NULL,
 *   user_id UUID NOT NULL,
 *   user_role VARCHAR(50),
 *   ip_address VARCHAR(50) NOT NULL,
 *   user_agent TEXT,
 *   resource_type VARCHAR(50),
 *   resource_id UUID,
 *   gdpr_category VARCHAR(50) NOT NULL,
 *   data_changes JSONB,
 *   success BOOLEAN NOT NULL,
 *   error_message TEXT,
 *   retention_date TIMESTAMP NOT NULL,
 *   created_at TIMESTAMP DEFAULT NOW(),
 *   INDEX idx_audit_user (user_id),
 *   INDEX idx_audit_category (gdpr_category),
 *   INDEX idx_audit_created (created_at),
 *   INDEX idx_audit_retention (retention_date)
 * );
 * 
 * -- Row Level Security (optional, wenn Multi-Tenant)
 * ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
 */
