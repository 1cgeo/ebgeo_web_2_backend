/**
 * @openapi
 * /api/catalog3d/catalogo3d:
 *   get:
 *     tags:
 *       - Catálogo 3D
 *     summary: Busca modelos no catálogo 3D
 *     description: Busca paginada de modelos 3D com filtragem por termo de busca
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Termo de busca opcional
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: nr_records
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Número de registros por página
 *     responses:
 *       200:
 *         description: Lista de modelos 3D
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Catalog3DSearchResponse'
 *       400:
 *         description: Parâmetros de busca inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/catalog3d/permissions/{modelId}:
 *   get:
 *     tags:
 *       - Catálogo 3D
 *     summary: Lista permissões de um modelo
 *     description: Retorna as permissões detalhadas de um modelo 3D específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do modelo
 *     responses:
 *       200:
 *         description: Permissões do modelo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelPermissions'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Sem permissão de acesso
 *       404:
 *         description: Modelo não encontrado
 *   put:
 *     tags:
 *       - Catálogo 3D
 *     summary: Atualiza permissões de um modelo
 *     description: Atualiza as permissões de acesso de um modelo 3D específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do modelo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateModelPermissionsRequest'
 *     responses:
 *       200:
 *         description: Permissões atualizadas com sucesso
 *       400:
 *         description: Dados de permissão inválidos
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Sem permissão de acesso
 *       404:
 *         description: Modelo não encontrado
 */

export {};
