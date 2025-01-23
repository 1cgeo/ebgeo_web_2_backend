import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';

interface GeographicResponse {
  nome: string;
  municipio?: string;
  estado?: string;
  tipo?: string;
  name_similarity?: number;
  distance_to_center?: number;
  access_level: 'public' | 'private';
}

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

    it('should handle private names when user has permissions', async () => {
      const { token, user } = await createTestUser(UserRole.USER);
      
      const zoneId = await db.one<{id: string}>(`
        INSERT INTO ng.geographic_access_zones (
          name, geom, created_by
        ) VALUES (
          'Test Zone', 
          ST_SetSRID(ST_GeomFromText('POLYGON((-46.7 -23.4, -46.6 -23.4, -46.6 -23.5, -46.7 -23.5, -46.7 -23.4))'), 4674),
          $1
        ) RETURNING id
      `, [user.id]);
      
      await db.none(`
        INSERT INTO ng.nomes_geograficos (
          nome, access_level, geom
        ) VALUES (
          'Local Privado', 'private',
          ST_SetSRID(ST_MakePoint(-46.65, -23.45), 4674)
        )
      `);
      
      await db.none(`
        INSERT INTO ng.zone_permissions (zone_id, user_id)
        VALUES ($1, $2)
      `, [zoneId.id, user.id]);
    
      const response = await testRequest
        .get('/api/geographic/busca')
        .set('Authorization', `Bearer ${token}`)
        .query({
          q: 'Local',
          lat: -23.45,
          lon: -46.65
        });
    
      expect(response.status).toBe(200);
      const results = response.body as GeographicResponse[];
      expect(results.some(result => result.nome === 'Local Privado')).toBe(true);
    });
    
    it('should combine similarity and distance in relevance scoring', async () => {
      await db.none(`
        INSERT INTO ng.nomes_geograficos (
          nome, access_level, geom
        ) VALUES 
        ('Parque do Ibirapuera', 'public', ST_SetSRID(ST_MakePoint(-46.657, -23.588), 4674)),
        ('Ibirapuera Mall', 'public', ST_SetSRID(ST_MakePoint(-46.672, -23.601), 4674)),
        ('Shopping Morumbi', 'public', ST_SetSRID(ST_MakePoint(-46.702, -23.622), 4674))
      `);
    
      const response = await testRequest
        .get('/api/geographic/busca')
        .query({
          q: 'Ibirapuera',
          lat: -23.588,
          lon: -46.657
        });
    
      expect(response.status).toBe(200);
      const results = response.body as GeographicResponse[];
      expect(results.length).toBeGreaterThan(1);
      expect(results.map(r => r.nome)).toContain('Parque do Ibirapuera');
      expect(results.map(r => r.nome)).toContain('Ibirapuera Mall');
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
        expect(response.body.description).toBe(zoneData.description);
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

      it('should reject zones with invalid geometry', async () => {
        const { token } = await createTestUser(UserRole.ADMIN);
        
        const invalidData = {
          name: 'Test Zone',
          geom: {
            type: 'Point', // Tipo inválido, deveria ser Polygon
            coordinates: [-46.6333, -23.5505]
          }
        };
      
        const response = await testRequest
          .post('/api/geographic/zones')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData);
      
        expect(response.status).toBe(422);
        expect(response.body.details).toBeDefined();
        expect(response.body.message).toBe('Dados inválidos');
      });

      it('should reject zones with invalid polygon', async () => {
        const { token } = await createTestUser(UserRole.ADMIN);
        
        const invalidData = {
          name: 'Test Zone',
          geom: {
            type: 'Polygon',
            coordinates: [[]] // Invalid empty coordinates
          }
        };
      
        const response = await testRequest
          .post('/api/geographic/zones')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData);
      
        expect(response.status).toBe(422);
        expect(response.body.message).toBe('Dados inválidos');
        expect(response.body.details).toBeDefined();
      });
    });

    describe('Zone Permissions', () => {
      let zoneId: string;
      let adminToken: string;
      let adminUserId: string;

      beforeEach(async () => {
        // Create admin user
        const { token, user } = await createTestUser(UserRole.ADMIN);
        adminToken = token;
        adminUserId = user.id;

        // Create test zone
        const zoneResult = await db.tx(async t => {
          // Ensure any existing zones are cleaned up
          await t.none('DELETE FROM ng.geographic_access_zones');

          // Create new zone
          return t.one(`
            INSERT INTO ng.geographic_access_zones (
              name, description, geom, created_by
            ) VALUES (
              $1, $2, ST_SetSRID(ST_GeomFromText($3), 4674), $4
            ) RETURNING id, name, description
          `, [
            'Test Zone',
            'Description',
            'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))',
            adminUserId
          ]);
        });
        
        zoneId = zoneResult.id;
      });

      afterEach(async () => {
        // Cleanup zones
        await db.tx(async t => {
          await t.none('DELETE FROM ng.zone_permissions WHERE zone_id = $1', [zoneId]);
          await t.none('DELETE FROM ng.zone_group_permissions WHERE zone_id = $1', [zoneId]);
          await t.none('DELETE FROM ng.geographic_access_zones WHERE id = $1', [zoneId]);
        });
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
        // Create a test user to add permissions
        const { user: testUser } = await createTestUser(UserRole.USER);

        const updateData = {
          userIds: [testUser.id]
        };

        // Act
        const response = await testRequest
          .put(`/api/geographic/zones/${zoneId}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Permissões atualizadas com sucesso');

        // Verify permissions were updated
        const perms = await db.one(`
          SELECT COUNT(*) as count 
          FROM ng.zone_permissions 
          WHERE zone_id = $1 AND user_id = $2
        `, [zoneId, testUser.id]);
        expect(parseInt(perms.count)).toBe(1);
      });

      it('should handle group permissions correctly', async () => {
        const { token: adminToken, user: adminUser } = await createTestUser(UserRole.ADMIN);
        const { user: regularUser } = await createTestUser(UserRole.USER);
      
        // Create zone first
        const zone = await db.one<{id: string}>(`
          INSERT INTO ng.geographic_access_zones (
            name, geom, created_by
          ) VALUES (
            'Test Zone',
            ST_SetSRID(ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'), 4674),
            $1
          ) RETURNING id
        `, [adminUser.id]);
      
        // Create group and add user
        const group = await db.one<{id: string}>(`
          INSERT INTO ng.groups (name, created_by) VALUES ('Test Group', $1) RETURNING id
        `, [adminUser.id]);
      
        await db.none(`
          INSERT INTO ng.user_groups (user_id, group_id, added_by) VALUES ($1, $2, $3)
        `, [regularUser.id, group.id, adminUser.id]);
      
        const updateData = {
          groupIds: [group.id]
        };
      
        const response = await testRequest
          .put(`/api/geographic/zones/${zone.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);
      
        expect(response.status).toBe(200);
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
            'Test Zone',
            'Description',
            ST_SetSRID(ST_GeomFromText('POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))'), 4674),
            $1
          ) RETURNING id
        `, [adminUser.id]);

        // Add user permission
        await db.none(`
          INSERT INTO ng.zone_permissions (zone_id, user_id, created_by)
          VALUES ($1, $2, $3)
        `, [zoneResult.id, user.id, adminUser.id]);

        // Act
        const response = await testRequest
          .delete(`/api/geographic/zones/${zoneResult.id}`)
          .set('Authorization', `Bearer ${token}`);

        // Assert
        expect(response.status).toBe(200);

        // Verify zone is deleted
        const deletedZone = await db.oneOrNone(
          'SELECT id FROM ng.geographic_access_zones WHERE id = $1',
          [zoneResult.id]
        );
        expect(deletedZone).toBeNull();
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