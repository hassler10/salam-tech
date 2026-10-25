import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  bigint,
  boolean,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 64 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 32 }).notNull().default("agent"), // admin | responsable | agent
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const subscriptionTypes = pgTable("subscription_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  durationDays: integer("duration_days").notNull().default(1),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 24 }).notNull(),
    /** Numéro figurant sur la carte émise par la plateforme existante. */
    cardNumber: varchar("card_number", { length: 48 }),
    /** Identifiant stable de la fiche dans media-salam (survit à un changement de carte). */
    externalRef: varchar("external_ref", { length: 64 }),
    /** 'interne' = créé ici, 'import' = ancien import CSV, 'media_salam' = registre synchronisé. */
    source: varchar("source", { length: 16 }).notNull().default("interne"),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    firstName: varchar("first_name", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 120 }),
    note: text("note"),
    status: varchar("status", { length: 24 }).notNull().default("actif"), // actif | suspendu
    registeredAt: date("registered_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscribers_code_idx").on(t.code),
    uniqueIndex("subscribers_card_idx").on(t.cardNumber),
    uniqueIndex("subscribers_external_ref_idx").on(t.externalRef),
    index("subscribers_name_idx").on(t.lastName, t.firstName),
  ],
);

export const subscriptionPeriods = pgTable(
  "subscription_periods",
  {
    id: serial("id").primaryKey(),
    subscriberId: integer("subscriber_id").notNull().references(() => subscribers.id, { onDelete: "cascade" }),
    typeId: integer("type_id").references(() => subscriptionTypes.id),
    typeName: varchar("type_name", { length: 80 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    durationDays: integer("duration_days").notNull(),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("periods_subscriber_idx").on(t.subscriberId)],
);

export const visitors = pgTable(
  "visitors",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 24 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    organization: varchar("organization", { length: 140 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("visitors_code_idx").on(t.code),
    index("visitors_name_idx").on(t.lastName, t.firstName),
  ],
);

export const visitReasons = pgTable("visit_reasons", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 120 }).notNull(),
  active: boolean("active").notNull().default(true),
});

export const visits = pgTable(
  "visits",
  {
    id: serial("id").primaryKey(),
    uid: varchar("uid", { length: 64 }).notNull(),
    personType: varchar("person_type", { length: 16 }).notNull(), // abonne | visiteur
    subscriberId: integer("subscriber_id").references(() => subscribers.id, { onDelete: "set null" }),
    visitorId: integer("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    reason: varchar("reason", { length: 120 }),
    organization: varchar("organization", { length: 140 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    agentId: integer("agent_id").references(() => users.id),
    agentName: varchar("agent_name", { length: 160 }),
    syncStatus: varchar("sync_status", { length: 24 }).notNull().default("synchronise"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("visits_uid_idx").on(t.uid),
    index("visits_occurred_idx").on(t.occurredAt),
    index("visits_subscriber_idx").on(t.subscriberId),
    index("visits_visitor_idx").on(t.visitorId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: varchar("user_name", { length: 160 }),
    action: varchar("action", { length: 80 }).notNull(),
    entity: varchar("entity", { length: 80 }),
    entityId: varchar("entity_id", { length: 64 }),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const settings = pgTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
});

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  bucketHash: varchar("bucket_hash", { length: 64 }).primaryKey(),
  hitCount: integer("hit_count").notNull(),
  resetAt: bigint("reset_at", { mode: "number" }).notNull(),
});
