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
	socialProviders: {
		spotify: {
			clientId: env.SPOTIFY_CLIENT_ID!,
			clientSecret: env.SPOTIFY_CLIENT_SECRET!,
			scope: ['user-read-currently-playing', 'user-read-playback-state']
		}
	}
});