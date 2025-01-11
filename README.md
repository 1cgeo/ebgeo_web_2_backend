# EBGEO Backend

Backend do sistema EBGEO para gerenciamento e busca de dados geoespaciais, incluindo edificações, nomes geográficos e catálogo 3D.

## Funcionalidades

- Busca de edificações próximas por coordenadas geográficas e altitude
- Pesquisa de nomes geográficos com relevância baseada em similaridade e distância
- Catálogo 3D com busca textual e paginação

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

DB_HOST=localhost
DB_PORT=5432
DB_NAME=ebgeo
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
JWT_SECRET=seu-segredo-seguro
CSRF_SECRET=outro-segredo-seguro
PASSWORD_PEPPER=outro-segredo-seguro
RATE_LIMIT_WINDOW_MS=900000  # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100
COOKIE_SECURE=true  # Em produção
COOKIE_SAME_SITE=strict
ALLOWED_ORIGINS=http://localhost:3000,https://seu-frontend.com
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

### Edificações
```
GET /api/buildings/feicoes
Query params:
- lat: latitude (obrigatório)
- lon: longitude (obrigatório)
- z: altitude (obrigatório)
```

### Nomes Geográficos
```
GET /api/geographic/busca
Query params:
- q: termo de busca (obrigatório, mín. 3 caracteres)
- lat: latitude (obrigatório)
- lon: longitude (obrigatório)
```

### Catálogo 3D
```
GET /api/catalog3d/catalogo3d
Query params:
- q: termo de busca (opcional)
- page: página (opcional, default: 1)
- nr_records: registros por página (opcional, default: 10, max: 100)
```

## Arquitetura

O projeto segue uma estrutura modular organizada por features:

```
src/
├── common/           # Configurações e utilitários compartilhados
│   ├── config/      # Configurações (database, logger, etc)
│   ├── errors/      # Tratamento de erros
│   └── middleware/  # Middlewares Express
├── features/        # Módulos de funcionalidades
│   ├── buildings/   # Feature de edificações
│   ├── geographic/  # Feature de nomes geográficos
│   └── catalog3d/   # Feature de catálogo 3D
└── index.ts         # Ponto de entrada da aplicação
```