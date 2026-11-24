# Master JF Soluções Digitais — Painel Web

Interface web leve integrada à API Paperclip para gerenciamento de conversas com agentes, tarefas e aprovações.

## 🚀 Tecnologias

- **React 18** + **TypeScript**
- **Vite** para build e desenvolvimento
- **Design System** próprio baseado no DESIGN.md (WCAG 2.2 AA)
- **Lucide React** para ícones
- **Vitest** + **Testing Library** para testes

## 📋 Funcionalidades

- **Sidebar** com 16 agentes da Master JF
- **Conversas por agente** com histórico separado por assunto
- **Envio de mensagens** com retry idempotente (clientRequestId)
- **Delegação de tarefas** — visualização filtrada por `assigneeAgentId`
- **Botão "Novo Assunto"** para sessão limpa (`/new`)
- **Cards de aprovação/confirmação** funcionais
- **Visão mínima de tarefas**: título, status e agente
- **Erros de API visíveis**, nunca silenciosos

## 🔧 Pré-requisitos

- Node.js 20+
- Paperclip rodando localmente (API disponível em `/api`)
- Sessão ativa no Paperclip (board bootstrap)

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Typecheck
npm run typecheck

# Lint
npm run lint

# Testes
npm run test

# Testes em modo watch
npm run test:watch
```

## 🌐 Variáveis de Ambiente

Crie um arquivo `.env.local` (opcional):

```env
# URL base da API Paperclip (padrão: /api)
VITE_API_BASE=/api

# Porta do servidor de desenvolvimento (padrão: 5173)
VITE_PORT=5173
```

## 🏗️ Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── Sidebar.tsx     # Sidebar com lista de agentes
│   ├── ChatView.tsx    # Visualização de conversa por agente
│   ├── TaskView.tsx    # Visualização de tarefas (issues)
│   └── ApprovalView.tsx # Visualização de aprovações
├── hooks/              # Custom hooks
│   ├── useSession.ts   # Hook para sessão e agentes
│   └── useChat.ts      # Hooks para chat, tarefas, aprovações
├── lib/                # Utilitários e cliente API
│   ├── api.ts          # Cliente API Paperclip
│   └── utils.ts        # Funções utilitárias
├── context/            # React Context
│   └── ToastContext.tsx # Sistema de notificações toast
├── styles/             # Estilos CSS (Design System)
│   ├── tokens.css      # Tokens de design (cores, espaçamento, etc.)
│   ├── global.css      # Estilos globais
│   └── components.css  # Estilos de componentes
├── types/              # Tipos TypeScript
│   └── api.ts          # Tipos da API Paperclip
├── test/               # Configuração de testes
└── App.tsx             # Componente principal
```

## 🔌 Integração com API Paperclip

O painel consome os seguintes endpoints da API Paperclip:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/auth/get-session` | GET | Obtém sessão do board (company, user, agents) |
| `/api/companies/{companyId}/agents` | GET | Lista agentes da empresa |
| `/api/companies/{companyId}/chats/{agentRef}` | GET/POST | Abre/retoma conversa por agente |
| `/api/issues/{id}/comments` | POST | Envia mensagem com `clientRequestId` |
| `/api/companies/{companyId}/issues` | GET | Lista issues/tarefas |
| `/api/companies/{companyId}/approvals` | GET/POST | Gerencia aprovações |

### Autenticação

- **Reutiliza sessão do board** — não cria login separado
- **Sem tokens embutidos** — usa cookies de sessão (`credentials: 'include'`)
- **Board bootstrap** — agentes e company vêm do `/auth/get-session`

### Idempotência

Mensagens usam `clientRequestId` gerado automaticamente (`timestamp-random`) para retry seguro:

```typescript
const clientRequestId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
```

## ♿ Acessibilidade (WCAG 2.2 AA)

- Contraste mínimo 4.5:1 (texto) / 3:1 (UI)
- Touch targets ≥ 44×44px
- Focus visible com anel 2px + offset 2px (brand primary)
- Semântica HTML correta + ARIA quando necessário
- Respeita `prefers-reduced-motion`
- Ordem de foco lógica

## 🎨 Design System

Tokens definidos em `src/styles/tokens.css` baseados no DESIGN.md:

- **Cores**: Neutros, Brand (violet/amber), Status (success/warning/error/info)
- **Tipografia**: Inter, escala fluida com `clamp()`
- **Espaçamento**: Base 4px (space-1 a space-12)
- **Bordas/Raios**: 4px a 16px + full
- **Sombras**: 4 níveis (sm a xl)
- **Transições**: 120ms a 300ms
- **Breakpoints**: 320px a 1536px
- **Z-index**: Scale consistente

## 🧪 Testes

```bash
# Executar todos os testes
npm run test

# Com coverage
npm run test -- --coverage

# Watch mode
npm run test:watch
```

Testes incluem:
- Utilitários (`utils.test.ts`)
- Componentes (`Sidebar.test.tsx`, `ChatView.test.tsx`)
- Hooks (planejado)

## 📱 Responsividade

- **Desktop (≥1024px)**: Sidebar fixa 280px
- **Tablet (768-1023px)**: Sidebar colapsável + drawer
- **Mobile (<768px)**: Drawer off-canvas + bottom nav

## 🚨 Tratamento de Erros

- **Erros de API** → Toast de erro + inline error na UI
- **Loading states** → Skeletons + spinners acessíveis
- **Empty states** → Ilustração + texto orientativo + CTA
- **Retry** → Botão "Tentar novamente" em todos os erros
- **Nunca silencioso** — todo erro é visível ao usuário

## 📝 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `dev` | Servidor de desenvolvimento (HMR) |
| `build` | Build de produção (typecheck + vite build) |
| `preview` | Preview do build de produção |
| `typecheck` | TypeScript sem emissão (`tsc --noEmit`) |
| `lint` | ESLint com regras React/TypeScript |
| `test` | Vitest run once |
| `test:watch` | Vitest watch mode |

## 🔒 Segurança

- **Nenhum segredo/token no código**
- **Credenciais via cookies** (HttpOnly, Secure, SameSite)
- **CSP compatível** — sem `eval` ou inline scripts
- **Sanitização** — React escapa automaticamente

## 🐳 Deploy em container

O build é gerado dentro da imagem e servido pelo nginx. O nginx também faz proxy
de `/api` para o Paperclip na porta `3100` do host, para que o painel reutilize a
sessão do board sem token embutido e sem segundo login.

```bash
docker build -t painel-master-jf:latest .
docker run -d --name painel-master-jf \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 5174:80 \
  painel-master-jf:latest
```

Acesso: `http://<host>:5174/`

Antes de usar, entre no board do Paperclip em `http://<host>:3100/` para criar a
sessão. `Host` e `Origin` são preservados no proxy porque o guard de mutações do
board exige origem confiável.

## 📄 Licença

Proprietário — Master JF Soluções Digitais