import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema
	}),
	plugins: [sveltekitCookies(() => getRequestEvent())],
	baseURL: env.BETTER_AUTH_URL || 'http://localhost:5173',
	socialProviders: {
		spotify: {
			clientId: env.SPOTIFY_CLIENT_ID!,
			clientSecret: env.SPOTIFY_CLIENT_SECRET!,
			scope: ['user-read-currently-playing', 'user-read-playback-state']
		}
	}
});