ALTER TABLE `exam_attempts` ADD `googleSheetsSyncStatus` enum('not_requested','pending','synced','error') DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `googleSheetsSyncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `googleSheetsSyncAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `googleSheetsSyncError` text;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `googleSheetsRetryAt` timestamp;