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
    await t.none('TRUNCATE TABLE ng.user_groups CASCADE');
    await t.none('TRUNCATE TABLE ng.api_key_history CASCADE');
    await t.none('TRUNCATE TABLE ng.model_permissions CASCADE');
    await t.none('TRUNCATE TABLE ng.zone_permissions CASCADE');
    await t.none('TRUNCATE TABLE ng.audit_trail CASCADE');
    await t.none('TRUNCATE TABLE ng.model_group_permissions CASCADE');
    await t.none('TRUNCATE TABLE ng.zone_group_permissions CASCADE');
    
    await t.none('TRUNCATE TABLE ng.groups CASCADE');
    await t.none('TRUNCATE TABLE ng.users CASCADE');
    await t.none('TRUNCATE TABLE ng.nomes_geograficos CASCADE');
    await t.none('TRUNCATE TABLE ng.catalogo_3d CASCADE');
    await t.none('TRUNCATE TABLE ng.identify CASCADE');
  });
  await closeDatabase();
});