// tests/features/groups/groups.test.ts
import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';
import { v4 as uuidv4 } from 'uuid';

describe('Groups Routes', () => {
  describe('GET /api/groups', () => {
    beforeEach(async () => {
      await db.tx(async t => {
        await t.none('DELETE FROM ng.groups');
      });
    });

    
    it('should list groups when authenticated as admin', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const adminUser = await db.one('SELECT id FROM ng.users LIMIT 1');

      // Criar alguns grupos para testar
      await db.tx(async t => {
        await t.none(`
          INSERT INTO ng.groups (name, description, created_by) 
          VALUES ($1, $2, $3), ($4, $5, $6)`,
          [
            'Test Group 1',
            'Description 1',
            adminUser.id,
            'Test Group 2',
            'Description 2',
            adminUser.id,
          ]
        );
      });

      // Act
      const response = await testRequest
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.groups).toHaveLength(2);
      expect(response.body.groups[0]).toHaveProperty('name', 'Test Group 1');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await testRequest.get('/api/groups');
      expect(response.status).toBe(401);
    });

    it('should return 403 when authenticated as regular user', async () => {
      const { token } = await createTestUser(UserRole.USER);
      const response = await testRequest
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should filter groups by search term correctly', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      await db.tx(t => Promise.all([
        t.none('INSERT INTO ng.groups (name) VALUES ($1)', ['SearchableGroup']),
        t.none('INSERT INTO ng.groups (name) VALUES ($1)', ['OtherGroup'])
      ]));
    
      const response = await testRequest
        .get('/api/groups?search=Search')
        .set('Authorization', `Bearer ${token}`);
    
      expect(response.status).toBe(200);
      expect(response.body.groups).toHaveLength(1);
      expect(response.body.groups[0].name).toBe('SearchableGroup');
    });
    
    it('should handle pagination correctly', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      await db.tx(t => Promise.all([
        t.none('INSERT INTO ng.groups (name) VALUES ($1)', ['Group1']),
        t.none('INSERT INTO ng.groups (name) VALUES ($1)', ['Group2']),
        t.none('INSERT INTO ng.groups (name) VALUES ($1)', ['Group3'])
      ]));
    
      const response = await testRequest
        .get('/api/groups?page=2&limit=1')
        .set('Authorization', `Bearer ${token}`);
    
      expect(response.status).toBe(200);
      expect(response.body.groups).toHaveLength(1);
      expect(response.body.total).toBe(3);
    });
  });

  xdescribe('POST /api/groups', () => {
    it('should create a new group when authenticated as admin', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.ADMIN);
      const groupData = {
        name: 'New Test Group',
        description: 'Test Description',
        userIds: [] // opcional
      };

      // Act
      const response = await testRequest
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send(groupData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', groupData.name);
      expect(response.body).toHaveProperty('description', groupData.description);
      expect(response.body).toHaveProperty('created_by', user.id);
      expect(response.body).toHaveProperty('created_by_name', user.username);

      // Verificar se foi criado no banco
      const group = await db.one('SELECT * FROM ng.groups WHERE id = $1', [response.body.id]);
      expect(group.name).toBe(groupData.name);
    });

    it('should not allow duplicate group names', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.ADMIN);
      const groupName = 'Unique Group Name';

      // Criar primeiro grupo
      await db.none(
        'INSERT INTO ng.groups (name, description, created_by) VALUES ($1, $2, $3)',
        [groupName, 'First group', user.id]
      );

      // Tentar criar outro grupo com mesmo nome
      const response = await testRequest
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: groupName,
          description: 'Second group'
        });

      expect(response.status).toBe(409);
    });

    it('should validate group name format', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      
      const response = await testRequest
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '@Invalid Name#',
          description: 'Test'
        });

      expect(response.status).toBe(422);
    });
  });

  xdescribe('PUT /api/groups/:id', () => {
    it('should update existing group', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.ADMIN);
      
      // Criar grupo para testar
      const group = await db.one(
        'INSERT INTO ng.groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
        ['Test Group', 'Original Description', user.id]
      );

      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated Description'
      };

      // Act
      const response = await testRequest
        .put(`/api/groups/${group.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('description', updateData.description);

      // Verificar no banco
      const updatedGroup = await db.one('SELECT * FROM ng.groups WHERE id = $1', [group.id]);
      expect(updatedGroup.name).toBe(updateData.name);
      expect(updatedGroup.description).toBe(updateData.description);
    });

    it('should return 404 for non-existent group', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      const fakeId = uuidv4();

      const response = await testRequest
        .put(`/api/groups/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name'
        });

      expect(response.status).toBe(404);
    });

    it('should create group with users and verify memberships', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      const testUser = await createTestUser(UserRole.USER);
      
      const response = await testRequest
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Group With Users',
          description: 'Test group with users',
          userIds: [testUser.user.id]
        });
    
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('members');
      expect(response.body.members).toHaveLength(1);
      expect(response.body.members[0]).toHaveProperty('id', testUser.user.id);
    });
    
    it('should validate userIds array', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      
      const response = await testRequest
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Invalid Users Group',
          userIds: ['invalid-uuid']
        });
    
      expect(response.status).toBe(422);
    });

    it('should update group members', async () => {
      const { token, user } = await createTestUser(UserRole.ADMIN);
      const testUser = await createTestUser(UserRole.USER);
      const group = await db.one(
        'INSERT INTO ng.groups (name, created_by) VALUES ($1, $2) RETURNING *',
        ['Test Group', user.id]
      );
    
      const response = await testRequest
        .put(`/api/groups/${group.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userIds: [testUser.user.id]
        });
    
      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(1);
      expect(response.body.members[0].id).toBe(testUser.user.id);
    });
  });

  xdescribe('DELETE /api/groups/:id', () => {
    it('should delete group and its associations', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.ADMIN);
      
      // Criar grupo para deletar
      const group = await db.one(
        'INSERT INTO ng.groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
        ['Group to Delete', 'Will be deleted', user.id]
      );

      // Act
      const response = await testRequest
        .delete(`/api/groups/${group.id}`)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Grupo removido com sucesso');

      // Verificar se foi realmente deletado
      const groupExists = await db.oneOrNone('SELECT id FROM ng.groups WHERE id = $1', [group.id]);
      expect(groupExists).toBeNull();
    });

    it('should return 404 when trying to delete non-existent group', async () => {
      const { token } = await createTestUser(UserRole.ADMIN);
      const fakeId = uuidv4();

      const response = await testRequest
        .delete(`/api/groups/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
    
    it('should maintain existing group data when updating only specific fields', async () => {
      const { token, user } = await createTestUser(UserRole.ADMIN);
      const group = await db.one(
        'INSERT INTO ng.groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
        ['Original Name', 'Original Description', user.id]
      );
    
      const response = await testRequest
        .put(`/api/groups/${group.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated Description' });
    
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Original Name');
      expect(response.body.description).toBe('Updated Description');
    });
  });
});