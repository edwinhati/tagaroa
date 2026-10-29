CREATE SCHEMA "access_control";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "directory";
--> statement-breakpoint
CREATE SCHEMA "hr";
--> statement-breakpoint
CREATE SCHEMA "notification";
--> statement-breakpoint
CREATE SCHEMA "identity_operations";
--> statement-breakpoint
CREATE TABLE "directory"."auth_audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"target_user_id" text,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_control"."access_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"team_id" text,
	"scope_key" text NOT NULL,
	"expires_at" timestamp,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"granted_by" text,
	"revoked_at" timestamp,
	"revoked_by" text
);
--> statement-breakpoint
CREATE TABLE "access_control"."access_review" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"snapshot" text NOT NULL,
	"decision" text NOT NULL,
	"note" text NOT NULL,
	"reviewed_at" timestamp NOT NULL,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE TABLE "access_control"."access_role" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "access_control"."access_role_permission" (
	"role_id" text NOT NULL,
	"permission" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_control"."break_glass_elevation" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"user_id" text NOT NULL,
	"permission" text NOT NULL,
	"organization_id" text NOT NULL,
	"team_id" text,
	"scope_key" text NOT NULL,
	"reason" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "access_control"."team_domain" (
	"team_id" text PRIMARY KEY NOT NULL,
	"domain_slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"team_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth"."passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "auth"."rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	"active_team_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "auth"."team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"membership_key" text,
	"created_at" timestamp,
	CONSTRAINT "team_member_membership_key_unique" UNIQUE("membership_key")
);
--> statement-breakpoint
CREATE TABLE "auth"."two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"two_factor_enabled" boolean DEFAULT false,
	"must_change_password" boolean DEFAULT false,
	"temporary_password_expires_at" timestamp,
	"personal_email" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory"."person_position" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"scope_key" text NOT NULL,
	"title" text NOT NULL,
	"manager_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "directory"."privileged_access_review" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_account" (
	"employee" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_account_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notification"."message" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"channel" text NOT NULL,
	"locale" text NOT NULL,
	"destination" text NOT NULL,
	"template_id" text,
	"payload" jsonb NOT NULL,
	"secrets" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"provider_id" text,
	"error" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification"."suppression" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification"."template" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"channel" text NOT NULL,
	"locale" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secrets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "identity_operations"."factor_recovery" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"requested_by" text,
	"requested_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"reason" text NOT NULL,
	"evidence" text NOT NULL,
	"snapshot" text NOT NULL,
	"completed_at" timestamp,
	"approved_by" text,
	"approval_evidence" text
);
--> statement-breakpoint
ALTER TABLE "directory"."auth_audit_event" ADD CONSTRAINT "auth_audit_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory"."auth_audit_event" ADD CONSTRAINT "auth_audit_event_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_assignment" ADD CONSTRAINT "access_assignment_role_id_access_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "access_control"."access_role"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_assignment" ADD CONSTRAINT "access_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_assignment" ADD CONSTRAINT "access_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_assignment" ADD CONSTRAINT "access_assignment_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "auth"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_assignment" ADD CONSTRAINT "access_assignment_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_assignment" ADD CONSTRAINT "access_assignment_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_review" ADD CONSTRAINT "access_review_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_role" ADD CONSTRAINT "access_role_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_role" ADD CONSTRAINT "access_role_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."access_role_permission" ADD CONSTRAINT "access_role_permission_role_id_access_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "access_control"."access_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."break_glass_elevation" ADD CONSTRAINT "break_glass_elevation_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."break_glass_elevation" ADD CONSTRAINT "break_glass_elevation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."break_glass_elevation" ADD CONSTRAINT "break_glass_elevation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."break_glass_elevation" ADD CONSTRAINT "break_glass_elevation_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "auth"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control"."team_domain" ADD CONSTRAINT "team_domain_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "auth"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "auth"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory"."person_position" ADD CONSTRAINT "person_position_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory"."person_position" ADD CONSTRAINT "person_position_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory"."person_position" ADD CONSTRAINT "person_position_manager_user_id_user_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory"."person_position" ADD CONSTRAINT "person_position_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory"."person_position" ADD CONSTRAINT "person_position_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory"."privileged_access_review" ADD CONSTRAINT "privileged_access_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory"."privileged_access_review" ADD CONSTRAINT "privileged_access_review_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_account" ADD CONSTRAINT "employee_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification"."message" ADD CONSTRAINT "message_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "notification"."template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification"."template" ADD CONSTRAINT "template_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_operations"."factor_recovery" ADD CONSTRAINT "factor_recovery_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_operations"."factor_recovery" ADD CONSTRAINT "factor_recovery_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_operations"."factor_recovery" ADD CONSTRAINT "factor_recovery_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authAuditEvent_createdAt_idx" ON "directory"."auth_audit_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "authAuditEvent_actorId_idx" ON "directory"."auth_audit_event" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "authAuditEvent_targetUserId_idx" ON "directory"."auth_audit_event" USING btree ("target_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accessAssignment_active_uidx" ON "access_control"."access_assignment" USING btree ("user_id","role_id","scope_key") WHERE "access_control"."access_assignment"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "accessAssignment_userId_idx" ON "access_control"."access_assignment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accessAssignment_roleId_idx" ON "access_control"."access_assignment" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "accessAssignment_organizationId_idx" ON "access_control"."access_assignment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "accessAssignment_teamId_idx" ON "access_control"."access_assignment" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "accessReview_subject_idx" ON "access_control"."access_review" USING btree ("kind","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accessRole_key_uidx" ON "access_control"."access_role" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "accessRole_name_uidx" ON "access_control"."access_role" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "accessRole_archivedAt_idx" ON "access_control"."access_role" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accessRolePermission_role_permission_uidx" ON "access_control"."access_role_permission" USING btree ("role_id","permission");--> statement-breakpoint
CREATE INDEX "accessRolePermission_permission_idx" ON "access_control"."access_role_permission" USING btree ("permission");--> statement-breakpoint
CREATE INDEX "breakGlassElevation_sessionId_idx" ON "access_control"."break_glass_elevation" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "breakGlassElevation_expiresAt_idx" ON "access_control"."break_glass_elevation" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "auth"."invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "auth"."invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "auth"."member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "auth"."member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "auth"."passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "auth"."passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_organizationId_idx" ON "auth"."team" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "teamMember_teamId_idx" ON "auth"."team_member" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "teamMember_userId_idx" ON "auth"."team_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "auth"."two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "auth"."two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "personPosition_user_scope_uidx" ON "directory"."person_position" USING btree ("user_id","scope_key");--> statement-breakpoint
CREATE INDEX "personPosition_organizationId_idx" ON "directory"."person_position" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "personPosition_managerUserId_idx" ON "directory"."person_position" USING btree ("manager_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "privilegedAccessReview_userId_idx" ON "directory"."privileged_access_review" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "privilegedAccessReview_reviewedAt_idx" ON "directory"."privileged_access_review" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "notificationMessage_due_idx" ON "notification"."message" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notificationMessage_providerId_idx" ON "notification"."message" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "notificationMessage_destination_idx" ON "notification"."message" USING btree ("channel","destination");--> statement-breakpoint
CREATE UNIQUE INDEX "notificationMessage_idempotency_idx" ON "notification"."message" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "notificationSuppression_destination_idx" ON "notification"."suppression" USING btree ("channel","destination");--> statement-breakpoint
CREATE UNIQUE INDEX "notificationTemplate_version_idx" ON "notification"."template" USING btree ("key","channel","locale","version");--> statement-breakpoint
CREATE UNIQUE INDEX "notificationTemplate_published_idx" ON "notification"."template" USING btree ("key","channel","locale") WHERE "notification"."template"."status" = 'published';--> statement-breakpoint
CREATE INDEX "factorRecovery_userId_idx" ON "identity_operations"."factor_recovery" USING btree ("user_id");
--> statement-breakpoint
-- The two messages the door already needs, so that issuing an account works on
-- a fresh database. Wording is edited in apps/admin afterwards: publishing an
-- edit archives these rows rather than replacing them, so the log still shows
-- what was sent before the change.
--
-- `password` is declared secret: rendering leaves it standing as `{{password}}`
-- in `notification.message.payload` and puts the value in `message.secrets`,
-- which is cleared once the message is sent, suppressed or finally failed.
INSERT INTO "notification"."template"
  ("id", "key", "channel", "locale", "version", "status", "subject", "body", "variables", "secrets")
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'account.issued',
    'email',
    'en',
    1,
    'published',
    'Your Tagaroa account',
    E'{{name}},\n\nAn account has been created for you.\n\nAddress: {{email}}\nTemporary password: {{password}}\n\nYou will be asked to replace that password the first time you sign in.',
    '["name","email","password"]'::jsonb,
    '["password"]'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'account.password-reset',
    'email',
    'en',
    1,
    'published',
    'Your Tagaroa password was reset',
    E'{{name}},\n\nAn administrator has issued you a new temporary password.\n\nAddress: {{email}}\nTemporary password: {{password}}\n\nYou will be asked to replace it the next time you sign in.',
    '["name","email","password"]'::jsonb,
    '["password"]'::jsonb
  )
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "access_control"."access_role" (
	"id",
	"key",
	"name",
	"description",
	"system"
) VALUES (
	'system-domain-administrator',
	'domain-administrator',
	'Domain administrator',
	'Changes configuration for assigned domains.',
	true
);
--> statement-breakpoint
INSERT INTO "access_control"."access_role_permission" ("role_id", "permission")
VALUES ('system-domain-administrator', 'domain:administer');
--> statement-breakpoint
-- Membership deletion and business revocation must commit together, including retries and crashes.
CREATE FUNCTION access_control.revoke_departed_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'team_member' THEN
    UPDATE access_control.access_assignment SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = OLD.user_id AND team_id = OLD.team_id AND revoked_at IS NULL;
    UPDATE access_control.break_glass_elevation SET ended_at = CURRENT_TIMESTAMP
      WHERE user_id = OLD.user_id AND team_id = OLD.team_id AND ended_at IS NULL;
  ELSE
    UPDATE access_control.access_assignment SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = OLD.user_id AND organization_id = OLD.organization_id AND revoked_at IS NULL;
    UPDATE access_control.break_glass_elevation SET ended_at = CURRENT_TIMESTAMP
      WHERE user_id = OLD.user_id AND organization_id = OLD.organization_id AND ended_at IS NULL;
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER revoke_departed_team_access AFTER DELETE ON auth.team_member
FOR EACH ROW EXECUTE FUNCTION access_control.revoke_departed_membership();
--> statement-breakpoint
CREATE TRIGGER revoke_departed_subsidiary_access AFTER DELETE ON auth.member
FOR EACH ROW EXECUTE FUNCTION access_control.revoke_departed_membership();

--> statement-breakpoint
CREATE FUNCTION access_control.revoke_suspended_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.banned IS TRUE AND OLD.banned IS DISTINCT FROM TRUE THEN
    UPDATE access_control.access_assignment SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = NEW.id AND revoked_at IS NULL;
    UPDATE access_control.break_glass_elevation SET ended_at = CURRENT_TIMESTAMP
      WHERE user_id = NEW.id AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER revoke_suspended_business_access AFTER UPDATE OF banned ON auth."user"
FOR EACH ROW EXECUTE FUNCTION access_control.revoke_suspended_access();
