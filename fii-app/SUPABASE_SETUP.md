# Supabase Setup (Free Tier)

Este projeto ja funciona sem backend (modo local).  
Para liberar carteiras publicas/privadas reais e sincronizacao entre dispositivos, use Supabase Free.

## 1) Variaveis de ambiente

Preencha no arquivo `.env`:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SEU_ANON_KEY
```

Reinicie o Metro/Expo apos alterar o `.env`.

## 2) Ative login anonimo

No painel Supabase:

1. `Authentication` -> `Providers`
2. Ative `Anonymous Sign-Ins`
3. Mantenha `Email` habilitado para permitir cadastro/login com senha no app
4. Em `Email`, revise `Confirm email`:
   - ligado: usuario precisa confirmar e-mail antes do primeiro login
   - desligado: login funciona imediatamente apos criar conta

O app usa sessao anonima por dispositivo para identificar dono da carteira.

## 3) SQL (tabelas + RLS)

Execute no `SQL Editor` do Supabase:

```sql
create extension if not exists pgcrypto;

create table if not exists public.investment_portfolios (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  visibility text not null check (visibility in ('PUBLICA', 'PRIVADA')),
  monthly_contribution numeric(14,2) not null check (monthly_contribution > 0),
  months integer not null check (months > 0),
  reinvest_dividends boolean not null default true,
  share_code text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists investment_portfolios_owner_idx
  on public.investment_portfolios(owner_id);

create index if not exists investment_portfolios_visibility_idx
  on public.investment_portfolios(visibility);

create index if not exists investment_portfolios_updated_idx
  on public.investment_portfolios(updated_at desc);

create table if not exists public.investment_portfolio_assets (
  portfolio_id text not null references public.investment_portfolios(id) on delete cascade,
  asset_class text not null check (asset_class in ('FII', 'STOCK', 'ETF')),
  ticker text not null,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (portfolio_id, asset_class, ticker)
);

create index if not exists investment_portfolio_assets_portfolio_idx
  on public.investment_portfolio_assets(portfolio_id);

create table if not exists public.user_policy_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null,
  acceptance_source text not null default 'PROFILE_CONFIRMATION'
    check (acceptance_source in ('EMAIL_SIGNUP', 'GOOGLE_SIGNUP', 'PROFILE_CONFIRMATION')),
  ip_address text,
  device_label text,
  platform text,
  app_version text,
  execution_env text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_policy_acceptances
  add column if not exists ip_address text,
  add column if not exists device_label text,
  add column if not exists platform text,
  add column if not exists app_version text,
  add column if not exists execution_env text;

create index if not exists user_policy_acceptances_version_idx
  on public.user_policy_acceptances(policy_version);

create or replace function public.set_investment_portfolios_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_investment_portfolios_updated_at on public.investment_portfolios;
create trigger trg_investment_portfolios_updated_at
before update on public.investment_portfolios
for each row
execute function public.set_investment_portfolios_updated_at();

drop trigger if exists trg_user_policy_acceptances_updated_at on public.user_policy_acceptances;
create trigger trg_user_policy_acceptances_updated_at
before update on public.user_policy_acceptances
for each row
execute function public.set_investment_portfolios_updated_at();

alter table public.investment_portfolios enable row level security;
alter table public.investment_portfolio_assets enable row level security;
alter table public.user_policy_acceptances enable row level security;

drop policy if exists "portfolio_select_own_or_public" on public.investment_portfolios;
create policy "portfolio_select_own_or_public"
on public.investment_portfolios
for select
using (
  owner_id = auth.uid()
  or visibility = 'PUBLICA'
);

drop policy if exists "portfolio_insert_own" on public.investment_portfolios;
create policy "portfolio_insert_own"
on public.investment_portfolios
for insert
with check (owner_id = auth.uid());

drop policy if exists "portfolio_update_own" on public.investment_portfolios;
create policy "portfolio_update_own"
on public.investment_portfolios
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "portfolio_delete_own" on public.investment_portfolios;
create policy "portfolio_delete_own"
on public.investment_portfolios
for delete
using (owner_id = auth.uid());

drop policy if exists "portfolio_assets_select_own_or_public" on public.investment_portfolio_assets;
create policy "portfolio_assets_select_own_or_public"
on public.investment_portfolio_assets
for select
using (
  exists (
    select 1
    from public.investment_portfolios p
    where p.id = investment_portfolio_assets.portfolio_id
      and (p.owner_id = auth.uid() or p.visibility = 'PUBLICA')
  )
);

drop policy if exists "portfolio_assets_insert_own" on public.investment_portfolio_assets;
create policy "portfolio_assets_insert_own"
on public.investment_portfolio_assets
for insert
with check (
  exists (
    select 1
    from public.investment_portfolios p
    where p.id = investment_portfolio_assets.portfolio_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "portfolio_assets_update_own" on public.investment_portfolio_assets;
create policy "portfolio_assets_update_own"
on public.investment_portfolio_assets
for update
using (
  exists (
    select 1
    from public.investment_portfolios p
    where p.id = investment_portfolio_assets.portfolio_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.investment_portfolios p
    where p.id = investment_portfolio_assets.portfolio_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "portfolio_assets_delete_own" on public.investment_portfolio_assets;
create policy "portfolio_assets_delete_own"
on public.investment_portfolio_assets
for delete
using (
  exists (
    select 1
    from public.investment_portfolios p
    where p.id = investment_portfolio_assets.portfolio_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "policy_acceptance_select_own" on public.user_policy_acceptances;
create policy "policy_acceptance_select_own"
on public.user_policy_acceptances
for select
using (user_id = auth.uid());

drop policy if exists "policy_acceptance_insert_own" on public.user_policy_acceptances;
create policy "policy_acceptance_insert_own"
on public.user_policy_acceptances
for insert
with check (user_id = auth.uid());

drop policy if exists "policy_acceptance_update_own" on public.user_policy_acceptances;
create policy "policy_acceptance_update_own"
on public.user_policy_acceptances
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

Se voce ja executou a versao anterior do setup, pode rodar apenas o bloco novo da tabela `user_policy_acceptances`, os `alter table ... add column if not exists`, o indice, o trigger e as policies acima.

## 4) Comportamento do app

- Sem Supabase configurado: app salva carteiras localmente.
- Com Supabase configurado: app sincroniza na nuvem e mostra carteiras públicas.
- Se a nuvem falhar temporariamente: app cai para modo local automaticamente.

## 5) Validacao rapida

No terminal:

```bash
cd fii-app
npm run validate:supabase
```

Se passar, voce vera `SUCCESS: Supabase configured and reachable.`

## 6) Edge Functions

O app usa duas Edge Functions:

- `delete-account`: exclusao definitiva da conta
- `register-policy-acceptance`: auditoria do aceite de termos com IP do request e contexto do dispositivo

Para habilitar essas funcoes no app:

1. Instale a CLI do Supabase e faca login.
2. No terminal, entre na pasta do app e inicialize/link o projeto (se ainda nao estiver configurado):

```bash
cd fii-app
npx supabase init
npx supabase link --project-ref SEU_PROJECT_REF
```

3. Publique as funcoes:

```bash
npx supabase functions deploy delete-account --project-ref SEU_PROJECT_REF
npx supabase functions deploy register-policy-acceptance --project-ref SEU_PROJECT_REF
```

4. Nao tente cadastrar segredos com prefixo `SUPABASE_` via CLI. Esse prefixo e reservado pela plataforma.

5. As Edge Functions hospedadas ja recebem por padrao:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_URL`

6. Se o deploy reclamar que o `entrypoint path does not exist`, significa que faltou inicializar o projeto local com `npx supabase init` dentro de `fii-app`, para criar `supabase/config.toml`.

## 7) Login social (Google)

Para habilitar `Continuar com Google`:

1. No Supabase, abra `Authentication` -> `Providers`.
2. Ative `Google`.
3. Cadastre `Client ID` e `Client Secret` do Google.
4. Em `Authentication` -> `URL Configuration`:
   - Em `Site URL`, use sua URL base do projeto (ex.: `https://SEU-PROJETO.supabase.co`).
   - Em `Redirect URLs`, adicione:
     - `queroinvestir://auth/callback`
     - a URL exibida pelo app em caso de erro de redirect (o app mostra algo como `exp://.../--/auth/callback` durante desenvolvimento no Expo Go).
5. Reinicie o app apos salvar.

Observacao: em desenvolvimento com Expo Go, a redirect URL pode mudar conforme host/porta. Se o login social falhar com erro de redirect, copie a URL mostrada na mensagem e adicione no Supabase.

## 8) Recuperacao de senha no app

Para o fluxo de redefinicao abrir direto no aplicativo, confirme que as redirect URLs do projeto incluem:

- `queroinvestir://auth/reset-password`
- `queroinvestir://auth/callback`

Em desenvolvimento com Expo Go, o app tambem pode gerar uma URL `exp://.../--/auth/reset-password`. Se a recuperacao falhar com erro de redirect, abra a mensagem mostrada no app/CLI e adicione a URL exata nas configuracoes de redirect do Supabase.
