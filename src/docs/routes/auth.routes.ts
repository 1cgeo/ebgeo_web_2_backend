/**
 * @openapi
 * tags:
 *   name: Autenticação
 *   description: Operações de autenticação e gerenciamento de API keys
 *
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Realiza login
 *     description: Autentica um usuário e retorna token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Realiza logout
 *     description: Invalida o token JWT atual
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logout realizado com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/api-key:
 *   get:
 *     tags:
 *       - Autenticação
 *     summary: Obtém API key
 *     description: Retorna a API key atual do usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API key retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKeyResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/api-key/regenerate:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Regenera API key
 *     description: Gera uma nova API key para o usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nova API key gerada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKeyResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/api-key/history:
 *   get:
 *     tags:
 *       - Autenticação
 *     summary: Histórico de API keys
 *     description: Retorna o histórico de API keys do usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Histórico retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKeyHistoryResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/validate-api-key:
 *   get:
 *     tags:
 *       - Autenticação
 *     summary: Valida API key
 *     description: Valida uma API key (usado pelo nginx auth_request)
 *     parameters:
 *       - in: query
 *         name: api_key
 *         schema:
 *           type: string
 *           format: uuid
 *         description: API key para validar
 *       - in: header
 *         name: x-api-key
 *         schema:
 *           type: string
 *           format: uuid
 *         description: API key para validar (alternativa via header)
 *     responses:
 *       200:
 *         description: API key válida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationResponse'
 *       401:
 *         description: API key inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationResponse'
 */

export {};
