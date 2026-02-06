/**
 * Database Health Monitoring & Performance Service
 * 
 * Features:
 * - Connection Pool Monitoring
 * - Slow Query Detection
 * - Database Health Checks
 * - Automatic Pool Sizing
 * 
 * @performance Optimiert für PostgreSQL 14+
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../utils/logger.js';
import env from '../config/env.js';

/**
 * Enhanced Pool Configuration
 * Optimiert für Healthcare-Anwendung mit vielen Lesezugriffen
 */
export class DatabaseService {
  private pool: Pool;
  private slowQueryThreshold: number = 100; // ms
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config?: Partial<PoolConfig>) {
    const poolConfig: PoolConfig = {
      connectionString: env.DATABASE_URL,
      
      // Connection Pool Sizing
      // Formel: (2 × CPU-Cores) + effective_spindle_count
      // Für PostgreSQL Standard: max_connections = 100
      max: config?.max || 20, // Max connections in pool
      min: config?.min || 5,  // Min idle connections
      
      // Connection Lifecycle
      connectionTimeoutMillis: 10000, // 10s timeout for acquiring connection
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      maxUses: 7500, // Close connection after 7500 queries (prevents memory leaks)
      
      // Application Name für Postgres Monitoring
      application_name: 'therapist-platform-api',
      
      // SSL/TLS (Production: required)
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
      
      ...config
    };

    this.pool = new Pool(poolConfig);
    this.setupEventHandlers();
    this.startHealthCheck();
  }

  /**
   * Setup Pool Event Handlers für Monitoring
   */
  private setupEventHandlers(): void {
    // Connection acquired from pool
    this.pool.on('acquire', (client: PoolClient) => {
      logger.debug('Connection acquired from pool', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      });
    });

    // Connection error
    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected database error', {
        error: err.message,
        stack: err.stack
      });
      
      // In Production: Alert-System triggern
      if (env.NODE_ENV === 'production') {
        // TODO: Send alert to monitoring system (PagerDuty, Sentry, etc.)
      }
    });

    // Connection removed from pool
    this.pool.on('remove', () => {
      logger.debug('Connection removed from pool', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount
      });
    });
  }

  /**
   * Health Check - Periodische Prüfung der DB-Verbindung
   * Wird von /health Endpoint genutzt
   */
  private startHealthCheck(): void {
    // Check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.ping();
      } catch (error) {
        logger.error('Database health check failed', error);
      }
    }, 30000);
  }

  /**
   * Execute Query mit Performance Monitoring
   * Loggt automatisch Slow Queries
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - startTime;

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          duration: `${duration}ms`,
          query: text.substring(0, 100), // Truncate for logging
          params: params ? params.length : 0
        });
      }

      return result.rows;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query failed', {
        duration: `${duration}ms`,
        query: text.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute mit Transaction Support
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
      
    } finally {
      client.release();
    }
  }

  /**
   * Health Check - Prüft DB-Verbindung
   */
  async ping(): Promise<{ healthy: boolean; latency: number; message?: string }> {
    const startTime = Date.now();
    
    try {
      await this.pool.query('SELECT 1');
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency
      };
      
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get Pool Statistics für Monitoring
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: 20, // From config
      utilizationPercent: ((this.pool.totalCount - this.pool.idleCount) / 20) * 100
    };
  }

  /**
   * Query Database Size (für Monitoring)
   */
  async getDatabaseSize(): Promise<string> {
    const result = await this.pool.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
    );
    return result.rows[0]?.size || 'unknown';
  }

  /**
   * Get Active Connections (für Monitoring)
   */
  async getActiveConnections(): Promise<number> {
    const result = await this.pool.query(
      `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Get Long-Running Queries (für Debugging)
   */
  async getLongRunningQueries(thresholdSeconds: number = 5): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        pid,
        now() - query_start as duration,
        query,
        state,
        application_name
      FROM pg_stat_activity
      WHERE 
        state != 'idle'
        AND query_start < now() - interval '${thresholdSeconds} seconds'
        AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY duration DESC
      LIMIT 10`
    );
    return result.rows;
  }

  /**
   * Analyze Query Performance (EXPLAIN)
   */
  async explainQuery(query: string, params?: any[]): Promise<string> {
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await this.pool.query(explainQuery, params);
      return JSON.stringify(result.rows[0], null, 2);
    } catch (error) {
      logger.error('EXPLAIN query failed', error);
      throw error;
    }
  }

  /**
   * Graceful Shutdown
   */
  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    logger.info('Closing database connection pool...');
    await this.pool.end();
    logger.info('Database connection pool closed');
  }

  /**
   * Get underlying pool (für Legacy-Code)
   */
  getPool(): Pool {
    return this.pool;
  }
}

// Singleton Instance
let dbService: DatabaseService | null = null;

/**
 * Get Database Service Instance (Singleton)
 */
export function getDatabaseService(config?: Partial<PoolConfig>): DatabaseService {
  if (!dbService) {
    dbService = new DatabaseService(config);
  }
  return dbService;
}

/**
 * Convenience-Funktion für Legacy-Code
 */
export function getPool(): Pool {
  return getDatabaseService().getPool();
}
