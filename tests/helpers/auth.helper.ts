import { db } from '../../src/common/config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '../../src/features/auth/auth.types.js';

export const createTestUser = async (
  role: UserRole = UserRole.USER,
  isActive: boolean = true
) => {
  const userId = uuidv4();
  const password = "password123";
  const pepper = process.env.PASSWORD_PEPPER || 'test_pepper';
  const hashedPassword = await bcrypt.hash(`${password}${pepper}`, 10);

  const user = await db.one(
    `INSERT INTO ng.users 
     (id, username, email, password, role, is_active, api_key) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING *`,
    [
      userId,
      `test_user_${userId.slice(0, 8)}`,
      `test_${userId.slice(0, 8)}@example.com`,
      hashedPassword,
      role,
      isActive,
      uuidv4(),
    ]
  );

  const createdUser = await db.one('SELECT * FROM ng.users WHERE id = $1', [userId]);
  if (!createdUser) {
    throw new Error('Failed to create test user');
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'test_secret',
    { expiresIn: '15m' }
  );

  return { user, token, password };
};