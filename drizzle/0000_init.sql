CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step_id" uuid,
	"actor" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"steps_dag" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "process_definition_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "process_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_definition_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "process_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"definition_step_id" text NOT NULL,
	"step_index" integer NOT NULL,
	"type" text NOT NULL,
	"adapter" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"input_json" jsonb,
	"output_json" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_run_id_process_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."process_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_step_id_process_step_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."process_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_run" ADD CONSTRAINT "process_run_process_definition_id_process_definition_id_fk" FOREIGN KEY ("process_definition_id") REFERENCES "public"."process_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step" ADD CONSTRAINT "process_step_run_id_process_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."process_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_event_run_idx" ON "audit_event" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "process_run_status_idx" ON "process_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "process_step_run_idx" ON "process_step" USING btree ("run_id","step_index");