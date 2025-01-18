/**
 * @openapi
 * /api/geographic/busca:
 *   get:
 *     tags:
 *       - Nomes Geográficos
 *     summary: Busca nomes geográficos
 *     description: Busca nomes geográficos por similaridade textual e proximidade espacial
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *         description: Termo de busca
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -90
 *           maximum: 90
 *         description: Latitude do ponto de referência
 *       - in: query
 *         name: lon
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -180
 *           maximum: 180
 *         description: Longitude do ponto de referência
 *     responses:
 *       200:
 *         description: Lista de nomes geográficos ordenados por relevância
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GeographicName'
 *       400:
 *         description: Parâmetros de busca inválidos
 *
 * /api/geographic/zones:
 *   get:
 *     tags:
 *       - Zonas Geográficas
 *     summary: Lista todas as zonas
 *     description: Retorna todas as zonas geográficas com suas estatísticas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de zonas geográficas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GeographicZone'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *
 *   post:
 *     tags:
 *       - Zonas Geográficas
 *     summary: Cria uma nova zona
 *     description: Cria uma nova zona geográfica com suas permissões iniciais
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateZoneRequest'
 *     responses:
 *       201:
 *         description: Zona criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GeographicZone'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *
 * /api/geographic/zones/{zoneId}/permissions:
 *   get:
 *     tags:
 *       - Zonas Geográficas
 *     summary: Obtém permissões de uma zona
 *     description: Retorna as permissões detalhadas de uma zona específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da zona
 *     responses:
 *       200:
 *         description: Permissões da zona
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZonePermissions'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Zona não encontrada
 *
 *   put:
 *     tags:
 *       - Zonas Geográficas
 *     summary: Atualiza permissões de uma zona
 *     description: Atualiza todas as permissões de uma zona específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da zona
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateZonePermissionsRequest'
 *     responses:
 *       200:
 *         description: Permissões atualizadas com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Zona não encontrada
 *
 * /api/geographic/zones/{zoneId}:
 *   delete:
 *     tags:
 *       - Zonas Geográficas
 *     summary: Remove uma zona
 *     description: Remove uma zona e todas suas permissões associadas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da zona
 *     responses:
 *       200:
 *         description: Zona removida com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Zona não encontrada
 */

export {};
