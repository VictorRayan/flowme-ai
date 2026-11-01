DROP POLICY IF EXISTS "Users can view their own note mentions" ON public.note_mentions;
DROP POLICY IF EXISTS "Users can insert their own note mentions" ON public.note_mentions;
DROP POLICY IF EXISTS "Users can delete their own note mentions" ON public.note_mentions;
DROP POLICY IF EXISTS note_mentions_owner_read ON public.note_mentions;
DROP POLICY IF EXISTS note_mentions_owner_insert ON public.note_mentions;
DROP POLICY IF EXISTS note_mentions_owner_delete ON public.note_mentions;

CREATE POLICY note_mentions_owner_read ON public.note_mentions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_mentions.note_id AND n.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = note_mentions.person_id AND p.user_id = (SELECT auth.uid()))
  );

CREATE POLICY note_mentions_owner_insert ON public.note_mentions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_mentions.note_id AND n.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = note_mentions.person_id AND p.user_id = (SELECT auth.uid()))
  );

CREATE POLICY note_mentions_owner_delete ON public.note_mentions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_mentions.note_id AND n.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = note_mentions.person_id AND p.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view their own document links" ON public.document_links;
DROP POLICY IF EXISTS "Users can insert their own document links" ON public.document_links;
DROP POLICY IF EXISTS "Users can delete their own document links" ON public.document_links;
DROP POLICY IF EXISTS document_links_owner_read ON public.document_links;
DROP POLICY IF EXISTS document_links_owner_insert ON public.document_links;
DROP POLICY IF EXISTS document_links_owner_delete ON public.document_links;

CREATE POLICY document_links_owner_read ON public.document_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = (SELECT auth.uid()))
  );

CREATE POLICY document_links_owner_insert ON public.document_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = (SELECT auth.uid()))
  );

CREATE POLICY document_links_owner_delete ON public.document_links
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view their own action plan goal links" ON public.action_plan_goal_links;
DROP POLICY IF EXISTS "Users can insert their own action plan goal links" ON public.action_plan_goal_links;
DROP POLICY IF EXISTS "Users can update their own action plan goal links" ON public.action_plan_goal_links;
DROP POLICY IF EXISTS "Users can delete their own action plan goal links" ON public.action_plan_goal_links;
DROP POLICY IF EXISTS action_plan_goal_links_owner_read ON public.action_plan_goal_links;
DROP POLICY IF EXISTS action_plan_goal_links_owner_insert ON public.action_plan_goal_links;
DROP POLICY IF EXISTS action_plan_goal_links_owner_update ON public.action_plan_goal_links;
DROP POLICY IF EXISTS action_plan_goal_links_owner_delete ON public.action_plan_goal_links;

CREATE POLICY action_plan_goal_links_owner_read ON public.action_plan_goal_links
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_goal_links.action_plan_id AND p.user_id = action_plan_goal_links.user_id)
    AND EXISTS (SELECT 1 FROM public.smart_goals g WHERE g.id = action_plan_goal_links.goal_id AND g.user_id = action_plan_goal_links.user_id)
  );

CREATE POLICY action_plan_goal_links_owner_insert ON public.action_plan_goal_links
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_goal_links.action_plan_id AND p.user_id = action_plan_goal_links.user_id)
    AND EXISTS (SELECT 1 FROM public.smart_goals g WHERE g.id = action_plan_goal_links.goal_id AND g.user_id = action_plan_goal_links.user_id)
  );

CREATE POLICY action_plan_goal_links_owner_update ON public.action_plan_goal_links
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_goal_links.action_plan_id AND p.user_id = action_plan_goal_links.user_id)
    AND EXISTS (SELECT 1 FROM public.smart_goals g WHERE g.id = action_plan_goal_links.goal_id AND g.user_id = action_plan_goal_links.user_id)
  );

CREATE POLICY action_plan_goal_links_owner_delete ON public.action_plan_goal_links
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
