-- 047_financial_management.sql
-- Personal finance profiles, categories, and transactions.

CREATE TABLE IF NOT EXISTS public.financial_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_currency TEXT NOT NULL DEFAULT 'BRL'
    CHECK (default_currency IN ('BRL', 'USD', 'EUR', 'GBP', 'ARS', 'MXN')),
  monthly_income_target NUMERIC(14,2),
  monthly_investment_target NUMERIC(14,2),
  emergency_reserve_target NUMERIC(14,2),
  main_financial_objective TEXT,
  risk_profile TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'investment', 'transfer')),
  slug TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug, kind),
  UNIQUE (slug, kind, is_system)
);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'investment', 'transfer')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('BRL', 'USD', 'EUR', 'GBP', 'ARS', 'MXN')),
  converted_amount NUMERIC(14,2),
  converted_currency TEXT CHECK (converted_currency IN ('BRL', 'USD', 'EUR', 'GBP', 'ARS', 'MXN')),
  exchange_rate NUMERIC(18,8),
  occurred_on DATE NOT NULL,
  category_id UUID REFERENCES public.financial_categories(id),
  category_name TEXT NOT NULL DEFAULT 'outros',
  merchant TEXT,
  description TEXT,
  payment_method TEXT,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'balys', 'whatsapp', 'api', 'import')),
  raw_text TEXT,
  confidence NUMERIC(4,3),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'needs_review', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_date
  ON public.financial_transactions (user_id, occurred_on DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_status
  ON public.financial_transactions (user_id, status);

INSERT INTO public.financial_categories (name, kind, slug, is_system)
VALUES
  ('alimentação', 'expense', 'alimentacao', true),
  ('mercado', 'expense', 'mercado', true),
  ('transporte', 'expense', 'transporte', true),
  ('moradia', 'expense', 'moradia', true),
  ('saúde', 'expense', 'saude', true),
  ('educação', 'expense', 'educacao', true),
  ('lazer', 'expense', 'lazer', true),
  ('assinaturas', 'expense', 'assinaturas', true),
  ('impostos', 'expense', 'impostos', true),
  ('família', 'expense', 'familia', true),
  ('trabalho', 'expense', 'trabalho', true),
  ('viagens', 'expense', 'viagens', true),
  ('dívidas', 'expense', 'dividas', true),
  ('outros', 'expense', 'outros-despesa', true),
  ('salário', 'income', 'salario', true),
  ('freelance', 'income', 'freelance', true),
  ('venda', 'income', 'venda', true),
  ('rendimento', 'income', 'rendimento', true),
  ('outros', 'income', 'outros-receita', true),
  ('reserva', 'investment', 'reserva', true),
  ('renda fixa', 'investment', 'renda-fixa', true),
  ('renda variável', 'investment', 'renda-variavel', true),
  ('previdência', 'investment', 'previdencia', true),
  ('cripto', 'investment', 'cripto', true),
  ('outros', 'investment', 'outros-investimento', true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.financial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_profiles_owner_all ON public.financial_profiles;
CREATE POLICY financial_profiles_owner_all
  ON public.financial_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS financial_categories_owner_or_system_read ON public.financial_categories;
CREATE POLICY financial_categories_owner_or_system_read
  ON public.financial_categories
  FOR SELECT
  USING (auth.uid() = user_id OR is_system = true);

DROP POLICY IF EXISTS financial_categories_owner_write ON public.financial_categories;
CREATE POLICY financial_categories_owner_write
  ON public.financial_categories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS financial_transactions_owner_all ON public.financial_transactions;
CREATE POLICY financial_transactions_owner_all
  ON public.financial_transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
