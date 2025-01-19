import { db } from '../../../src/common/config/database.js';
import { createTestUser } from '../../helpers/auth.helper.js';
import { testRequest } from '../../helpers/request.helper.js';
import { UserRole } from '../../../src/features/auth/auth.types.js';
import bcrypt from 'bcryptjs';

describe('Users Routes', () => {
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