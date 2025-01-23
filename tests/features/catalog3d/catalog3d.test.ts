import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';
import { v4 as uuidv4 } from 'uuid';

describe('Catalog3D Routes', () => {
  // Fixture para criar modelo 3D para testes
  const createTestModel = async (access_level: 'public' | 'private' = 'public') => {
    const modelId = uuidv4();
    return db.one(
      `INSERT INTO ng.catalogo_3d (
        id, name, description, url, type, access_level,
        data_criacao, data_carregamento,
        search_vector
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        to_tsvector('portuguese', $2 || ' ' || COALESCE($3, ''))
      ) RETURNING *`,
      [
        modelId,
        'Test Model',
        'Test Description',
        'https://test.url',
        'mesh',
        access_level
      ]
    );
  };

  describe('GET /api/catalog3d/catalogo3d', () => {
    beforeEach(async () => {
      await db.tx(async t => {
        await t.none('DELETE FROM ng.model_permissions');
        await t.none('DELETE FROM ng.model_group_permissions');
        await t.none('DELETE FROM ng.catalogo_3d');
      });
    });

    it('should return public models without authentication', async () => {
      // Arrange
      const model = await createTestModel('public');
      
      // Act
      const response = await testRequest
        .get('/api/catalog3d/catalogo3d')
        .query({ page: 1, nr_records: 10 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(model.id);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('nr_records');
    });

    it('should return both public and private models with admin authentication', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const publicModel = await createTestModel('public');
      const privateModel = await createTestModel('private');
      
      // Act
      const response = await testRequest
        .get('/api/catalog3d/catalogo3d')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, nr_records: 10 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((m: any) => m.id))
        .toEqual(expect.arrayContaining([publicModel.id, privateModel.id]));
    });

    it('should filter models by search term', async () => {
      // Arrange
      await createTestModel('public'); // modelo sem o termo de busca
      const modelWithSearchTerm = await db.one(
        `INSERT INTO ng.catalogo_3d (
          id, name, description, url, type, access_level,
          data_criacao, data_carregamento,
          search_vector
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          to_tsvector('portuguese', $2 || ' ' || $3)
        ) RETURNING *`,
        [
          uuidv4(),
          'Specific Search Term',
          'Unique Description',
          'https://test.url',
          'mesh',
          'public'
        ]
      );
      
      // Act
      const response = await testRequest
        .get('/api/catalog3d/catalogo3d')
        .query({ 
          q: 'specific',
          page: 1,
          nr_records: 10
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(modelWithSearchTerm.id);
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      await Promise.all([
        createTestModel(),
        createTestModel(),
        createTestModel()
      ]);
      
      // Act
      const response = await testRequest
        .get('/api/catalog3d/catalogo3d')
        .query({ 
          page: 2,
          nr_records: 1
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(2);
      expect(response.body.nr_records).toBe(1);
    });

    it('should return private model when user has direct permission', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.USER);
      const privateModel = await createTestModel('private');
      await db.none(
        'INSERT INTO ng.model_permissions (model_id, user_id) VALUES ($1, $2)',
        [privateModel.id, user.id]
      );
      
      // Act
      const response = await testRequest
        .get('/api/catalog3d/catalogo3d')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, nr_records: 10 });
    
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(privateModel.id);
    });
    
    it('should return private model when user has group permission', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.USER);
      const privateModel = await createTestModel('private');
      
      // Create group with unique name
      const groupName = `Test Group ${uuidv4()}`;
      const group = await db.one(
        'INSERT INTO ng.groups (name, created_by) VALUES ($1, $2) RETURNING id',
        [groupName, user.id]
      );
    
      await db.none(
        'INSERT INTO ng.user_groups (user_id, group_id, added_by) VALUES ($1, $2, $3)',
        [user.id, group.id, user.id]
      );
      
      await db.none(
        'INSERT INTO ng.model_group_permissions (model_id, group_id, created_by) VALUES ($1, $2, $3)',
        [privateModel.id, group.id, user.id]
      );
      
      // Act
      const response = await testRequest
        .get('/api/catalog3d/catalogo3d')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, nr_records: 10 });
    
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(privateModel.id);
    });

    it('should properly rank search results by relevance', async () => {
      // Arrange
      const model1 = await db.one(
        `INSERT INTO ng.catalogo_3d (
          id, name, description, url, type, access_level,
          data_criacao, data_carregamento,
          search_vector
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          to_tsvector('portuguese', $2 || ' ' || $3)
        ) RETURNING *`,
        [uuidv4(), 'Test Drone Model', 'A simple test', 'url', 'mesh', 'public']
      );
      
      const model2 = await db.one(
        `INSERT INTO ng.catalogo_3d (
          id, name, description, url, type, access_level,
          data_criacao, data_carregamento,
          search_vector
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          to_tsvector('portuguese', $2 || ' ' || $3)
        ) RETURNING *`,
        [uuidv4(), 'Another Model', 'Test drone description', 'url', 'mesh', 'public']
      );
    
      // Act
      const response = await testRequest
        .get('/api/catalog3d/catalogo3d')
        .query({ q: 'drone', page: 1, nr_records: 10 });
    
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      // Model1 should rank higher as 'drone' appears in the title
      expect(response.body.data[0].id).toBe(model1.id);
      expect(response.body.data[1].id).toBe(model2.id);
    });
  });

  describe('GET /api/catalog3d/permissions/:modelId', () => {
    beforeEach(async () => {
      await db.tx(async t => {
        await t.none('DELETE FROM ng.model_permissions');
        await t.none('DELETE FROM ng.model_group_permissions');
        await t.none('DELETE FROM ng.catalogo_3d');
      });
    });

    it('should require authentication', async () => {
      // Act
      const response = await testRequest
        .get(`/api/catalog3d/permissions/${uuidv4()}`);

      // Assert
      expect(response.status).toBe(401);
    });

    it('should require admin role', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.USER);
      const model = await createTestModel();
      
      // Act
      const response = await testRequest
        .get(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(403);
    });

    it('should return model permissions for admin', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel();
      
      // Act
      const response = await testRequest
        .get(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('model_id', model.id);
      expect(response.body).toHaveProperty('model_name');
      expect(response.body).toHaveProperty('access_level');
      expect(response.body).toHaveProperty('user_permissions');
      expect(response.body).toHaveProperty('group_permissions');
    });

    it('should return 404 for non-existent model', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      
      // Act
      const response = await testRequest
        .get(`/api/catalog3d/permissions/${uuidv4()}`)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/catalog3d/permissions/:modelId', () => {
    beforeEach(async () => {
      await db.tx(async t => {
        await t.none('DELETE FROM ng.model_permissions');
        await t.none('DELETE FROM ng.model_group_permissions');
        await t.none('DELETE FROM ng.user_groups');
        await t.none('DELETE FROM ng.groups');
        await t.none('DELETE FROM ng.catalogo_3d');
        await t.none('DELETE FROM ng.users WHERE username LIKE \'test_user_%\'');
      });
    });
    
    it('should require authentication', async () => {
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${uuidv4()}`)
        .send({
          access_level: 'private',
          userIds: [uuidv4()],
          groupIds: [uuidv4()]
        });

      // Assert
      expect(response.status).toBe(401);
    });

    it('should require admin role', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.USER);
      const model = await createTestModel();
      
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          access_level: 'private'
        });

      // Assert
      expect(response.status).toBe(403);
    });

    it('should update model access level', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel('public');
      
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          access_level: 'private'
        });

      // Assert
      expect(response.status).toBe(200);
      
      // Verify database update
      const updatedModel = await db.one(
        'SELECT access_level FROM ng.catalogo_3d WHERE id = $1',
        [model.id]
      );
      expect(updatedModel.access_level).toBe('private');
    });

    it('should update user permissions', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel();
      const { user } = await createTestUser(UserRole.USER);
      
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userIds: [user.id]
        });

      // Assert
      expect(response.status).toBe(200);
      
      // Verify database update
      const permissions = await db.one(
        'SELECT COUNT(*) FROM ng.model_permissions WHERE model_id = $1 AND user_id = $2',
        [model.id, user.id]
      );
      expect(parseInt(permissions.count)).toBe(1);
    });

    it('should update group permissions', async () => {
      // Arrange
      const { token, user: adminUser } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel();
      
      // Create test group with unique name
      const groupName = `Test Group ${uuidv4()}`;
      const group = await db.one(
        'INSERT INTO ng.groups (name, created_by) VALUES ($1, $2) RETURNING id',
        [groupName, adminUser.id]
      );
      
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          groupIds: [group.id]
        });
    
      // Assert
      expect(response.status).toBe(200);
      
      // Verify database update
      const permissions = await db.one(
        'SELECT COUNT(*) FROM ng.model_group_permissions WHERE model_id = $1 AND group_id = $2',
        [model.id, group.id]
      );
      expect(parseInt(permissions.count)).toBe(1);
    });

    it('should handle invalid access_level', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel();
      
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          access_level: 'invalid'
        });

      // Assert
      expect(response.status).toBe(422);
    });

    it('should handle invalid user IDs', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel();
      
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userIds: ['invalid-uuid']
        });

      // Assert
      expect(response.status).toBe(422);
    });

    it('should validate all userIds exist when updating permissions', async () => {
      // Arrange
      const { token, user: adminUser } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel();
      const validUser = await createTestUser(UserRole.USER);
      const nonExistentUserId = uuidv4();
      
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userIds: [validUser.user.id, nonExistentUserId],
          created_by: adminUser.id
        });
  
      // Assert
      expect(response.status).toBe(422);
      expect(response.body.message).toMatch(/Usuários não encontrados/i);
    });
    
    it('should validate all groupIds exist when updating permissions', async () => {
      // Arrange 
      const { token, user: adminUser } = await createTestUser(UserRole.ADMIN);
      const model = await createTestModel();
      const nonExistentGroupId = uuidv4();
      
      // Act
      const response = await testRequest
        .put(`/api/catalog3d/permissions/${model.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          groupIds: [nonExistentGroupId],
          created_by: adminUser.id
        });
  
      // Assert
      expect(response.status).toBe(422);
      expect(response.body.message).toMatch(/Grupos não encontrados/i);
    });
  });
});