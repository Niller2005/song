import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { spotify } from './spotify';
import { youtube } from './youtube';
import { appleMusic } from './appleMusic';
import { tidal } from './tidal';
import { soundcloud } from './soundcloud';
import { deezer } from './deezer';
import { amazonMusic } from './amazonMusic';
import { pandora } from './pandora';
import { napster } from './napster';
import { yandex } from './yandex';
import { audiomack } from './audiomack';
import { audius } from './audius';
import { anghami } from './anghami';
import { boomplay } from './boomplay';

export const providers: PlatformProvider[] = [
	spotify,
	youtube,
	appleMusic,
	tidal,
	soundcloud,
	deezer,
	amazonMusic,
	pandora,
	napster,
	yandex,
	audiomack,
	audius,
	anghami,
	boomplay
];

export type { PlatformProvider, PlatformResult, SongMetadata } from './types';
export { searchWeb, parseOpenGraph } from './searchHelper';
