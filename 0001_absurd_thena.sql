CREATE TABLE `exam_attempts` (
	`id` varchar(36) NOT NULL,
	`studentName` varchar(120) NOT NULL,
	`className` varchar(40) NOT NULL,
	`examId` int NOT NULL,
	`status` enum('started','submitted') NOT NULL DEFAULT 'started',
	`startedAt` timestamp NOT NULL,
	`submittedAt` timestamp,
	`durationSeconds` int NOT NULL DEFAULT 0,
	`answers` text,
	`score` decimal(5,2),
	`rawScore` decimal(6,2),
	`maxScore` decimal(6,2),
	`sectionIScore` decimal(6,2),
	`sectionIIScore` decimal(6,2),
	`sectionIIIScore` decimal(6,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exam_attempts_id` PRIMARY KEY(`id`)
);
