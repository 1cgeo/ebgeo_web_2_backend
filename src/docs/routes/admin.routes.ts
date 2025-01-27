/**
 * @openapi
 * /api/admin/health:
 *   get:
 *     tags:
 *       - Administração
 *     summary: Verifica saúde do sistema
 *     description: Retorna o status de saúde detalhado de todos os serviços do sistema
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status de saúde do sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemHealth'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Sem permissão de acesso
 *
 * /api/admin/metrics:
 *   get:
 *     tags:
 *       - Administração
 *     summary: Obtém métricas do sistema
 *     description: Retorna métricas detalhadas sobre o sistema, incluindo uso de recursos e estatísticas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas do sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemMetrics'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Sem permissão de acesso
 *
 * /api/admin/logs:
 *   get:
 *     tags:
 *       - Administração
 *     summary: Consulta logs do sistema
 *     description: Busca logs do sistema com filtros por categoria e nível
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: ['AUTH', 'API', 'DB', 'SECURITY', 'PERFORMANCE', 'SYSTEM', 'ACCESS', 'ADMIN']
 *         description: Categoria do log para filtrar
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: ['ERROR', 'WARN', 'INFO', 'DEBUG']
 *         description: Nível do log
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Quantidade máxima de logs a retornar
 *     responses:
 *       200:
 *         description: Logs do sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogResponse'
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Sem permissão de acesso
 *
 * /api/admin/audit:
 *   get:
 *     tags:
 *       - Administração
 *     summary: Consulta trilha de auditoria
 *     description: Busca registros da trilha de auditoria com diversos filtros
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data inicial para filtro
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data final para filtro
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [
 *             'USER_CREATE',
 *             'USER_UPDATE',
 *             'USER_DELETE',
 *             'USER_ROLE_CHANGE',
 *             'GROUP_CREATE',
 *             'GROUP_UPDATE',
 *             'GROUP_DELETE',
 *             'MODEL_PERMISSION_CHANGE',
 *             'ZONE_PERMISSION_CHANGE',
 *             'API_KEY_REGENERATE',
 *             'ADMIN_LOGIN',
 *             'ADMIN_ACTION'
 *           ]
 *         description: Tipo de ação
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do usuário que realizou a ação
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do objeto alvo da ação
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Termo para busca nos detalhes da auditoria
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Registros por página
 *     responses:
 *       200:
 *         description: Registros de auditoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditResponse'
 *       400:
 *         description: Parâmetros de consulta inválidos
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Sem permissão de acesso
 */

export {};
