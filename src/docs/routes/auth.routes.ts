/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Autentica um usuário
 *     description: Autentica um usuário e retorna um token JWT
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
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *       401:
 *         description: Não autenticado
 *
 * /api/auth/api-key:
 *   get:
 *     tags:
 *       - Autenticação
 *     summary: Obtém API key
 *     description: Retorna a API key do usuário atual
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API key retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: string
 *                   format: uuid
 *                 username:
 *                   type: string
 *       401:
 *         description: Não autenticado
 *
 * /api/auth/api-key/regenerate:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Regenera API key
 *     description: Gera uma nova API key para o usuário atual
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Nova API key gerada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: string
 *                   format: uuid
 *                 generatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Não autenticado
 */

export {};
