/**
 * @openapi
 * /api/groups:
 *   get:
 *     tags:
 *       - Grupos
 *     summary: Lista todos os grupos
 *     description: Retorna lista paginada de grupos com detalhes de membros e permissões
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           default: 10
 *         description: Itens por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           minLength: 3
 *         description: Termo para buscar em nome e descrição
 *     responses:
 *       200:
 *         description: Lista de grupos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GroupList'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Cria novo grupo
 *     description: Cria um novo grupo e opcionalmente adiciona membros
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGroupDTO'
 *     responses:
 *       201:
 *         description: Grupo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GroupDetails'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *
 * /api/groups/{id}:
 *   put:
 *     tags:
 *       - Grupos
 *     summary: Atualiza um grupo
 *     description: Atualiza dados do grupo e/ou seus membros
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do grupo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateGroupDTO'
 *     responses:
 *       200:
 *         description: Grupo atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GroupDetails'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *
 *   delete:
 *     tags:
 *       - Grupos
 *     summary: Remove um grupo
 *     description: Remove o grupo e todas suas associações
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do grupo
 *     responses:
 *       200:
 *         description: Grupo removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Grupo removido com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

export {};
