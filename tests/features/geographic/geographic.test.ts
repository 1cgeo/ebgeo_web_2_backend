import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';

describe('Geographic Routes', () => {
  describe('GET /api/geographic/busca', () => {
    it('should search geographic names with valid parameters', async () => {
      // Arrange
      await db.none(`
        INSERT INTO ng.nomes_geograficos (
          nome, municipio, estado, tipo, access_level, geom
        ) VALUES 
        ('Pico do Jaraguá', 'São Paulo', 'SP', 'Pico', 'public', 
         ST_SetSRID(ST_MakePoint(-46.7667, -23.4667), 4674)),
        ('Jardim Paulista', 'São Paulo', 'SP', 'Bairro', 'public',
         ST_SetSRID(ST_MakePoint(-46.6667, -23.5667), 4674))
      `);

      // Act
      const response = await testRequest
        .get('/api/geographic/busca')
        .query({
          q: 'Jara',
          lat: -23.5505,
          lon: -46.6333
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('nome', 'Pico do Jaraguá');
      expect(response.body[0]).toHaveProperty('name_similarity');
      expect(response.body[0]).toHaveProperty('distance_to_center');
    });

    it('should validate required parameters', async () => {
      // Act
      const response = await testRequest.get('/api/geographic/busca');

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('message');
      expect(response.body.details).toBeDefined();
    });

    it('should validate coordinate ranges', async () => {
      // Act
      const response = await testRequest
        .get('/api/geographic/busca')
        .query({
          q: 'test',
          lat: 91, // Invalid latitude
          lon: -46.6333
        });

      // Assert
      expect(response.status).toBe(422);
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Geographic Zones (Admin Routes)', () => {
    describe('GET /api/geographic/zones', () => {
      it('should list zones for admin user', async () => {
        // Arrange
        const { token, user } = await createTestUser(UserRole.ADMIN);
        await db.none(`
          INSERT INTO ng.geographic_access_zones (
            name, description, geom, created_by
          ) VALUES 
          ('Test Zone', 'Test Description', 
           ST_SetSRID(ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'), 4674),
           $1)
        `, [user.id]);

        // Act
        const response = await testRequest
          .get('/api/geographic/zones')
          .set('Authorization', `Bearer ${token}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body[0]).toHaveProperty('name', 'Test Zone');
        expect(response.body[0]).toHaveProperty('area_km2');
      });

      it('should reject non-admin users', async () => {
        // Arrange
        const { token } = await createTestUser(UserRole.USER);

        // Act
        const response = await testRequest
          .get('/api/geographic/zones')
          .set('Authorization', `Bearer ${token}`);

        // Assert
        expect(response.status).toBe(403);
      });
    });

    describe('POST /api/geographic/zones', () => {
      it('should create new zone with valid data', async () => {
        // Arrange
        const { token, user } = await createTestUser(UserRole.ADMIN);
        const zoneData = {
          name: 'New Test Zone',
          description: 'Test Description',
          geom: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
          }
        };

        // Act
        const response = await testRequest
          .post('/api/geographic/zones')
          .set('Authorization', `Bearer ${token}`)
          .send(zoneData);

        // Assert
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('name', zoneData.name);
        expect(response.body).toHaveProperty('created_by', user.id);
      });

      it('should validate zone data', async () => {
        // Arrange
        const { token } = await createTestUser(UserRole.ADMIN);
        const invalidData = {
          name: '', // Invalid empty name
          geom: 'invalid' // Invalid geometry
        };

        // Act
        const response = await testRequest
          .post('/api/geographic/zones')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData);

        // Assert
        expect(response.status).toBe(422);
        expect(response.body.details).toBeDefined();
      });
    });

    describe('Zone Permissions', () => {
      let zoneId: string;
      let adminToken: string;

      beforeEach(async () => {
        const { token, user } = await createTestUser(UserRole.ADMIN);
        adminToken = token;

        // Create test zone
        const result = await db.one(`
          INSERT INTO ng.geographic_access_zones (
            name, description, geom, created_by
          ) VALUES (
            'Test Zone', 'Description',
            ST_SetSRID(ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'), 4674),
            $1
          ) RETURNING id
        `, [user.id]);
        zoneId = result.id;
      });

      it('should get zone permissions', async () => {
        // Act
        const response = await testRequest
          .get(`/api/geographic/zones/${zoneId}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('zone_id', zoneId);
        expect(response.body).toHaveProperty('user_permissions');
        expect(response.body).toHaveProperty('group_permissions');
      });

      it('should update zone permissions', async () => {
        // Arrange
        const { user } = await createTestUser(UserRole.USER);
        const permissions = {
          userIds: [user.id]
        };

        // Act
        const response = await testRequest
          .put(`/api/geographic/zones/${zoneId}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(permissions);

        // Assert
        expect(response.status).toBe(200);

        // Verify permissions were updated
        const updatedPerms = await db.one(
          'SELECT COUNT(*) FROM ng.zone_permissions WHERE zone_id = $1 AND user_id = $2',
          [zoneId, user.id]
        );
        expect(parseInt(updatedPerms.count)).toBe(1);
      });
    });

    describe('DELETE /api/geographic/zones/:zoneId', () => {
      it('should delete zone and associated permissions', async () => {
        // Arrange
        const { token, user: adminUser } = await createTestUser(UserRole.ADMIN);
        const { user } = await createTestUser(UserRole.USER);
        
        // Create test zone with permissions
        const zoneResult = await db.one(`
          INSERT INTO ng.geographic_access_zones (
            name, description, geom, created_by
          ) VALUES (
            'Zone to Delete', 'Will be deleted',
            ST_SetSRID(ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'), 4674),
            $1
          ) RETURNING id
        `, [adminUser.id]);

        await db.none(
          'INSERT INTO ng.zone_permissions (zone_id, user_id, created_by) VALUES ($1, $2, $3)',
          [zoneResult.id, user.id, adminUser.id]
        );

        // Act
        const response = await testRequest
          .delete(`/api/geographic/zones/${zoneResult.id}`)
          .set('Authorization', `Bearer ${token}`);

        // Assert
        expect(response.status).toBe(200);

        // Verify zone and permissions were deleted
        const zoneExists = await db.oneOrNone(
          'SELECT id FROM ng.geographic_access_zones WHERE id = $1',
          [zoneResult.id]
        );
        expect(zoneExists).toBeNull();

        const permExists = await db.oneOrNone(
          'SELECT zone_id FROM ng.zone_permissions WHERE zone_id = $1',
          [zoneResult.id]
        );
        expect(permExists).toBeNull();
      });

      it('should return 404 for non-existent zone', async () => {
        // Arrange
        const { token } = await createTestUser(UserRole.ADMIN);
        const nonExistentId = '00000000-0000-0000-0000-000000000000';

        // Act
        const response = await testRequest
          .delete(`/api/geographic/zones/${nonExistentId}`)
          .set('Authorization', `Bearer ${token}`);

        // Assert
        expect(response.status).toBe(404);
      });
    });
  });
});