import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';
import type { User } from '../../../src/features/users/users.types.js';
import { jest } from '@jest/globals';

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

    it('should report degraded status when database is slow', async () => {
      // Simular latência alta do banco
      const { token } = await createTestUser(UserRole.ADMIN);
      jest.spyOn(db, 'one').mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({}), 1500))
      );
    
      const response = await testRequest
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${token}`);
    
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.services.database.status).toBe('degraded');
    });
    
    it('should report unhealthy status when critical service fails', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      jest.spyOn(db, 'one').mockRejectedValueOnce(new Error('DB Connection failed'));
    
      const response = await testRequest
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${token}`);
    
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database.status).toBe('unhealthy');
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

    it('should correctly report database connection metrics', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      
      const response = await testRequest
        .get('/api/admin/metrics')
        .set('Authorization', `Bearer ${token}`);
    
      expect(response.status).toBe(200);
      expect(response.body.database.connectionPool).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          active: expect.any(Number),
          idle: expect.any(Number)
        })
      );
      expect(response.body.database.connectionPool.total).toBeGreaterThanOrEqual(
        response.body.database.connectionPool.active + response.body.database.connectionPool.idle
      );
    });
    
    it('should report accurate usage statistics', async () => {
      // Criar alguns usuários e grupos de teste
      const { token } = await createTestUser(UserRole.ADMIN);
      await createTestUser(UserRole.USER);
      await createTestUser(UserRole.USER);
      
      const response = await testRequest
        .get('/api/admin/metrics')
        .set('Authorization', `Bearer ${token}`);
    
      expect(response.status).toBe(200);
      expect(response.body.usage.totalUsers).toBeGreaterThanOrEqual(3);
      expect(response.body.usage.activeUsers).toBeGreaterThanOrEqual(1);
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

    it('should properly handle date range filtering', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
    
      const response = await testRequest
        .get('/api/admin/logs')
        .query({
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
          level: 'INFO',
          page: 1,
          limit: 10
        })
        .set('Authorization', `Bearer ${token}`);
    
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('logs');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('limit');

        // Verifica se os logs retornados estão dentro do intervalo de datas
      if (response.body.logs.length > 0) {
        response.body.logs.forEach((log: any) => {
          const logDate = new Date(log.timestamp).getTime();
          expect(logDate).toBeGreaterThanOrEqual(yesterday.getTime());
          expect(logDate).toBeLessThanOrEqual(tomorrow.getTime());
        });
      }
    });
    
    it('should enforce pagination limits', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      
      const response = await testRequest
        .get('/api/admin/logs')
        .query({
          limit: 150 // Acima do limite máximo permitido
        })
        .set('Authorization', `Bearer ${token}`);
    
      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('errors');
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Limite deve ser entre 1 e 100',
            path: 'limit',
            location: 'query'
          })
        ])
      );
    });
  });

  describe('GET /api/admin/audit', () => {
    let adminUser: User;

    beforeEach(async () => {
      // Create test admin user
      const adminData = await createTestUser(UserRole.ADMIN);
      adminUser = adminData.user;

      // Insert test audit entries directly using SQL
      await db.tx(async t => {
        await t.none(`
          INSERT INTO ng.audit_trail 
          (action, actor_id, target_type, target_id, target_name, details, ip, user_agent)
          VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            'USER_CREATE',
            adminUser.id,
            'USER',
            adminUser.id,
            'test_user',
            { test: true },
            '127.0.0.1',
            'test-agent'
          ]
        );
      });
    });

    it('should return filtered audit entries with valid parameters', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      const queryParams = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        action: 'USER_CREATE',
        page: 1,
        limit: 10
      };

      const response = await testRequest
        .get('/api/admin/audit')
        .query(queryParams)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('entries');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.entries)).toBe(true);
      expect(response.body.entries.length).toBeGreaterThan(0);
    });

    it('should validate audit query parameters', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      const invalidParams = {
        startDate: 'invalid-date',
        action: 'INVALID_ACTION',
        actorId: 'invalid-uuid',
        page: 0,
        limit: 1000
      };

      const response = await testRequest
        .get('/api/admin/audit')
        .query(invalidParams)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('details');
    });

    it('should handle search in audit details', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      const queryParams = {
        search: 'test',
        page: 1,
        limit: 10
      };

      const response = await testRequest
        .get('/api/admin/audit')
        .query(queryParams)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('entries');
      expect(Array.isArray(response.body.entries)).toBe(true);
    });

    it('should properly filter audit entries by multiple criteria', async () => {
      const { token, user } = await createTestUser(UserRole.ADMIN);
    
      // Criar algumas entradas de auditoria
      await db.none(`
        INSERT INTO ng.audit_trail 
        (action, actor_id, target_type, target_id, target_name, details, ip)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7)`,
        ['USER_UPDATE', user.id, 'USER', user.id, 'test_user', 
         { field: 'email', old: 'old@test.com', new: 'new@test.com' }, '127.0.0.1']
      );
    
      const response = await testRequest
        .get('/api/admin/audit')
        .query({
          action: 'USER_UPDATE',
          actorId: user.id,
          targetType: 'USER',
          search: 'email'
        })
        .set('Authorization', `Bearer ${token}`);
    
      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(1);
      expect(response.body.entries[0]).toMatchObject({
        action: 'USER_UPDATE',
        actor: { id: user.id },
        target: { type: 'USER' },
        details: expect.objectContaining({ field: 'email' })
      });
    });

    afterEach(async () => {
      // Clean up test audit entries
      await db.none('DELETE FROM ng.audit_trail WHERE actor_id = $1', [adminUser.id]);
    });
  });
});