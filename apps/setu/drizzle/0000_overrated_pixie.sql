CREATE TABLE "router_users" (
	"wallet_address" text PRIMARY KEY NOT NULL,
	"balance_usd" numeric(12, 8) DEFAULT '0.00000000' NOT NULL,
	"total_spent" numeric(12, 8) DEFAULT '0.00000000' NOT NULL,
	"total_topups" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_request" timestamp
);
--> statement-breakpoint
CREATE TABLE "router_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"type" text NOT NULL,
	"amount_usd" numeric(12, 8) NOT NULL,
	"tx_signature" text,
	"provider" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"balance_before" numeric(12, 8) NOT NULL,
	"balance_after" numeric(12, 8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_payment_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"tx_signature" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "router_payment_logs_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
ALTER TABLE "router_transactions" ADD CONSTRAINT "router_transactions_wallet_address_router_users_wallet_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."router_users"("wallet_address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_payment_logs" ADD CONSTRAINT "router_payment_logs_wallet_address_router_users_wallet_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."router_users"("wallet_address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "router_tx_wallet_idx" ON "router_transactions" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "router_tx_type_idx" ON "router_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "router_tx_created_at_idx" ON "router_transactions" USING btree ("created_at");