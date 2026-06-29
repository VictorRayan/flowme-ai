-- Fictional Flow Me product workspace. No real customer, employee or household data.
-- Create demo@example.com in Supabase Auth, then run this seed in the SQL Editor.
-- Amounts are invented examples for the finance and planning screens.
BEGIN;
DO $$
DECLARE
  demo_user UUID;
  demo_checklist UUID;
BEGIN
  SELECT id INTO demo_user FROM auth.users WHERE lower(email) = 'demo@example.com' LIMIT 1;
  IF demo_user IS NULL THEN
    RAISE EXCEPTION 'Create demo@example.com in Supabase Auth before loading the demo seed';
  END IF;

  DELETE FROM public.financial_transactions WHERE user_id = demo_user AND raw_text LIKE 'flowme_demo:%';
  DELETE FROM public.note_mentions WHERE note_id IN (SELECT id FROM public.notes WHERE user_id = demo_user AND content_text LIKE '%#flowme_demo%');
  DELETE FROM public.notes WHERE user_id = demo_user AND content_text LIKE '%#flowme_demo%';
  DELETE FROM public.checklist_items WHERE user_id = demo_user AND checklist_id IN (SELECT id FROM public.checklists WHERE user_id = demo_user AND name = 'Demo launch checklist');
  DELETE FROM public.checklists WHERE user_id = demo_user AND name = 'Demo launch checklist';
  DELETE FROM public.smart_goals WHERE user_id = demo_user AND description LIKE '%#flowme_demo%';

  INSERT INTO public.financial_profiles
    (user_id, default_currency, monthly_income_target, monthly_investment_target,
     emergency_reserve_target, main_financial_objective, risk_profile)
  VALUES (demo_user, 'BRL', 9200, 1200, 18000,
    'Plan a fictional product studio budget and monitor recurring software costs.', 'moderado')
  ON CONFLICT (user_id) DO UPDATE SET
    monthly_income_target = EXCLUDED.monthly_income_target,
    monthly_investment_target = EXCLUDED.monthly_investment_target,
    emergency_reserve_target = EXCLUDED.emergency_reserve_target,
    main_financial_objective = EXCLUDED.main_financial_objective,
    risk_profile = EXCLUDED.risk_profile,
    updated_at = NOW();

  INSERT INTO public.financial_transactions
    (user_id, type, amount, currency, occurred_on, category_name, merchant,
     description, payment_method, source, raw_text, confidence, status)
  VALUES
    (demo_user, 'income', 9200, 'BRL', CURRENT_DATE - 20, 'fictional salary', 'Example Product Studio',
     'Illustrative monthly pay for a fictional product manager', 'pix', 'web', 'flowme_demo:salary', 1, 'confirmed'),
    (demo_user, 'income', 1400, 'BRL', CURRENT_DATE - 12, 'project', 'Example Client',
     'Illustrative product research project fee', 'pix', 'web', 'flowme_demo:project', 1, 'confirmed'),
    (demo_user, 'expense', 189, 'BRL', CURRENT_DATE - 10, 'software', 'Example Analytics',
     'Product analytics subscription', 'credit_card', 'web', 'flowme_demo:analytics', 1, 'confirmed'),
    (demo_user, 'expense', 79, 'BRL', CURRENT_DATE - 9, 'software', 'Example Notes',
     'Duplicate team notes subscription to review', 'credit_card', 'web', 'flowme_demo:notes', 1, 'confirmed'),
    (demo_user, 'investment', 1200, 'BRL', CURRENT_DATE - 5, 'reserve', 'Example Bank',
     'Illustrative contribution to a project reserve', 'pix', 'web', 'flowme_demo:reserve', 1, 'confirmed');

  INSERT INTO public.notes (user_id, title, content, content_text, note_date, note_type)
  SELECT demo_user, title,
    jsonb_build_object('type','doc','content',jsonb_build_array(
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text', body))))),
    body, CURRENT_DATE - day_offset, 'manual'
  FROM (VALUES
    ('Launch planning', 'Prepare the fictional customer onboarding launch: review copy, check signup flow, assign owners. #flowme_demo', 0),
    ('Slack follow-up', 'A demo Slack thread requests an updated launch checklist. Verify the request before sending a reply. #flowme_demo', 1),
    ('Gmail follow-up', 'A demo email asks for a product walkthrough. Draft a response and review it before sending. #flowme_demo', 2),
    ('Budget review', 'Compare invented studio income with analytics and notes subscriptions. #flowme_demo', 3),
    ('Weekly review', 'Turn launch notes, calendar events, messages and budget signals into next actions. #flowme_demo', 4)
  ) AS examples(title, body, day_offset);

  INSERT INTO public.smart_goals
    (user_id, title, description, timeframe, status, target_date, objective_metric,
     target_value, current_value, unit, starts_on, due_on, success_criteria)
  VALUES (demo_user, 'Complete fictional onboarding launch',
    'Demo goal: finish the launch checklist and customer walkthrough. #flowme_demo',
    'monthly', 'in_progress', (CURRENT_DATE + INTERVAL '30 days')::timestamptz,
    'completed tasks', 10, 4, 'tasks', CURRENT_DATE, CURRENT_DATE + 30,
    'Review all 10 checklist items and publish the walkthrough');

  INSERT INTO public.checklists (user_id, name, status, created_by)
  VALUES (demo_user, 'Demo launch checklist', 'active', 'user')
  RETURNING id INTO demo_checklist;

  INSERT INTO public.checklist_items (checklist_id, user_id, title, checked, sort_order)
  VALUES
    (demo_checklist, demo_user, 'Review onboarding copy', true, 10),
    (demo_checklist, demo_user, 'Test signup flow', false, 20),
    (demo_checklist, demo_user, 'Prepare customer walkthrough', false, 30);
END $$;
COMMIT;
