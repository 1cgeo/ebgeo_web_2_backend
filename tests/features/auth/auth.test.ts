import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';
import jwt from 'jsonwebtoken';

describe('Auth Routes', () => {
  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      // Arrange
      const { user, password } = await createTestUser(UserRole.USER);
      
      // Act
      const response = await testRequest
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: password
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

    it('should reject login with missing username', async () => {
      // Act
      const response = await testRequest
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('details');
    });

    it('should reject login with missing password', async () => {
      // Act
      const response = await testRequest
        .post('/api/auth/login')
        .send({
          username: 'testuser'
        });

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('details');
    });

    it('should set HTTP-only cookie with token on successful login', async () => {
      // Arrange
      const { user, password } = await createTestUser(UserRole.USER);
      
      // Act
      const response = await testRequest
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: password
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
      const cookie = response.headers['set-cookie'][0];
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('token=');
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

    it('should validate API key via query parameter', async () => {
      // Arrange
      const { user } = await createTestUser();

      // Act
      const response = await testRequest
        .get('/api/auth/validate-api-key')
        .query({ api_key: user.api_key });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'API key válida');
    });

    it('should reject when no API key is provided', async () => {
      // Act
      const response = await testRequest
        .get('/api/auth/validate-api-key');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'API key não fornecida');
    });

    it('should reject API key from inactive user', async () => {
      // Arrange
      const { user } = await createTestUser(UserRole.USER, false);

      // Act
      const response = await testRequest
        .get('/api/auth/validate-api-key')
        .set('x-api-key', user.api_key);

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

    it('should clear auth cookie on logout', async () => {
      // Arrange
      const { token } = await createTestUser();

      // Act
      const response = await testRequest
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
      const cookie = response.headers['set-cookie'][0];
      expect(cookie).toContain('token=;');
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('should handle multiple logout attempts', async () => {
      // Arrange
      const { token } = await createTestUser();

      // Act - First logout
      const response1 = await testRequest
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Act - Second logout with same token
      const response2 = await testRequest
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
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

    it('should maintain API key history order', async () => {
      // Arrange
      const { user, token } = await createTestUser();
      const originalApiKey = user.api_key;

      // Act - Generate multiple new keys
      await testRequest
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', `Bearer ${token}`);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      await testRequest
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', `Bearer ${token}`);

      // Get history
      const historyResponse = await testRequest
        .get('/api/auth/api-key/history')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.history).toHaveLength(2);

      const firstEntry = historyResponse.body.history[0];
      const secondEntry = historyResponse.body.history[1];
      expect(firstEntry.apiKey).not.toBe(originalApiKey);
      expect(secondEntry.apiKey).not.toBe(originalApiKey);

      const firstDate = new Date(firstEntry.created_at).getTime();
      const secondDate = new Date(secondEntry.created_at).getTime();
      expect(firstDate).toBeGreaterThan(secondDate);

    });

    it('should update user record with new API key', async () => {
      // Arrange
      const { user, token } = await createTestUser();
      const oldApiKey = user.api_key;

      // Act
      await testRequest
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', `Bearer ${token}`);

      // Assert - Check database directly
      const updatedUser = await db.one('SELECT * FROM ng.users WHERE id = $1', [user.id]);
      expect(updatedUser.api_key).not.toBe(oldApiKey);
      expect(updatedUser.api_key_created_at).not.toBe(user.api_key_created_at);
    });
  });

  describe('GET /api/auth/api-key/history', () => {
    it('should return empty history for new user', async () => {
      // Arrange
      const { user, token } = await createTestUser();

      // Act
      const response = await testRequest
        .get('/api/auth/api-key/history')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId', user.id);
      expect(response.body.history).toBeInstanceOf(Array);
      expect(response.body.history).toHaveLength(0);
    });

    it('should show multiple history entries after regenerations', async () => {
      // Arrange
      const { token } = await createTestUser();
      
      // Generate two new API keys
      await testRequest
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', `Bearer ${token}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      await testRequest
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', `Bearer ${token}`);

      // Act
      const response = await testRequest
        .get('/api/auth/api-key/history')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.history).toHaveLength(2);
      expect(response.body.history[0].is_active).toBe(false);
      expect(response.body.history[1].is_active).toBe(false);

      // Verify revocation timestamps
      expect(response.body.history[0].revoked_at).toBeTruthy();
      expect(response.body.history[1].revoked_at).toBeTruthy();

      // Verify that the entries are properly ordered
      const firstDate = new Date(response.body.history[0].created_at).getTime();
      const secondDate = new Date(response.body.history[1].created_at).getTime();
      expect(firstDate).toBeGreaterThan(secondDate);
    });

    it('should return 401 with invalid token', async () => {
      // Act
      const response = await testRequest
        .get('/api/auth/api-key/history')
        .set('Authorization', 'Bearer invalid_token');

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('JWT Token Validation', () => {
    it('should reject expired token', async () => {
      // Arrange
      const { user } = await createTestUser();
      const expiredToken = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '0s' }
      );

      // Act
      const response = await testRequest
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Token expirado');
    });

    it('should reject token with invalid signature', async () => {
      // Arrange
      const { user } = await createTestUser();
      const invalidToken = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        'wrong_secret'
      );

      // Act
      const response = await testRequest
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', `Bearer ${invalidToken}`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Token inválido');
    });

    it('should reject malformed token', async () => {
      // Act
      const response = await testRequest
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', 'Bearer not.a.valid.token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Token inválido');
    });
  });



});