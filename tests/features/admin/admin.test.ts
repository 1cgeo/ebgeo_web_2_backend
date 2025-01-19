import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';

describe('Admin Routes', () => {
  describe('GET /api/admin/health', () => {
    it('should return system health status when authenticated as admin', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);

      // Act
      const response = await testRequest
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('fileSystem');
      expect(response.body.services).toHaveProperty('auth');
      expect(response.body.services).toHaveProperty('api');
    });

    it('should deny access to non-admin users', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.USER);

      // Act
      const response = await testRequest
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(403);
    });

    it('should deny access to unauthenticated requests', async () => {
      // Act
      const response = await testRequest.get('/api/admin/health');

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/metrics', () => {
    it('should return system metrics when authenticated as admin', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);

      // Act
      const response = await testRequest
        .get('/api/admin/metrics')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('usage');
      expect(response.body).toHaveProperty('logs');
      expect(response.body.system).toHaveProperty('uptime');
      expect(response.body.system).toHaveProperty('memory');
      expect(response.body.system).toHaveProperty('cpu');
    });

    it('should deny access to non-admin users', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.USER);

      // Act
      const response = await testRequest
        .get('/api/admin/metrics')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/logs', () => {
    it('should return filtered logs with valid query parameters', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const queryParams = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
        endDate: new Date().toISOString(),
        level: 'ERROR',
        category: 'API',
        page: 1,
        limit: 10
      };

      // Act
      const response = await testRequest
        .get('/api/admin/logs')
        .query(queryParams)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should validate query parameters', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const invalidParams = {
        startDate: 'invalid-date',
        level: 'INVALID_LEVEL',
        category: 'INVALID_CATEGORY',
        page: 'invalid',
        limit: 1000 // Above max limit
      };

      // Act
      const response = await testRequest
        .get('/api/admin/logs')
        .query(invalidParams)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('details');
    });

    it('should handle search parameter', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const queryParams = {
        search: 'error message',
        page: 1,
        limit: 10
      };

      // Act
      const response = await testRequest
        .get('/api/admin/logs')
        .query(queryParams)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('logs');
    });
  });

  describe('GET /api/admin/audit', () => {
    beforeEach(async () => {
      // Create some audit entries for testing
      const admin = await createTestUser(UserRole.ADMIN);
      await db.none(
        `SELECT ng.create_audit_log($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'USER_CREATE',
          admin.user.id,
          'USER',
          admin.user.id,
          'test_user',
          { test: true },
          '127.0.0.1',
          'test-agent'
        ]
      );
    });

    it('should return filtered audit entries with valid parameters', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const queryParams = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        action: 'USER_CREATE',
        page: 1,
        limit: 10
      };

      // Act
      const response = await testRequest
        .get('/api/admin/audit')
        .query(queryParams)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('entries');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.entries)).toBe(true);
      expect(response.body.entries.length).toBeGreaterThan(0);
    });

    it('should validate audit query parameters', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const invalidParams = {
        startDate: 'invalid-date',
        action: 'INVALID_ACTION',
        actorId: 'invalid-uuid',
        page: 0,
        limit: 1000
      };

      // Act
      const response = await testRequest
        .get('/api/admin/audit')
        .query(invalidParams)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('details');
    });

    it('should handle search in audit details', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const queryParams = {
        search: 'test',
        page: 1,
        limit: 10
      };

      // Act
      const response = await testRequest
        .get('/api/admin/audit')
        .query(queryParams)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('entries');
      expect(Array.isArray(response.body.entries)).toBe(true);
    });
  });
});