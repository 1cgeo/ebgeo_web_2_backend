import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';

describe('Auth Routes', () => {
  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      // Arrange
      const { user } = await createTestUser(UserRole.USER);
      
      // Act
      const response = await testRequest
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: 'password123'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id', user.id);
      expect(response.body.user).toHaveProperty('role', UserRole.USER);

      // Verificar se last_login foi atualizado no banco
      const updatedUser = await db.one('SELECT * FROM ng.users WHERE id = $1', [user.id]);
      expect(updatedUser.last_login).not.toBeNull();
    });

    it('should reject login with invalid password', async () => {
      // Arrange
      const { user } = await createTestUser(UserRole.USER);
      
      // Act
      const response = await testRequest
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: 'wrong_password'
        });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Credenciais inválidas');
    });

    it('should reject login for inactive user', async () => {
      // Arrange
      const { user } = await createTestUser(UserRole.USER, false);
      
      // Act
      const response = await testRequest
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: 'password123'
        });

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/validate-api-key', () => {
    it('should validate valid API key', async () => {
      // Arrange
      const { user } = await createTestUser();

      // Act
      const response = await testRequest
        .get('/api/auth/validate-api-key')
        .set('x-api-key', user.api_key);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'API key válida');
    });

    it('should reject invalid API key', async () => {
      // Act
      const response = await testRequest
        .get('/api/auth/validate-api-key')
        .set('x-api-key', 'invalid-key');

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Arrange
      const { token } = await createTestUser();

      // Act
      const response = await testRequest
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logout realizado com sucesso');
    });

    it('should return 401 without token', async () => {
      // Act
      const response = await testRequest.post('/api/auth/logout');

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/api-key/regenerate', () => {
    it('should regenerate API key for authenticated user', async () => {
      // Arrange
      const { user, token } = await createTestUser();
      const oldApiKey = user.api_key;

      // Act
      const response = await testRequest
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('apiKey');
      expect(response.body.apiKey).not.toBe(oldApiKey);

      // Verificar se foi registrado no histórico
      const history = await db.one(
        'SELECT * FROM ng.api_key_history WHERE user_id = $1 AND api_key = $2',
        [user.id, oldApiKey]
      );
      expect(history).toBeTruthy();
      expect(history.revoked_at).not.toBeNull();
    });

    it('should return 401 without authentication', async () => {
      // Act
      const response = await testRequest
        .post('/api/auth/api-key/regenerate');

      // Assert
      expect(response.status).toBe(401);
    });
  });
});