# EBGeo Backend

Backend do sistema EBGeo para gerenciamento e busca de dados geoespaciais, nomes geográficos e catálogo modelos 3D.

## Funcionalidades

- Pesquisa de nomes geográficos com relevância baseada em similaridade e distância
- Catálogo 3D com busca textual e paginação
- Identifica feições em modelos 3D

## Pré-requisitos

- Node.js >= 18.0.0
- npm >= 8.0.0
- PostgreSQL com extensão PostGIS
- Database EBGeo configurada com as tabelas necessárias

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
PASSWORD_PEPPER=outro-segredo-seguro
RATE_LIMIT_WINDOW_MS=900000  # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=http://localhost:3000,https://seu-frontend.com
SSL_KEY_PATH=/path/to/your/private.key
SSL_CERT_PATH=/path/to/your/certificate.crt
LOG_DIR=logs
LOG_RETENTION_DAYS=30
LOG_MAX_SIZE=10m
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
- `npm run create-admin`: Cria um novo usuário administrador
- `npm run type-check`: Verifica tipos sem gerar build
- `npm run lint`: Executa o ESLint
- `npm run lint-full`: Executa verificação de tipos e ESLint
- `npm test`: Executa os testes
- `npm run test:watch`: Executa os testes em modo watch
- `npm run test:coverage`: Executa os testes com cobertura

## API Endpoints

### Autenticação

```
POST /api/auth/login
Description: Autentica usuário e retorna token JWT
Body: { username: string, password: string }
Response: { user: UserInfo, token: string }

POST /api/auth/logout
Auth: Required
Description: Realiza logout do usuário atual

GET /api/auth/api-key
Auth: Required
Description: Obtém API key do usuário atual

POST /api/auth/api-key/regenerate
Auth: Required
Description: Gera nova API key para o usuário

GET /api/auth/api-key/history
Auth: Required
Description: Retorna histórico de API keys

GET /api/auth/validate-api-key
Query/Header: api_key ou x-api-key
Description: Valida API key
```

### Usuários

```
GET /api/users
Auth: Admin
Query: 
  - page: number
  - limit: number
  - search: string
  - status: 'active'|'inactive'|'all'
  - role: 'admin'|'user'|'all'
Description: Lista usuários com filtros

POST /api/users
Auth: Admin
Body: { 
  username: string,
  email: string,
  password: string,
  role: 'admin'|'user',
  groupIds?: string[]
}
Description: Cria novo usuário

GET /api/users/:id
Auth: Admin
Description: Obtém detalhes do usuário

PUT /api/users/:id
Auth: Admin
Body: {
  email?: string,
  role?: 'admin'|'user',
  isActive?: boolean
}
Description: Atualiza usuário

PUT /api/users/:id/password
Auth: Admin/Self
Body: {
  currentPassword?: string,
  newPassword: string
}
Description: Altera senha do usuário

GET /api/users/me
Auth: Required
Description: Obtém perfil do usuário atual

PUT /api/users/me
Auth: Required
Body: { email?: string }
Description: Atualiza perfil do usuário atual
```

### Grupos

```
GET /api/groups
Auth: Admin
Query:
  - page: number
  - limit: number
  - search: string
Description: Lista grupos

POST /api/groups
Auth: Admin
Body: {
  name: string,
  description?: string,
  userIds?: string[]
}
Description: Cria novo grupo

PUT /api/groups/:id
Auth: Admin
Body: {
  name?: string,
  description?: string,
  userIds?: string[]
}
Description: Atualiza grupo

DELETE /api/groups/:id
Auth: Admin
Description: Remove grupo
```

### Nomes Geográficos

```
GET /api/geographic/busca
Query:
  - q: string (min. 3 caracteres)
  - lat: number
  - lon: number
Description: Busca nomes geográficos por similaridade e proximidade

GET /api/geographic/zones
Auth: Required
Description: Lista zonas geográficas

POST /api/geographic/zones
Auth: Admin
Body: {
  name: string,
  description?: string,
  geom: GeoJSON,
  userIds?: string[],
  groupIds?: string[]
}
Description: Cria nova zona

GET /api/geographic/zones/:zoneId/permissions
Auth: Admin
Description: Lista permissões de uma zona

PUT /api/geographic/zones/:zoneId/permissions
Auth: Admin
Body: {
  userIds?: string[],
  groupIds?: string[]
}
Description: Atualiza permissões de uma zona

DELETE /api/geographic/zones/:zoneId
Auth: Admin
Description: Remove zona
```

### Catálogo 3D

```
GET /api/catalog3d/catalogo3d
Auth: Required
Query:
  - q?: string
  - page?: number
  - nr_records?: number
Description: Busca no catálogo 3D

GET /api/catalog3d/permissions/:modelId
Auth: Admin
Description: Lista permissões de um modelo

PUT /api/catalog3d/permissions/:modelId
Auth: Admin
Body: {
  access_level?: 'public'|'private',
  userIds?: string[],
  groupIds?: string[]
}
Description: Atualiza permissões de um modelo
```

### Identificação de Modelos

```
GET /api/identify/feicoes
Query:
  - lat: number
  - lon: number
  - z: number
Description: Identifica feição mais próxima das coordenadas 3D
```

### Administração

```
GET /api/admin/health
Auth: Admin
Description: Verifica saúde do sistema

GET /api/admin/metrics
Auth: Admin
Description: Obtém métricas do sistema

GET /api/admin/logs
Auth: Admin
Query:
  - startDate?: Date
  - endDate?: Date
  - level?: 'ERROR'|'WARN'|'INFO'|'DEBUG'
  - category?: LogCategory
  - search?: string
Description: Consulta logs do sistema

GET /api/admin/audit
Auth: Admin
Query:
  - startDate?: Date
  - endDate?: Date
  - action?: AuditAction
  - actorId?: string
  - targetId?: string
  - search?: string
Description: Consulta trilha de auditoria
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
│   ├── admin/       # Feature de administração
│   ├── auth/        # Feature de autenticação
│   ├── users/       # Feature de usuários
│   ├── groups/      # Feature de grupos
│   ├── identify/    # Feature de identificação de modelos
│   ├── geographic/  # Feature de nomes geográficos
│   └── catalog3d/   # Feature de catálogo 3D
├── docs/           # Documentação OpenAPI/Swagger
├── app.ts          # Configuração do Express
└── index.ts        # Ponto de entrada da aplicação
```

## Documentação

A documentação completa da API está disponível em `/api-docs` quando o servidor está em execução. Ela é gerada automaticamente usando OpenAPI/Swagger.