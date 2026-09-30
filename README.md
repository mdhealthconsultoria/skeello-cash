# Skeello Cash

**Seu dinheiro. Sob controle.**

🔗 **App no ar:** https://mdhealthconsultoria.github.io/skeello-cash/

Aplicativo web (PWA) para controlar dinheiro a receber, dinheiro a pagar, empréstimos pessoais e contas — com login, banco de dados real e dados isolados por usuário. Qualquer pessoa pode acessar o link acima, criar a própria conta e usar — os dados de cada usuário ficam isolados por RLS no Supabase.

Todo push na branch `main` builda e publica automaticamente em GitHub Pages (veja [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Auth + Postgres + Storage) com Row Level Security
- React Router, Recharts (gráficos), jsPDF (exportação)
- PWA (instalável no celular)

## 1. Configurar o Supabase

O app **não funciona sem um projeto Supabase conectado** — sem isso, login/cadastro mostram um aviso de "Supabase não configurado".

1. Crie um projeto em [supabase.com](https://supabase.com) (ou use um já existente).
2. No painel, vá em **SQL Editor** e rode, nessa ordem, [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e [`supabase/migrations/0002_bank_integration.sql`](supabase/migrations/0002_bank_integration.sql). Isso cria todas as tabelas, a view de totais, os triggers (status automático das dívidas, criação de perfil no cadastro), as tabelas de contas bancárias conectadas, o RLS de cada tabela e o bucket de Storage `avatars`.
3. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
4. Copie `.env.example` para `.env` e preencha:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key
   ```
5. (Opcional, mas recomendado) Deploy da Edge Function que permite ao usuário excluir a própria conta de verdade (login + dados), não só os dados:
   ```
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy delete-account
   ```
   Sem isso, "Excluir minha conta" em Configurações apaga todos os dados do usuário mas não remove o login — o app avisa isso claramente na hora.
6. Em **Authentication → URL Configuration**, adicione a URL onde o app vai rodar (ex: `http://localhost:5173`, e depois a URL de produção) em *Site URL* e *Redirect URLs*, para o fluxo de "esqueci minha senha" funcionar.

## 2. Conectar bancos (Open Finance via Pluggy) — opcional

O Skeello Cash tem uma tela de **Contas bancárias** (em Configurações) que importa automaticamente contas e transações reais via [Pluggy](https://pluggy.ai), o agregador de Open Finance Brasil. Funciona com um sandbox **100% grátis** (bancos fake pra testar, sem precisar de conta bancária real nem cartão).

1. Crie uma conta grátis em [dashboard.pluggy.ai](https://dashboard.pluggy.ai).
2. No painel da Pluggy, pegue o **Client ID** e o **Client Secret** do seu app (modo sandbox já vem ativado por padrão).
3. No painel do Supabase, vá em **Edge Functions**:
   - Crie a função `pluggy-connect-token` colando o conteúdo de [`supabase/functions/pluggy-connect-token/index.ts`](supabase/functions/pluggy-connect-token/index.ts)
   - Crie a função `pluggy-sync` colando o conteúdo de [`supabase/functions/pluggy-sync/index.ts`](supabase/functions/pluggy-sync/index.ts)
   - (Se preferir CLI: `supabase functions deploy pluggy-connect-token` e `supabase functions deploy pluggy-sync`, depois de `supabase login` e `supabase link`.)
4. Em **Project Settings → Edge Functions → Secrets** (ou `supabase secrets set`), adicione:
   ```
   PLUGGY_CLIENT_ID=seu-client-id
   PLUGGY_CLIENT_SECRET=seu-client-secret
   ```
5. Pronto. No app, vá em **Configurações → Contas bancárias → Conectar banco** — o widget vai listar bancos de teste (sandbox) pra você conectar sem risco.

Sem esses secrets configurados, a tela de Contas bancárias mostra um aviso claro em vez de travar ou fingir que funcionou.

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

## 4. Build de produção

```bash
npm run build
npm run preview
```

## 5. Publicar no GitHub

```bash
git init
git add .
git commit -m "Skeello Cash — MVP inicial"
git branch -M main
git remote add origin <url-do-seu-repo>
git push -u origin main
```

Depois é só conectar o repositório a Vercel/Netlify/Cloudflare Pages (ou GitHub Pages), configurando as mesmas variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel de deploy.

## Estrutura

```
src/
  components/       componentes reutilizáveis (layout, ui, pessoas, dívidas, ilustrações do mascote)
  contexts/         AuthContext (sessão/perfil) e ThemeContext (dark mode)
  hooks/            acesso a dados: usePeople, useDebts, useCategories, useDashboard, useBankConnections
  lib/              cliente Supabase, formatação, exportação CSV/PDF
  pages/            uma página por rota
  types/            tipos das tabelas do banco
supabase/
  migrations/0001_init.sql        schema principal: pessoas, dívidas, pagamentos + RLS + triggers
  migrations/0002_bank_integration.sql   tabelas de contas bancárias conectadas (Pluggy) + RLS
  functions/delete-account        Edge Function para exclusão real de conta
  functions/pluggy-connect-token  Edge Function que gera o token do widget Pluggy Connect
  functions/pluggy-sync           Edge Function que importa contas/transações da Pluggy
```

## O que está implementado

- Autenticação completa (cadastro com foto opcional, login, mostrar/ocultar senha, esqueci senha, sessão persistente, logout)
- Banco real no Supabase com RLS — cada usuário só acessa seus próprios dados
- Pessoas: CRUD completo, foto (upload/troca/remoção), arquivar/restaurar, exclusão com confirmação
- Dívidas a receber e a pagar: cadastro completo (valor, vencimento, categoria, parcelas, forma combinada, observações)
- Pagamentos parciais e totais, com status automático (pendente, parcial, pago, atrasado, cancelado) via trigger no banco
- Integração bancária opcional via Pluggy (Open Finance): conecta bancos reais/sandbox e importa contas e transações
- Dashboard com totais animados, saldo líquido, recebido/pago no mês, próximos vencimentos e insights automáticos
- Mascote animado (ilustração própria) nos estados vazios e tela inicial, confete ao quitar uma dívida
- Histórico com filtros (tipo, status) e busca
- Busca global (pessoas, valores, descrições, categorias)
- Análises com gráficos (a receber vs. a pagar, recebido/pago por mês, evolução do saldo, categorias)
- Categorias padrão + personalizadas
- Modo claro/escuro com preferência salva
- Exportação de dados em CSV e PDF
- Exclusão de pessoa/movimentação e exclusão de conta (com confirmação forte)
- PWA instalável, navegação mobile (bottom nav + FAB) e sidebar no desktop

## O que fica para você configurar/ajustar

- Ícones reais do PWA (`public/pwa-192x192.png`, `public/pwa-512x512.png`) — hoje o manifest referencia esses arquivos, mas eles precisam ser gerados a partir da sua marca.
- Deploy da Edge Function `delete-account` (passo 5 acima), para a exclusão de conta remover também o login, não só os dados.
- Templates de e-mail do Supabase (confirmação de cadastro, redefinição de senha) — por padrão usam o template genérico do Supabase.
