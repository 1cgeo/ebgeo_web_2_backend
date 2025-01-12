# EBGEO Backend

Backend do sistema EBGEO para gerenciamento e busca de dados geoespaciais, nomes geográficos e catálogo modelos 3D.

## Funcionalidades

- Pesquisa de nomes geográficos com relevância baseada em similaridade e distância
- Catálogo 3D com busca textual e paginação
- Identifica feições em modelos 3D

## Pré-requisitos

- Node.js >= 18.0.0
- npm >= 8.0.0
- PostgreSQL com extensão PostGIS
- Database EBGEO configurada com as tabelas necessárias

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
NODE_ENV=development
PORT=3000
MAX_WORKERS=8
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ebgeo2_backend
DB_USER=user_ebgeo2
DB_PASSWORD=your_password
JWT_SECRET=seu-segredo-seguro
CSRF_SECRET=outro-segredo-seguro
PASSWORD_PEPPER=outro-segredo-seguro
RATE_LIMIT_WINDOW_MS=900000  # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=http://localhost:3000,https://seu-frontend.com
SSL_KEY_PATH=/path/to/your/private.key
SSL_CERT_PATH=/path/to/your/certificate.crt
```

## Instalação e Execução

1. Clone o repositório
```bash
git clone [url-do-repositorio]
cd ebgeo-backend
```

2. Instale as dependências
```bash
npm install
```

3. Compile o TypeScript
```bash
npm run build
```

4. Execute o servidor
```bash
# Desenvolvimento com hot-reload
npm run dev

# Produção
npm start
```

## Scripts Disponíveis

- `npm start`: Inicia o servidor em produção
- `npm run dev`: Inicia o servidor em desenvolvimento com nodemon
- `npm run build`: Compila o TypeScript
- `npm run type-check`: Verifica tipos sem gerar build
- `npm run lint`: Executa o ESLint
- `npm run lint-full`: Executa verificação de tipos e ESLint

## Endpoints

### Autenticação
```
POST /api/auth/login
Body: { username: string, password: string }
Description: Autentica um usuário e retorna um token JWT

POST /api/auth/logout
Auth: Required
Description: Realiza o logout do usuário atual

GET /api/auth/api-key
Auth: Required
Description: Obtém a API key do usuário atual

POST /api/auth/api-key/regenerate
Auth: Required
Description: Gera uma nova API key para o usuário

GET /api/auth/api-key/history
Auth: Required
Description: Retorna o histórico de API keys do usuário

POST /api/auth/users
Auth: Admin Only
Body: { username: string, password: string, email: string, role: 'admin'|'user' }
Description: Cria um novo usuário

GET /api/auth/validate-api-key
Query: api_key ou Header: x-api-key
Description: Valida uma API key (usado pelo nginx auth_request)
```

### Gerenciamento de Grupos
```
GET /api/auth/groups
Auth: User/Admin
Description: Lista todos os grupos do usuário

POST /api/auth/groups
Auth: Admin Only
Body: { 
  name: string,
  description?: string 
}
Description: Cria um novo grupo

PUT /api/auth/groups/:groupId
Auth: Admin Only
Body: { 
  name?: string,
  description?: string 
}
Description: Atualiza um grupo existente
```


### Identificação de Modelos

```
GET /api/identify/feicoes
Query params:
- lat: latitude (obrigatório)
- lon: longitude (obrigatório)
- z: altitude (obrigatório)
Description: Identifica modelo 3D na coordenada informada
```

### Nomes Geográficos
```
GET /api/geographic/busca
Query params:
- q: termo de busca (obrigatório, mín. 3 caracteres)
- lat: latitude (obrigatório)
- lon: longitude (obrigatório)

GET /api/geographic/zones/:zoneId/permissions
Auth: Admin Only
Description: Lista permissões de uma zona

PUT /api/geographic/zones/:zoneId/permissions
Auth: Admin Only
Body: {
  userIds?: string[],
  groupIds?: string[]
}
Description: Atualiza permissões de uma zona
```

### Catálogo 3D
```
GET /api/catalog3d/catalogo3d
Auth: Required
Query params:
- q: termo de busca (opcional)
- page: página (opcional, default: 1)
- nr_records: registros por página (opcional, default: 10, max: 100)

GET /api/catalog3d/permissions/:modelId
Auth: Admin Only
Description: Lista permissões de um modelo

PUT /api/catalog3d/permissions/:modelId
Auth: Admin Only
Body: {
  access_level?: 'public'|'private',
  userIds?: string[],
  groupIds?: string[]
}
Description: Atualiza permissões de um modelo
```

## Arquitetura

O projeto segue uma estrutura modular organizada por features:

```
src/
├── common/           # Configurações e utilitários compartilhados
│   ├── config/      # Configurações (database, logger, env validation)
│   ├── errors/      # Tratamento de erros
│   └── middleware/  # Middlewares Express
├── features/        # Módulos de funcionalidades
│   ├── auth/        # Feature de autenticação
│   ├── identify/   # Feature de identificação de modelos
│   ├── geographic/  # Feature de nomes geográficos
│   └── catalog3d/   # Feature de catálogo 3D
├── app.ts          # Configuração do Express
└── server.ts       # Ponto de entrada da aplicação
```