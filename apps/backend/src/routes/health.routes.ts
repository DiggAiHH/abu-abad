/**
 * Health Check Endpoint
 * Monitoring & Kubernetes Readiness/Liveness Probes
 * 
 * Endpoints:
 * - GET /health - Basic health check
 * - GET /health/ready - Readiness probe (services available?)
 * - GET /health/live - Liveness probe (is app running?)
 * 
 * @monitoring Compatible mit Kubernetes, Docker Compose, AWS ELB
 */

import { Router, Request, Response } from 'express';
import { getDatabaseService } from '../services/database.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Basic Health Check
 * Returns 200 OK if service is up
 */
router.get('/', async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'therapist-platform-api',
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Readiness Probe
 * Checks if all dependencies are available
 * Used by Kubernetes/Load Balancer to route traffic
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: any = {
    database: { healthy: false },
    memory: { healthy: false },
    uptime: { healthy: true, seconds: process.uptime() }
  };

  try {
    // 1. Database Check
    const db = getDatabaseService();
    const dbHealth = await db.ping();
    checks.database = {
      healthy: dbHealth.healthy,
      latency: `${dbHealth.latency}ms`,
      poolStats: db.getPoolStats()
    };

    // 2. Memory Check
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memLimitMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    checks.memory = {
      healthy: memUsageMB < memLimitMB * 0.9, // Alert if > 90%
      used: `${memUsageMB}MB`,
      total: `${memLimitMB}MB`,
      utilization: `${Math.round((memUsageMB / memLimitMB) * 100)}%`
    };

    // 3. Overall Status
    const allHealthy = Object.values(checks).every((check: any) => check.healthy);

    if (allHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks
      });
    } else {
      // 503 Service Unavailable - Tell load balancer to not route traffic
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks
      });
    }

  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks
    });
  }
});

/**
 * Liveness Probe
 * Simple check if process is running
 * Used by Kubernetes to restart crashed containers
 */
router.get('/live', (_req: Request, res: Response) => {
  // If this endpoint responds, the process is alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * Detailed Metrics (Optional - für Monitoring Dashboards)
 * Should be protected in production (Auth required)
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const db = getDatabaseService();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      
      // Process Metrics
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      
      // Memory Metrics
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      
      // CPU Metrics
      cpu: process.cpuUsage(),
      
      // Database Metrics
      database: {
        poolStats: db.getPoolStats(),
        size: await db.getDatabaseSize(),
        activeConnections: await db.getActiveConnections()
      }
    };

    res.status(200).json(metrics);
    
  } catch (error) {
    logger.error('Metrics endpoint failed', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
