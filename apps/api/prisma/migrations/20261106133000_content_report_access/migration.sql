-- Existing installations may not have Supabase's automatic-RLS event trigger.
-- Keep the private reporting table protected when upgrading those databases.
DO $report_lockdown$
DECLARE
  target_role text;
  target_columns text;
BEGIN
  IF current_schema() IS DISTINCT FROM 'public' THEN
    RETURN;
  END IF;

  ALTER TABLE public."ContentReport" ENABLE ROW LEVEL SECURITY;

  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum)
    INTO target_columns
    FROM pg_attribute
    WHERE attrelid = 'public."ContentReport"'::regclass
      AND attnum > 0 AND NOT attisdropped;

  FOR target_role IN
    SELECT 'PUBLIC'
    UNION ALL
    SELECT quote_ident(rolname) FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."ContentReport" FROM %s', target_role);
    EXECUTE format(
      'REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE public."ContentReport" FROM %s',
      target_columns, target_columns, target_columns, target_columns, target_role
    );
  END LOOP;
END
$report_lockdown$;
