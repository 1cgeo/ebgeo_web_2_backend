import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';
import { v4 as uuidv4 } from 'uuid';

describe('Identify Routes', () => {
  // Fixtures para criar dados de teste
  const createTestModel = async (access_level: 'public' | 'private' = 'public') => {
    return db.one(
      `INSERT INTO ng.catalogo_3d (
        id, name, description, url, type, access_level,
        data_criacao, data_carregamento
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        uuidv4(),
        'Test Model',
        'Test Description',
        'https://test.url',
        'mesh',
        access_level
      ]
    );
  };

  const createTestFeature = async (
    model_id: string,
    {
      altitude_base = 750,
      altitude_topo = 800,
      lon = -46.6333,
      lat = -23.5505
    } = {}
  ) => {
    return db.one(
      `INSERT INTO ng.identify (
        nome, municipio, estado, tipo,
        altitude_base, altitude_topo,
        geom, model_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(
          ${lon - 0.001} ${lat - 0.001},
          ${lon + 0.001} ${lat - 0.001},
          ${lon + 0.001} ${lat + 0.001},
          ${lon - 0.001} ${lat + 0.001},
          ${lon - 0.001} ${lat - 0.001}
        )')), 4674),
        $7
      ) RETURNING *`,
      [
        'Test Feature',
        'São Paulo',
        'SP',
        'Building',
        altitude_base,
        altitude_topo,
        model_id
      ]
    );
  };

  beforeEach(async () => {
    // Limpar tabelas antes de cada teste
    await db.none('DELETE FROM ng.identify');
    await db.none('DELETE FROM ng.catalogo_3d');
  });

  describe('GET /api/identify/feicoes', () => {
    it('should validate required query parameters', async () => {
      // Act
      const response = await testRequest.get('/api/identify/feicoes');

      // Assert
      expect(response.status).toBe(422);
      expect(response.body.message).toMatch(/Dados inválidos/i);
    });

    it('should validate coordinate ranges', async () => {
      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query({
          lat: 91, // Inválido: > 90
          lon: -46.6333,
          z: 760
        });

      // Assert
      expect(response.status).toBe(422);
      expect(response.body.message).toMatch(/Dados inválidos/i);
    });

    it('should find feature in public model without authentication', async () => {
      // Arrange
      const model = await createTestModel('public');
      const feature = await createTestFeature(model.id);
      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 760
      };

      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', feature.id);
      expect(response.body).toHaveProperty('nome', feature.nome);
      expect(response.body).toHaveProperty('model_id', model.id);
      expect(response.body).toHaveProperty('z_distance');
      expect(response.body).toHaveProperty('xy_distance');
    });

    it('should not find feature in private model without authentication', async () => {
      // Arrange
      const model = await createTestModel('private');
      await createTestFeature(model.id);
      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 760
      };

      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/nenhuma feição encontrada/i);
    });

    it('should find feature in private model with admin authentication', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel('private');
      const feature = await createTestFeature(model.id);
      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 760
      };

      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .set('Authorization', `Bearer ${token}`)
        .query(queryPoint);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', feature.id);
      expect(response.body).toHaveProperty('model_id', model.id);
    });

    it('should find closest feature by altitude', async () => {
      // Arrange
      const model = await createTestModel('public');
      await createTestFeature(model.id, {
        altitude_base: 700,
        altitude_topo: 750
      });
      const feature2 = await createTestFeature(model.id, {
        altitude_base: 750,
        altitude_topo: 800
      });
      
      // Query point mais próximo da feature2
      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 780
      };

      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', feature2.id);
      expect(response.body.z_distance).toBeLessThan(30);
    });

    it('should handle feature with user permission', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.USER);
      const model = await createTestModel('private');
      const feature = await createTestFeature(model.id);

      // Add permission for user
      await db.none(
        'INSERT INTO ng.model_permissions (model_id, user_id) VALUES ($1, $2)',
        [model.id, user.id]
      );

      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 760
      };

      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .set('Authorization', `Bearer ${token}`)
        .query(queryPoint);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', feature.id);
    });

    it('should handle feature with group permission', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.USER);
      const model = await createTestModel('private');
      const feature = await createTestFeature(model.id);

      // Create group and add user to it
      const group = await db.one(
        'INSERT INTO ng.groups (name, created_by) VALUES ($1, $2) RETURNING id',
        ['Test Group', user.id]
      );
      await db.none(
        'INSERT INTO ng.user_groups (user_id, group_id, added_by) VALUES ($1, $2, $3)',
        [user.id, group.id, user.id]
      );
      await db.none(
        'INSERT INTO ng.model_group_permissions (model_id, group_id) VALUES ($1, $2)',
        [model.id, group.id]
      );

      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 760
      };

      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .set('Authorization', `Bearer ${token}`)
        .query(queryPoint);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', feature.id);
    });

    it('should return appropriate message when no feature is found', async () => {
      // Arrange
      const queryPoint = {
        lat: 0, // Ponto longe de qualquer feature
        lon: 0,
        z: 0
      };

      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/nenhuma feição encontrada/i);
    });

    it('should include model details in feature response', async () => {
      // Arrange
      const model = await createTestModel('public');
      await createTestFeature(model.id);
      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 760
      };

      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('model_name', model.name);
      expect(response.body).toHaveProperty('model_description', model.description);
    });

    it('should prioritize xy_distance when z_distance is equal', async () => {
      // Arrange
      const model = await createTestModel('public');
      const feature1 = await createTestFeature(model.id, {
        altitude_base: 750,
        altitude_topo: 800,
        lon: -46.6333,
        lat: -23.5505
      });
      await createTestFeature(model.id, {
        altitude_base: 750,
        altitude_topo: 800,
        lon: -46.6343, // Mais distante horizontalmente mas mesma altitude
        lat: -23.5505
      });
      
      // Query point exatamente no centro vertical da feature1
      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 775  // Ponto médio entre base (750) e topo (800)
      };
    
      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);
    
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', feature1.id);
      expect(response.body.z_distance).toBe(0);
      expect(response.body.xy_distance).toBeLessThanOrEqual(0.001);
    });

    it('should not find features outside search buffer radius', async () => {
      // Arrange
      const model = await createTestModel('public');
      const centerLon = -46.6333;
      const centerLat = -23.5505;
      
      await createTestFeature(model.id, {
        lon: centerLon,
        lat: centerLat
      });
      
      // Point ~500 metros de distância (fora do buffer de 300m)
      const offset = 0.004; // aproximadamente 500m em graus
      const queryPoint = {
        lat: centerLat + offset,
        lon: centerLon + offset,
        z: 760
      };
    
      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);
    
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Nenhuma feição encontrada para as coordenadas fornecidas.');
    });

    it('should find closest feature when multiple models overlap', async () => {
      // Arrange
      const model1 = await createTestModel('public');
      const model2 = await createTestModel('public');
      
      // Feature mais próxima do ponto de busca
      const feature1 = await createTestFeature(model1.id, {
        altitude_base: 750,
        altitude_topo: 800,
        lon: -46.6333,
        lat: -23.5505
      });
      
      // Feature um pouco mais distante
      await createTestFeature(model2.id, {
        altitude_base: 750,
        altitude_topo: 800,
        lon: -46.6335,
        lat: -23.5507
      });
    
      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 775
      };
    
      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);
    
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', feature1.id);
      expect(response.body).toHaveProperty('model_id', model1.id);
      expect(response.body.xy_distance).toBeLessThanOrEqual(0.001);
    });

    it('should handle overlapping features from different models', async () => {
      // Arrange
      const model1 = await createTestModel('public');
      const model2 = await createTestModel('public');
      
      const feature1 = await createTestFeature(model1.id, {
        altitude_base: 750,
        altitude_topo: 800
      });
      
      await createTestFeature(model2.id, {
        altitude_base: 700,
        altitude_topo: 850  // Maior amplitude mas mesmo centro
      });
    
      const queryPoint = {
        lat: -23.5505,
        lon: -46.6333,
        z: 760
      };
    
      // Act
      const response = await testRequest
        .get('/api/identify/feicoes')
        .query(queryPoint);
    
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', feature1.id);
      expect(response.body).toHaveProperty('model_id', model1.id);
    });
  });
});