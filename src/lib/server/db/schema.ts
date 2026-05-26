import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const songs = sqliteTable('songs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	artistName: text('artist_name').notNull(),
	thumbnailUrl: text('thumbnail_url'),
	type: text('type', { enum: ['song', 'album'] })
		.notNull()
		.default('song'),
	pageUrl: text('page_url'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

export const platformLinks = sqliteTable('platform_links', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	songId: text('song_id')
		.notNull()
		.references(() => songs.id, { onDelete: 'cascade' }),
	platform: text('platform').notNull(),
	url: text('url').notNull(),
	nativeAppUriMobile: text('native_app_uri_mobile'),
	nativeAppUriDesktop: text('native_app_uri_desktop'),
	entityId: text('entity_id')
});

export const urlLookups = sqliteTable('url_lookups', {
	url: text('url').primaryKey(),
	songId: text('song_id')
		.notNull()
		.references(() => songs.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

export const songsRelations = relations(songs, ({ many }) => ({
	platformLinks: many(platformLinks),
	urlLookups: many(urlLookups)
}));

export const platformLinksRelations = relations(platformLinks, ({ one }) => ({
	song: one(songs, { fields: [platformLinks.songId], references: [songs.id] })
}));

export const urlLookupsRelations = relations(urlLookups, ({ one }) => ({
	song: one(songs, { fields: [urlLookups.songId], references: [songs.id] })
}));
