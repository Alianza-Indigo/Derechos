CREATE TYPE "public"."ai_prompt_provider_key" AS ENUM('global', 'gemini', 'openai', 'anthropic');--> statement-breakpoint
CREATE TYPE "public"."ai_provider_key" AS ENUM('gemini', 'openai', 'anthropic');--> statement-breakpoint
CREATE TYPE "public"."ai_message_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."ai_scope" AS ENUM('general', 'caso', 'evento', 'comision', 'prevalencia', 'reporte');--> statement-breakpoint
CREATE TYPE "public"."case_priority" AS ENUM('Baja', 'Media', 'Alta', 'Urgente');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('Nuevo', 'En revision', 'Aceptado', 'En seguimiento', 'En espera de tercero', 'Resuelto', 'Cerrado sin accion', 'Archivado');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('programada', 'activa', 'pausada', 'completada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('documentado', 'pendiente', 'no_aplica');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('activa', 'suspendida', 'vencida', 'revocada');--> statement-breakpoint
CREATE TYPE "public"."location_capture_mode" AS ENUM('manual', 'commission', 'shift');--> statement-breakpoint
CREATE TYPE "public"."location_mode" AS ENUM('disabled', 'manual_check_in', 'during_commission', 'active_shift');--> statement-breakpoint
CREATE TYPE "public"."location_status" AS ENUM('disponible', 'en_comision', 'sin_senal', 'pausado', 'deshabilitado');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('pendiente', 'activo', 'suspendido', 'baja', 'fallecido');--> statement-breakpoint
CREATE TYPE "public"."territory_type" AS ENUM('country', 'state', 'city');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'pending');--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"related_case_id" text,
	"related_event_id" text,
	"field_commission_id" text,
	"prompt_template_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'activa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"ai_run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"module_scope" "ai_scope" DEFAULT 'general' NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt_template" text NOT NULL,
	"variables_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_key" "ai_prompt_provider_key" DEFAULT 'global' NOT NULL,
	"model" text,
	"temperature" numeric(3, 2) DEFAULT '0.30' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_provider_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_key" "ai_provider_key" NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"default_model" text NOT NULL,
	"encrypted_api_key_ref" text NOT NULL,
	"priority" integer DEFAULT 10 NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"prompt_template_id" text NOT NULL,
	"input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_text" text,
	"model" text NOT NULL,
	"token_usage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"action_type" text NOT NULL,
	"description" text NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"description" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_people" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"person_type" text NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"demographic_data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consent_status" "consent_status" DEFAULT 'pendiente' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"case_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"priority" "case_priority" DEFAULT 'Media' NOT NULL,
	"status" "case_status" DEFAULT 'Nuevo' NOT NULL,
	"territory_id" text NOT NULL,
	"opened_by" text NOT NULL,
	"assigned_to" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"due_date" timestamp with time zone,
	"internal_notes_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delegate_location_pings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"field_commission_id" text,
	"territory_id" text NOT NULL,
	"latitude" numeric(10, 6) NOT NULL,
	"longitude" numeric(10, 6) NOT NULL,
	"accuracy_meters" integer DEFAULT 50 NOT NULL,
	"capture_mode" "location_capture_mode" DEFAULT 'manual' NOT NULL,
	"battery_level" integer,
	"status" "location_status" DEFAULT 'disponible' NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"file_url" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"event_type" text NOT NULL,
	"date_start" timestamp with time zone NOT NULL,
	"date_end" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"territory_id" text NOT NULL,
	"organizer_id" text NOT NULL,
	"attendees_count" integer DEFAULT 0 NOT NULL,
	"institutions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impact_summary" text NOT NULL,
	"indicators" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_commissions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"commission_type" text NOT NULL,
	"description" text NOT NULL,
	"assigned_to" text NOT NULL,
	"territory_id" text NOT NULL,
	"related_case_id" text,
	"related_event_id" text,
	"status" "commission_status" DEFAULT 'programada' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_tracking_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"mode" "location_mode" DEFAULT 'manual_check_in' NOT NULL,
	"allowed_days_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_hours_json" jsonb DEFAULT '{"from":"08:00","to":"18:00"}'::jsonb NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"disabled_reason" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"qr_token" text NOT NULL,
	"public_slug" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"status" "credential_status" DEFAULT 'activa' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"member_number" text NOT NULL,
	"user_id" text,
	"full_name" text NOT NULL,
	"birth_date" timestamp with time zone,
	"gender" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"address" text NOT NULL,
	"territory_id" text NOT NULL,
	"status" "member_status" DEFAULT 'pendiente' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"logo_url" text,
	"primary_color" text DEFAULT '#0f766e' NOT NULL,
	"country" text DEFAULT 'Mexico' NOT NULL,
	"geolocation_enabled" boolean DEFAULT true NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"location_retention_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prevalence_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"study_id" text NOT NULL,
	"indicator_key" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"value_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prevalence_records" (
	"id" text PRIMARY KEY NOT NULL,
	"study_id" text NOT NULL,
	"metric_id" text NOT NULL,
	"territory_id" text NOT NULL,
	"value_numeric" numeric(12, 2),
	"value_text" text,
	"sample_size" integer,
	"source" text NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prevalence_studies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"methodology" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"filters_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "territory_type" NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"state_code" text,
	"city_name" text,
	"latitude" numeric(10, 6) NOT NULL,
	"longitude" numeric(10, 6) NOT NULL,
	"parent_id" text
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"scope_type" text DEFAULT 'global' NOT NULL,
	"scope_id" text,
	CONSTRAINT "user_roles_user_id_role_id_scope_type_pk" PRIMARY KEY("user_id","role_id","scope_type")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text,
	"provider_id" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"territory_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_related_case_id_cases_id_fk" FOREIGN KEY ("related_case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_related_event_id_events_id_fk" FOREIGN KEY ("related_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_field_commission_id_field_commissions_id_fk" FOREIGN KEY ("field_commission_id") REFERENCES "public"."field_commissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_prompt_template_id_ai_prompt_templates_id_fk" FOREIGN KEY ("prompt_template_id") REFERENCES "public"."ai_prompt_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_templates" ADD CONSTRAINT "ai_prompt_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_prompt_template_id_ai_prompt_templates_id_fk" FOREIGN KEY ("prompt_template_id") REFERENCES "public"."ai_prompt_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_actions" ADD CONSTRAINT "case_actions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_actions" ADD CONSTRAINT "case_actions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_evidence" ADD CONSTRAINT "case_evidence_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_evidence" ADD CONSTRAINT "case_evidence_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_people" ADD CONSTRAINT "case_people_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegate_location_pings" ADD CONSTRAINT "delegate_location_pings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegate_location_pings" ADD CONSTRAINT "delegate_location_pings_field_commission_id_field_commissions_id_fk" FOREIGN KEY ("field_commission_id") REFERENCES "public"."field_commissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegate_location_pings" ADD CONSTRAINT "delegate_location_pings_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_evidence" ADD CONSTRAINT "event_evidence_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_commissions" ADD CONSTRAINT "field_commissions_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_commissions" ADD CONSTRAINT "field_commissions_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_commissions" ADD CONSTRAINT "field_commissions_related_case_id_cases_id_fk" FOREIGN KEY ("related_case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_commissions" ADD CONSTRAINT "field_commissions_related_event_id_events_id_fk" FOREIGN KEY ("related_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_tracking_settings" ADD CONSTRAINT "location_tracking_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_tracking_settings" ADD CONSTRAINT "location_tracking_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_credentials" ADD CONSTRAINT "member_credentials_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevalence_metrics" ADD CONSTRAINT "prevalence_metrics_study_id_prevalence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."prevalence_studies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevalence_records" ADD CONSTRAINT "prevalence_records_study_id_prevalence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."prevalence_studies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevalence_records" ADD CONSTRAINT "prevalence_records_metric_id_prevalence_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."prevalence_metrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevalence_records" ADD CONSTRAINT "prevalence_records_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_parent_id_territories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompt_templates_key_version_idx" ON "ai_prompt_templates" USING btree ("key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_configs_provider_idx" ON "ai_provider_configs" USING btree ("provider_key");--> statement-breakpoint
CREATE UNIQUE INDEX "cases_case_number_idx" ON "cases" USING btree ("case_number");--> statement-breakpoint
CREATE UNIQUE INDEX "member_credentials_qr_token_idx" ON "member_credentials" USING btree ("qr_token");--> statement-breakpoint
CREATE UNIQUE INDEX "member_credentials_public_slug_idx" ON "member_credentials" USING btree ("public_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_number_idx" ON "members" USING btree ("member_number");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_idx" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");