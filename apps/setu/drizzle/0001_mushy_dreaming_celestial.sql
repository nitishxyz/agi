ALTER TABLE "router_payment_logs" ALTER COLUMN "tx_signature" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "router_payment_logs" ADD COLUMN "polar_checkout_id" text;--> statement-breakpoint
ALTER TABLE "router_payment_logs" ADD COLUMN "payment_method" text DEFAULT 'crypto' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "polar_checkout_idx" ON "router_payment_logs" USING btree ("polar_checkout_id") WHERE "router_payment_logs"."polar_checkout_id" IS NOT NULL;