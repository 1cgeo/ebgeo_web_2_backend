import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pgPromise from 'pg-promise';

// Configuração do pg-promise
const pgp = pgPromise();

// Função para adicionar pepper à senha
const addPepper = (password) => {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) {
    throw new Error('PASSWORD_PEPPER não está definido no arquivo .env');
  }
  return `${password}${pepper}`;
};

// Configuração do readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para perguntar com Promise
const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

async function createAdmin() {
  try {
    // Verificar variáveis de ambiente necessárias
    const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'PASSWORD_PEPPER'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('Erro: As seguintes variáveis de ambiente são necessárias:');
      missingVars.forEach(varName => console.error(`- ${varName}`));
      process.exit(1);
    }

    // Configuração da conexão com o banco
    const db = pgp({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });

    console.log('\n=== Criação de Usuário Administrador ===\n');

    // Coletar informações do usuário
    const username = await question('Digite o nome de usuário: ');
    if (username.length < 3) {
      throw new Error('Nome de usuário deve ter pelo menos 3 caracteres');
    }

    const email = await question('Digite o email: ');
    const password = await question('Digite a senha: ');

    // Verificar se usuário ou email já existem
    const existingUser = await db.oneOrNone(
      'SELECT username, email FROM ng.users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser) {
      throw new Error(
        existingUser.username === username
          ? 'Nome de usuário já existe'
          : 'Email já está em uso'
      );
    }

    // Gerar hash da senha com pepper
    const hashedPassword = await bcrypt.hash(addPepper(password), 10);
    
    // Gerar API key
    const apiKey = uuidv4();

    // Inserir usuário no banco
    await db.none(`
      INSERT INTO ng.users (
        username, email, password, role, api_key, is_active, 
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'admin', $4, true,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      [username, email, hashedPassword, apiKey]
    );

    console.log('\nUsuário administrador criado com sucesso!');
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`API Key: ${apiKey}`);
    console.log('\nGuarde a API Key em um local seguro!\n');

  } catch (error) {
    console.error('\nErro:', error instanceof Error ? error.message : 'Erro desconhecido');
    process.exit(1);
  } finally {
    rl.close();
    pgp.end();
  }
}

// Executar o script
createAdmin();