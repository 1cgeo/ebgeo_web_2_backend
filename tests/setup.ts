import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente do arquivo .env
config({
  path: resolve(__dirname, '../.env')
});

import { initializeDatabase, closeDatabase } from '../src/common/config/database.js';
const db = initializeDatabase();

// Fechar conexão após todos os testes
afterAll(async () => {
  await db.tx(async t => {
    await t.none('DELETE FROM ng.users');
    await t.none('DELETE FROM ng.groups');
    await t.none('DELETE FROM ng.nomes_geograficos');
    await t.none('DELETE FROM ng.catalogo_3d');
    await t.none('DELETE FROM ng.identify');
    await t.none('DELETE FROM ng.audit_trail');
  });
  await closeDatabase();
});