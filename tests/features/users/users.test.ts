import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

describe('Users Routes', () => {
  beforeEach(async () => {
    await db.tx(async t => {
      await t.none('DELETE FROM ng.model_permissions WHERE user_id IN (SELECT id FROM ng.users)');
      await t.none('DELETE FROM ng.user_groups WHERE user_id IN (SELECT id FROM ng.users)');
      await t.none('DELETE FROM ng.users');
    });
  });

  describe('GET /api/users', () => {
    it('should list users when authenticated as admin', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);

      // Act
      const response = await testRequest
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should filter users by search term', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const searchTerm = 'test';

      // Act
      const response = await testRequest
        .get(`/api/users?search=${searchTerm}`)
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.users.every((user: any) => 
        user.username.includes(searchTerm) || user.email.includes(searchTerm)
      )).toBe(true);
    });

    it('should reject non-admin users', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.USER);

      // Act
      const response = await testRequest
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/users', () => {
    it('should create new user when authenticated as admin', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const newUser = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
        role: UserRole.USER
      };

      // Act
      const response = await testRequest
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send(newUser);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.username).toBe(newUser.username);
      expect(response.body.email).toBe(newUser.email);
      expect(response.body.role).toBe(newUser.role);

      // Verify user was created in database
      const dbUser = await db.one('SELECT * FROM ng.users WHERE username = $1', [newUser.username]);
      expect(dbUser).toBeTruthy();
      expect(dbUser.is_active).toBe(true);
    });

    it('should reject duplicate username', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.ADMIN);
      const newUser = {
        username: user.username, // Using existing username
        email: 'different@example.com',
        password: 'Password123!',
        role: UserRole.USER
      };

      // Act
      const response = await testRequest
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send(newUser);

      // Assert
      expect(response.status).toBe(409);
    });

    it('should reject invalid user data', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const invalidUser = {
        username: 'a', // Too short
        email: 'invalid-email',
        password: '123', // Too simple
        role: 'invalid-role'
      };

      // Act
      const response = await testRequest
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidUser);

      // Assert
      expect(response.status).toBe(422);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user when authenticated as admin', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const { user: targetUser } = await createTestUser(UserRole.USER);
      const updates = {
        email: 'updated@example.com',
        isActive: false
      };

      // Act
      const response = await testRequest
        .put(`/api/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updates);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.email).toBe(updates.email);
      expect(response.body.is_active).toBe(updates.isActive);

      // Verify changes in database
      const dbUser = await db.one('SELECT * FROM ng.users WHERE id = $1', [targetUser.id]);
      expect(dbUser.email).toBe(updates.email);
      expect(dbUser.is_active).toBe(updates.isActive);
    });

    it('should reject invalid updates', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const { user: targetUser } = await createTestUser(UserRole.USER);
      const updates = {
        email: 'invalid-email',
        role: 'invalid-role'
      };

      // Act
      const response = await testRequest
        .put(`/api/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updates);

      // Assert
      expect(response.status).toBe(422);
    });
  });

  describe('PUT /api/users/:id/password', () => {
    it('should allow admin to change user password without current password', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.ADMIN);
      const { user: targetUser } = await createTestUser(UserRole.USER);
      const newPassword = 'NewPassword123!';

      // Act
      const response = await testRequest
        .put(`/api/users/${targetUser.id}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPassword });

      // Assert
      expect(response.status).toBe(200);

      // Verify password was updated
      const dbUser = await db.one('SELECT password FROM ng.users WHERE id = $1', [targetUser.id]);
      const isNewPasswordValid = await bcrypt.compare(
        `${newPassword}${process.env.PASSWORD_PEPPER}`,
        dbUser.password
      );
      expect(isNewPasswordValid).toBe(true);
    });

    it('should require current password for self password change', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.USER);
      const newPassword = 'NewPassword123!';

      // Act
      const response = await testRequest
        .put(`/api/users/${user.id}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPassword }); // Missing currentPassword

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/users/me', () => {
    it('should return current user profile', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.USER);

      // Act
      const response = await testRequest
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user.id);
      expect(response.body.username).toBe(user.username);
      expect(response.body.email).toBe(user.email);
      expect(response.body).toHaveProperty('groups');
      expect(response.body).toHaveProperty('permissions');
    });

    it('should reject unauthenticated request', async () => {
      // Act
      const response = await testRequest.get('/api/users/me');

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/users/me', () => {
    it('should update own profile', async () => {
      // Arrange
      const { token, user } = await createTestUser(UserRole.USER);
      const updates = {
        email: 'updated-self@example.com'
      };

      // Act
      const response = await testRequest
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updates);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.email).toBe(updates.email);

      // Verify changes in database
      const dbUser = await db.one('SELECT email FROM ng.users WHERE id = $1', [user.id]);
      expect(dbUser.email).toBe(updates.email);
    });

    it('should reject invalid email update', async () => {
      // Arrange
      const { token } = await createTestUser(UserRole.USER);
      const updates = {
        email: 'invalid-email'
      };

      // Act
      const response = await testRequest
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updates);

      // Assert
      expect(response.status).toBe(422);
    });
  });
});

