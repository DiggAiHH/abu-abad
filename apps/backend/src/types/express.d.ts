/**
 * Express Type Augmentation
 * Erweitert Express.Request um custom Properties ohne Breaking Changes
 * Pattern: Declaration Merging (TypeScript Advanced Types)
 */

import { UserRole } from '../types/index.js';

declare global {
  namespace Express {
    /**
     * Erweitert Express.Request um Auth-Informationen
     * Wird von auth.middleware.ts nach JWT-Validierung gesetzt
     */
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        email?: string; // Optional für backward compatibility
      };
    }
  }
}

// Necessary for module augmentation
export {};
