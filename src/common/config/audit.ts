import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database.js';
import { AuditAction } from '../../features/admin/admin.types.js';

interface AuditParams {
  action: AuditAction;
  actorId: string;
  targetType?: 'USER' | 'GROUP' | 'MODEL' | 'ZONE' | 'SYSTEM';
  targetId?: string;
  targetName?: string;
  details?: Record<string, any>;
}

/**
 * Helper para criar registros de auditoria
 */
export async function createAudit(
  req: Request,
  params: AuditParams,
): Promise<void> {
  const { action, actorId, targetType, targetId, targetName, details } = params;

  await db.none(`SELECT ng.create_audit_log($1, $2, $3, $4, $5, $6, $7, $8)`, [
    action,
    actorId,
    targetType,
    targetId,
    targetName,
    details,
    req.ip,
    req.get('user-agent'),
  ]);
}

/**
 * Middleware que automaticamente audita ações baseado em configuração
 */
export function auditAction(params: Omit<AuditParams, 'actorId'>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.user) {
        await createAudit(req, {
          ...params,
          actorId: req.user.userId,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
