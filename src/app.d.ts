// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			session: {
				id: string;
				expiresAt: Date;
				token: string;
				createdAt: Date;
				updatedAt: Date;
				userId: string;
			} | null;
			user: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				image?: string | null | undefined;
				createdAt: Date;
				updatedAt: Date;
			} | null;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
