CREATE INDEX "answers_user_created_idx" ON "answers" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "badge_requests_user_created_idx" ON "badge_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "experiences_user_created_idx" ON "experiences" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "experiences_topic_status_idx" ON "experiences" USING btree ("topic_id","status");--> statement-breakpoint
CREATE INDEX "questions_user_created_idx" ON "questions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_created_idx" ON "reports" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE INDEX "translations_created_idx" ON "translations" USING btree ("created_at");