import request from 'supertest';
import app from '../../src/app.js';

export const testRequest = request(app);