describe('Extended Users Routes Tests', () => {
  beforeEach(async () => {
    await db.tx(async t => {
      await t.none('DELETE FROM ng.model_permissions WHERE user_id IN (SELECT id FROM ng.users)');
      await t.none('DELETE FROM ng.user_groups WHERE user_id IN (SELECT id FROM ng.users)');
      await t.none('DELETE FROM ng.users');
    });
  });

  describe('GET /api/users with filters', () => {
    it('should handle pagination correctly', async () => {
      // Create admin user for the test
      const { token, user: adminUser } = await createTestUser(UserRole.ADMIN);
  
      // Insert 5 users with known data
      const testUsers: Array<{ id: string; username: string }> = [];
      
      for (let i = 0; i < 5; i++) {
        const result = await db.one<{ id: string; username: string }>(`
          INSERT INTO ng.users 
          (username, email, password, role, is_active, api_key, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, true, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id, username
        `, [
          `test_${i}`,
          `paginate${i}@test.com`,
          'password_hash',
          'user',
          uuidv4(),
          adminUser.id
        ]);
        testUsers.push(result);
      }
  
      // Get first page
      const firstPage = await testRequest
        .get('/api/users?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);
  
      // Get second page
      const secondPage = await testRequest
        .get('/api/users?page=2&limit=2')
        .set('Authorization', `Bearer ${token}`);

      // Get third page
      const thirdPage = await testRequest
        .get('/api/users?page=3&limit=2')
        .set('Authorization', `Bearer ${token}`);

      // Assertions
      expect(firstPage.status).toBe(200);
      expect(firstPage.body.users.length).toBe(2);
      expect(secondPage.body.users.length).toBe(2);
      expect(thirdPage.body.users.length).toBe(2);
  
      // Verify total count
      expect(firstPage.body.total).toBe(6);
      expect(firstPage.body.page).toBe(1);
      expect(secondPage.body.page).toBe(2);
      expect(thirdPage.body.page).toBe(3);
  
      // Verify no duplicates between pages
      const allReturnedIds = [
        ...firstPage.body.users.map((u: { id: string }) => u.id),
        ...secondPage.body.users.map((u: { id: string }) => u.id),
        ...thirdPage.body.users.map((u: { id: string }) => u.id)
      ];
  
      const uniqueIds = new Set(allReturnedIds);
      expect(uniqueIds.size).toBe(allReturnedIds.length);
  
      // Verify returned users are from our test set
      const testUserIds = new Set(testUsers.map(u => u.id));
      testUserIds.add(adminUser.id)
      for (const id of allReturnedIds) {
        expect(testUserIds.has(id)).toBe(true);
      }
    });
  });

  describe('Password Management', () => {
    it('should validate password complexity requirements', async () => {
      const { token, user, password: currentPassword } = await createTestUser(UserRole.USER);
      const invalidPasswords = [
        'short',              // Too short
        'nouppercase123!',    // No uppercase
        'NOLOWERCASE123!',    // No lowercase
        'NoSpecialChar123',   // No special char
        'NoNumber!@#'         // No number
      ];

      for (const newPassword of invalidPasswords) {
        const response = await testRequest
          .put(`/api/users/${user.id}/password`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword,
            newPassword
          });

        expect(response.status).toBe(422);
        expect(response.body.message).toBe('Dados inválidos');
      }
    });
  });

  describe('User Profile and Permissions', () => {
    it('should return correct model permissions format', async () => {
      const { token, user } = await createTestUser(UserRole.USER);
      const modelId = uuidv4();

      await db.tx(async t => {
        await t.none(`
          INSERT INTO ng.catalogo_3d (id, name, url, type)
          VALUES ($1, $2, $3, $4)
        `, [modelId, 'Test Model', 'http://test.com', 'mesh']);

        await t.none(`
          INSERT INTO ng.model_permissions (model_id, user_id)
          VALUES ($1, $2)
        `, [modelId, user.id]);
      });

      const response = await testRequest
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.permissions.models.items[0]).toMatchObject({
        id: modelId,
        access_type: 'direct'
      });
    });
  });

  describe('User Management Edge Cases', () => {
    it('should handle email uniqueness constraint', async () => {
      const { token: adminToken } = await createTestUser(UserRole.ADMIN);
      const { user: user1 } = await createTestUser(UserRole.USER);
      const { user: user2 } = await createTestUser(UserRole.USER);
      const timestamp = Date.now();
      const newEmail = `unique_${timestamp}@example.com`;

      // Update sequentially to ensure predictable behavior
      const response1 = await testRequest
        .put(`/api/users/${user1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: newEmail });

      const response2 = await testRequest
        .put(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: newEmail });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(409);

      const usersWithEmail = await db.any('SELECT id FROM ng.users WHERE email = $1', [newEmail]);
      expect(usersWithEmail.length).toBe(1);
      expect(usersWithEmail[0].id).toBe(user1.id);
    });
  });
});