CREATE TABLE "group" (
	"name" text PRIMARY KEY NOT NULL,
	"description" text,
	"owner" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groupPermission" (
	"id" text PRIMARY KEY NOT NULL,
	"groupName" text NOT NULL,
	"permissionName" text NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"name" text PRIMARY KEY NOT NULL,
	"description" text,
	"owner" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"token" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"name" text PRIMARY KEY NOT NULL,
	"value" text,
	"type" text DEFAULT 'string' NOT NULL,
	"isPublic" boolean DEFAULT false NOT NULL,
	"description" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "userGroup" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"groupName" text NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"token" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groupPermission" ADD CONSTRAINT "groupPermission_groupName_group_name_fk" FOREIGN KEY ("groupName") REFERENCES "public"."group"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groupPermission" ADD CONSTRAINT "groupPermission_permissionName_permission_name_fk" FOREIGN KEY ("permissionName") REFERENCES "public"."permission"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userGroup" ADD CONSTRAINT "userGroup_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userGroup" ADD CONSTRAINT "userGroup_groupName_group_name_fk" FOREIGN KEY ("groupName") REFERENCES "public"."group"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verificationToken" ADD CONSTRAINT "verificationToken_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;