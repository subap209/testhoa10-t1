import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Shared, persisted attempts for the student quiz website. */
export const examAttempts = mysqlTable("exam_attempts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  studentName: varchar("studentName", { length: 120 }).notNull(),
  className: varchar("className", { length: 40 }).notNull(),
  examId: int("examId").notNull(),
  status: mysqlEnum("status", ["started", "submitted"]).default("started").notNull(),
  startedAt: timestamp("startedAt").notNull(),
  submittedAt: timestamp("submittedAt"),
  durationSeconds: int("durationSeconds").default(0).notNull(),
  answers: text("answers"),
  score: decimal("score", { precision: 5, scale: 2 }),
  rawScore: decimal("rawScore", { precision: 6, scale: 2 }),
  maxScore: decimal("maxScore", { precision: 6, scale: 2 }),
  sectionIScore: decimal("sectionIScore", { precision: 6, scale: 2 }),
  sectionIIScore: decimal("sectionIIScore", { precision: 6, scale: 2 }),
  sectionIIIScore: decimal("sectionIIIScore", { precision: 6, scale: 2 }),
  googleSheetsSyncStatus: mysqlEnum("googleSheetsSyncStatus", ["not_requested", "pending", "synced", "error"]).default("not_requested").notNull(),
  googleSheetsSyncedAt: timestamp("googleSheetsSyncedAt"),
  googleSheetsSyncAttempts: int("googleSheetsSyncAttempts").default(0).notNull(),
  googleSheetsSyncError: text("googleSheetsSyncError"),
  googleSheetsRetryAt: timestamp("googleSheetsRetryAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExamAttempt = typeof examAttempts.$inferSelect;
export type InsertExamAttempt = typeof examAttempts.$inferInsert;
