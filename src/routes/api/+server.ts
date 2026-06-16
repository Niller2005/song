import { ScalarApiReference } from '@scalar/sveltekit';
import type { RequestHandler } from './$types';

import { building } from '$app/environment';

const spec = {
	openapi: '3.1.0',
	info: {
		title: 'Songlink API',
		version: '1.0.0',
		description:
			'Songlink resolves music links from any platform into unified metadata + cross-platform links. It also provides Spotify now-playing and listening history for authenticated users.'
	},
	servers: [{ url: '/' }],
	paths: {
		'/api/lookup': {
			get: {
				summary: 'Look up a song from any music platform URL',
				description:
					'Accepts a music platform URL (Spotify, Apple Music, YouTube, etc.), resolves the song metadata, and returns links across all supported platforms. Results are cached in the database.',
				parameters: [
					{
						name: 'url',
						in: 'query',
						required: true,
						schema: { type: 'string', format: 'uri', example: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' },
						description: 'A music platform URL to look up'
					}
				],
				responses: {
					'200': {
						description: 'Song lookup result',
						content: { 'application/json': { schema: { $ref: '#/components/schemas/SongResult' } } }
					},
					'400': {
						description: 'Missing url parameter',
						content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
					},
					'502': {
						description: 'Lookup failed — unrecognized URL or platform error',
						content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
					}
				}
			}
		},
		'/api/now-playing': {
			get: {
				summary: 'Get currently playing Spotify track',
				description:
					'Returns the currently playing track from Spotify. Requires authentication via session cookie (web) or `?key=` query parameter (OBS overlay). Automatically records plays to listening history.',
				parameters: [
					{
						name: 'key',
						in: 'query',
						required: false,
						schema: { type: 'string', example: 'your-api-key' },
						description:
							'API key for unauthenticated access (e.g. from OBS browser source). Configured via NOW_PLAYING_API_KEY env var.'
					}
				],
				security: [{ sessionCookie: [] }, { apiKey: [] }],
				responses: {
					'200': {
						description: 'Currently playing state',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/NowPlayingResponse' }
							}
						}
					}
				}
			}
		},
		'/api/history': {
			get: {
				summary: 'Get listening history',
				description:
					'Returns recently played tracks for the authenticated user. Requires authentication via session cookie or `?key=` query parameter.',
				parameters: [
					{
						name: 'key',
						in: 'query',
						required: false,
						schema: { type: 'string' },
						description: 'API key for unauthenticated access'
					},
					{
						name: 'limit',
						in: 'query',
						required: false,
						schema: { type: 'integer', default: 50, maximum: 100 },
						description: 'Number of history entries to return (max 100)'
					}
				],
				security: [{ sessionCookie: [] }, { apiKey: [] }],
				responses: {
					'200': {
						description: 'List of history entries, newest first',
						content: {
							'application/json': {
								schema: {
									type: 'array',
									items: { $ref: '#/components/schemas/HistoryEntry' }
								}
							}
						}
					},
					'401': {
						description: 'Unauthorized',
						content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
					}
				}
			}
		}
	},
	components: {
		securitySchemes: {
			sessionCookie: {
				type: 'apiKey',
				in: 'cookie',
				name: 'session',
				description: 'Better Auth session cookie (auto-set after OAuth sign-in)'
			},
			apiKey: {
				type: 'apiKey',
				in: 'query',
				name: 'key',
				description:
					'API key sent as `?key=` query parameter. Configured via the NOW_PLAYING_API_KEY environment variable.'
			}
		},
		schemas: {
			SongResult: {
				type: 'object',
				required: ['id', 'title', 'artistName', 'type', 'platforms', 'cached'],
				properties: {
					id: { type: 'string', description: 'Short song ID (e.g. spotify track ID)' },
					title: { type: 'string', example: 'Bohemian Rhapsody' },
					artistName: { type: 'string', example: 'Queen' },
					thumbnailUrl: {
						type: 'string',
						format: 'uri',
						nullable: true,
						description: 'Album art or thumbnail URL'
					},
					type: { type: 'string', enum: ['song', 'album'] },
					pageUrl: { type: 'string', nullable: true, description: 'Relative URL to the song page on this app' },
					platforms: {
						type: 'array',
						items: { $ref: '#/components/schemas/PlatformLink' }
					},
					cached: {
						type: 'boolean',
						description: 'Whether the result was served from cache'
					}
				}
			},
			PlatformLink: {
				type: 'object',
				required: ['platform', 'url'],
				properties: {
					platform: { type: 'string', example: 'spotify', description: 'Platform identifier' },
					url: { type: 'string', format: 'uri', example: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' },
					nativeAppUriMobile: { type: 'string', nullable: true },
					nativeAppUriDesktop: { type: 'string', nullable: true }
				}
			},
			NowPlayingResponse: {
				type: 'object',
				required: ['isPlaying'],
				properties: {
					isPlaying: { type: 'boolean', description: 'Whether a track is currently playing' },
					title: { type: 'string', nullable: true, example: 'Bohemian Rhapsody' },
					artist: { type: 'string', nullable: true, example: 'Queen' },
					album: { type: 'string', nullable: true, example: 'A Night at the Opera' },
					albumArt: {
						type: 'string',
						format: 'uri',
						nullable: true,
						description: 'URL of the album art image'
					},
					progress: {
						type: 'integer',
						nullable: true,
						description: 'Current playback position in milliseconds'
					},
					duration: {
						type: 'integer',
						nullable: true,
						description: 'Total track duration in milliseconds'
					},
					spotifyUrl: {
						type: 'string',
						format: 'uri',
						nullable: true,
						description: 'Spotify URL for the track'
					},
					notConnected: {
						type: 'boolean',
						description: 'True when no Spotify account is linked or session is missing'
					}
				}
			},
			HistoryEntry: {
				type: 'object',
				required: ['id', 'title', 'artist', 'playedAt'],
				properties: {
					id: { type: 'string', description: 'Unique entry ID' },
					title: { type: 'string', example: 'Bohemian Rhapsody' },
					artist: { type: 'string', example: 'Queen' },
					album: { type: 'string', nullable: true, example: 'A Night at the Opera' },
					albumArt: {
						type: 'string',
						format: 'uri',
						nullable: true,
						description: 'Album art image URL'
					},
					spotifyUrl: {
						type: 'string',
						format: 'uri',
						nullable: true,
						description: 'Spotify URL for the track'
					},
					spotifyTrackId: {
						type: 'string',
						nullable: true,
						description: 'Spotify track ID'
					},
					playedAt: {
						type: 'string',
						format: 'date-time',
						description: 'ISO 8601 timestamp of when the track was played'
					}
				}
			},
			Error: {
				type: 'object',
				required: ['message'],
				properties: {
					message: { type: 'string', description: 'Error description' }
				}
			}
		}
	}
};

const apiReference = ScalarApiReference({
	content: spec,
	theme: 'deepSpace',
	darkMode: true,
	hideDownloadButton: false,
	hideClientButton: false,
	hideModels: false,
	showSidebar: true
});

export const GET: RequestHandler = () => {
	return apiReference();
};
