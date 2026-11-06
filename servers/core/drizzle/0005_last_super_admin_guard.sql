-- Keep one active super administrator. Better Auth's ban, set-role and
-- remove-user check the count and write without a transaction, so two at once
-- could leave none; this serialises them on the lock `retire` already takes.
-- The pattern is SUPER_ADMIN_ROLE_PATTERN (identity-operations.service.ts).
-- CREATE TRIGGER locks auth.user; fail fast rather than queue (docs/ops/migrations.md).
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
CREATE FUNCTION "auth"."keep_an_active_super_admin"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  pattern constant text := '(^|,)[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*super-admin[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*(,|$)';
BEGIN
  IF OLD."banned" IS TRUE OR coalesce(OLD."role", '') !~ pattern THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."banned" IS NOT TRUE AND coalesce(NEW."role", '') ~ pattern THEN
    RETURN NULL;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('auth.last-super-admin'));
  IF NOT EXISTS (
    SELECT 1 FROM "auth"."user"
    WHERE "id" <> OLD."id" AND "banned" IS NOT TRUE AND "role" ~ pattern
  ) THEN
    RAISE EXCEPTION 'The last active super administrator cannot be removed.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER "keep_an_active_super_admin"
  AFTER UPDATE OF "role", "banned" OR DELETE ON "auth"."user"
  FOR EACH ROW EXECUTE FUNCTION "auth"."keep_an_active_super_admin"();
