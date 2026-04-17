CREATE TABLE "extension" (
	"name" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"directory" text NOT NULL,
	"description" text,
	"author" text,
	"url" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"installedAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "extension_directory_unique" UNIQUE("directory")
);
--> statement-breakpoint
CREATE TABLE "hook" (
	"id" text PRIMARY KEY NOT NULL,
	"extensionName" text NOT NULL,
	"hookName" text NOT NULL,
	"handlerPath" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"owner" text DEFAULT 'custom' NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "menu_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "menuItem" (
	"id" text PRIMARY KEY NOT NULL,
	"menuId" text NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'url' NOT NULL,
	"pageId" text,
	"url" text DEFAULT '',
	"target" text DEFAULT '_self' NOT NULL,
	"parentId" text,
	"order" integer DEFAULT 0 NOT NULL,
	"owner" text DEFAULT 'custom' NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"template" text DEFAULT 'default' NOT NULL,
	"html" text,
	"description" text,
	"isPublic" boolean DEFAULT true NOT NULL,
	"owner" text DEFAULT 'custom' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "page_path_unique" UNIQUE("path")
);
--> statement-breakpoint
ALTER TABLE "hook" ADD CONSTRAINT "hook_extensionName_extension_name_fk" FOREIGN KEY ("extensionName") REFERENCES "public"."extension"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menuItem" ADD CONSTRAINT "menuItem_menuId_menu_id_fk" FOREIGN KEY ("menuId") REFERENCES "public"."menu"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menuItem" ADD CONSTRAINT "menuItem_pageId_page_id_fk" FOREIGN KEY ("pageId") REFERENCES "public"."page"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menuItem" ADD CONSTRAINT "menuItem_parentId_menuItem_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."menuItem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hook_hookName_idx" ON "hook" USING btree ("hookName");--> statement-breakpoint
CREATE INDEX "hook_extensionName_idx" ON "hook" USING btree ("extensionName");--> statement-breakpoint
CREATE INDEX "menu_slug_idx" ON "menu" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "menu_owner_idx" ON "menu" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "menuItem_menuId_idx" ON "menuItem" USING btree ("menuId");--> statement-breakpoint
CREATE INDEX "menuItem_parentId_idx" ON "menuItem" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "menuItem_owner_idx" ON "menuItem" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "menuItem_pageId_idx" ON "menuItem" USING btree ("pageId");--> statement-breakpoint
CREATE INDEX "page_path_idx" ON "page" USING btree ("path");--> statement-breakpoint
CREATE INDEX "page_owner_idx" ON "page" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "page_status_idx" ON "page" USING btree ("status");