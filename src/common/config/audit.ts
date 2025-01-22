import { Request } from 'express';
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
  connection?: any, // Pode ser ITask para transações ou IDatabase
): Promise<void> {
  const { action, actorId, targetType, targetId, targetName, details } = params;
  const queryExecutor = connection || db;

  await queryExecutor.none(
    `
    INSERT INTO ng.audit_trail (
      action, actor_id, target_type, target_id, target_name, 
      details, ip, user_agent, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
    [
      action,
      actorId,
      targetType,
      targetId,
      targetName,
      details,
      req.ip,
      req.get('user-agent'),
    ],
  );
}
