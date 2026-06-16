import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ── Songlink core tables ──

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

// ── Better Auth tables ──
// Reference: https://better-auth.com/docs/concepts/database#core-schema
// Table/column names follow Better Auth conventions so the Drizzle adapter resolves them automatically.

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull()
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
});

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] })
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] })
}));

// ── Listening history ──

export const listeningHistory = sqliteTable('listening_history', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	artist: text('artist').notNull(),
	album: text('album'),
	albumArt: text('album_art'),
	spotifyUrl: text('spotify_url'),
	spotifyTrackId: text('spotify_track_id'),
	playedAt: integer('played_at', { mode: 'timestamp' }).notNull()
});

export const listeningHistoryRelations = relations(listeningHistory, ({ one }) => ({
	user: one(user, { fields: [listeningHistory.userId], references: [user.id] })
}));

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	listeningHistory: many(listeningHistory)
}));