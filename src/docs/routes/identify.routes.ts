/**
 * @openapi
 * /api/identify/feicoes:
 *   get:
 *     tags:
 *       - Identificação
 *     summary: Identifica feição em um ponto
 *     description: Identifica a feição mais próxima de um ponto 3D fornecido, considerando distâncias XY e Z
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -90
 *           maximum: 90
 *         description: Latitude do ponto em graus decimais
 *         example: -23.5505
 *       - in: query
 *         name: lon
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -180
 *           maximum: 180
 *         description: Longitude do ponto em graus decimais
 *         example: -46.6333
 *       - in: query
 *         name: z
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: Altitude do ponto em metros
 *         example: 760
 *     responses:
 *       200:
 *         description: Feature encontrada ou mensagem indicando que nenhuma feature foi encontrada
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Feature'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Nenhuma feição encontrada para as coordenadas fornecidas.
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

export {};
