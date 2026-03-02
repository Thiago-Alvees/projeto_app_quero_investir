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

alter table public.investment_portfolios enable row level security;
alter table public.investment_portfolio_assets enable row level security;

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
```

## 4) Comportamento do app

- Sem Supabase configurado: app salva carteiras localmente.
- Com Supabase configurado: app sincroniza na nuvem e mostra carteiras publicas.
- Se a nuvem falhar temporariamente: app cai para modo local automaticamente.

## 5) Validacao rapida

No terminal:

```bash
cd fii-app
npm run validate:supabase
```

Se passar, voce vera `SUCCESS: Supabase configured and reachable.`

## 6) Exclusao definitiva de conta (Edge Function)

Para habilitar o botao `Excluir conta definitivamente` no app:

1. Instale a CLI do Supabase e faca login.
2. No terminal, entre na pasta do app e inicialize/link o projeto (se ainda nao estiver configurado):

```bash
cd fii-app
supabase init
supabase link --project-ref SEU_PROJECT_REF
```

3. Publique a funcao:

```bash
supabase functions deploy delete-account --project-ref SEU_PROJECT_REF
```

4. Configure o segredo da funcao:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY --project-ref SEU_PROJECT_REF
```

5. Garanta que `SUPABASE_URL` e `SUPABASE_ANON_KEY` tambem estejam disponiveis no ambiente das funcoes (normalmente ja vem por padrao no projeto hospedado).
