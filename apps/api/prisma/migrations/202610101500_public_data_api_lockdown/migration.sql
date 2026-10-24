DO $lockdown$
DECLARE
  target_table record;
  target_role text;
  target_columns text;
BEGIN
  IF current_schema() IS DISTINCT FROM 'public' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class tables
    JOIN pg_namespace namespaces ON namespaces.oid = tables.relnamespace
    WHERE namespaces.nspname = 'public' AND tables.relkind IN ('r', 'p')
      AND tables.relowner <> current_user::regrole
  ) THEN
    RAISE EXCEPTION 'Public lockdown must run as the application table owner';
  END IF;

  FOR target_table IN
    SELECT tables.oid, tables.relname FROM pg_class tables
    JOIN pg_namespace namespaces ON namespaces.oid = tables.relnamespace
    WHERE namespaces.nspname = 'public' AND tables.relkind IN ('r', 'p')
    ORDER BY tables.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table.relname);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', target_table.relname);
    SELECT string_agg(format('%I', attributes.attname), ', ' ORDER BY attributes.attnum)
      INTO target_columns FROM pg_attribute attributes
      WHERE attributes.attrelid = target_table.oid AND attributes.attnum > 0 AND NOT attributes.attisdropped;

    IF target_columns IS NOT NULL THEN
      EXECUTE format(
        'REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE public.%I FROM PUBLIC',
        target_columns, target_columns, target_columns, target_columns, target_table.relname
      );
    END IF;

    FOR target_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', target_table.relname, target_role);
      IF target_columns IS NOT NULL THEN
        EXECUTE format(
          'REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE public.%I FROM %I',
          target_columns, target_columns, target_columns, target_columns, target_table.relname, target_role
        );
      END IF;
    END LOOP;
  END LOOP;

  EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC';
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC', current_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC', current_user);

  FOR target_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I', target_role);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', current_user, target_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', current_user, target_role
    );
  END LOOP;
END
$lockdown$;
