# Songlink Clone API Reference

Welcome to the API documentation for the self-hosted Songlink clone. This self-contained API resolves music links from any of the 14 supported streaming platforms and retrieves matching structured metadata and direct URLs for all available platforms.

---

## 1. Endpoint: `/api/lookup`

Resolves any supported music link (e.g., Spotify, Apple Music, YouTube) into unified metadata and matching platform links.

### Request

- **Method**: `GET`
- **Path**: `/api/lookup`
- **Query Parameters**:
  - `url` (string, required): The source streaming URL to resolve and match.

#### Example Request

```http
GET /api/lookup?url=https://open.spotify.com/track/48bSId8uPZ96rE29pTq6iX HTTP/1.1
Host: localhost:5173
```

---

### Success Response

- **Status Code**: `200 OK`
- **Content-Type**: `application/json`

#### Response Fields

| Field          | Type               | Description                                                                                                      |
| :------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------- |
| `id`           | `string`           | The clean, unique, and URL-safe identifier extracted from the source platform (or a generated UUID).             |
| `title`        | `string`           | The title of the track or album.                                                                                 |
| `artistName`   | `string`           | The primary artist name or list of artists.                                                                      |
| `thumbnailUrl` | `string` or `null` | A direct link to the cover art or thumbnail image.                                                               |
| `type`         | `string`           | The type of release, either `"song"` or `"album"`.                                                               |
| `pageUrl`      | `string`           | The path to the user-facing shareable web page on this clone (e.g., `/s/48bSId8uPZ96rE29pTq6iX`).                |
| `cached`       | `boolean`          | Indicates whether the result was retrieved from the local database cache (`true`) or freshly resolved (`false`). |
| `platforms`    | `Array<Object>`    | A list of matching links and deep-linking URIs on other platforms.                                               |

#### Platform Object Fields

| Field                 | Type               | Description                                                                                |
| :-------------------- | :----------------- | :----------------------------------------------------------------------------------------- |
| `platform`            | `string`           | The lowercase identifier of the platform (e.g., `"spotify"`, `"appleMusic"`, `"youtube"`). |
| `url`                 | `string`           | The direct HTTP URL to the track or album on the respective platform.                      |
| `nativeAppUriMobile`  | `string` or `null` | Deep-linking URI to launch the track inside the platform's mobile app (if available).      |
| `nativeAppUriDesktop` | `string` or `null` | Deep-linking URI to launch the track inside the platform's desktop app (if available).     |

---

### Complete JSON Response Example

Below is a realistic response when querying for the track **"I Run" by "HAVEN., Kaitlin Aragon"**:

```json
{
	"id": "48bSId8uPZ96rE29pTq6iX",
	"title": "I Run",
	"artistName": "HAVEN., Kaitlin Aragon",
	"thumbnailUrl": "https://i.scdn.co/image/ab67616d0000b273b0636cf0f82df1f2f09db7c3",
	"type": "song",
	"pageUrl": "/s/48bSId8uPZ96rE29pTq6iX",
	"cached": false,
	"platforms": [
		{
			"platform": "spotify",
			"url": "https://open.spotify.com/track/48bSId8uPZ96rE29pTq6iX",
			"nativeAppUriMobile": "spotify:track:48bSId8uPZ96rE29pTq6iX",
			"nativeAppUriDesktop": "spotify:track:48bSId8uPZ96rE29pTq6iX"
		},
		{
			"platform": "appleMusic",
			"url": "https://music.apple.com/us/album/i-run-feat-kaitlin-aragon/1638367912?i=1638367913",
			"nativeAppUriMobile": null,
			"nativeAppUriDesktop": null
		},
		{
			"platform": "youtube",
			"url": "https://www.youtube.com/watch?v=Fstz3_S2Nlo",
			"nativeAppUriMobile": null,
			"nativeAppUriDesktop": null
		},
		{
			"platform": "deezer",
			"url": "https://www.deezer.com/track/1854890257",
			"nativeAppUriMobile": null,
			"nativeAppUriDesktop": null
		},
		{
			"platform": "tidal",
			"url": "https://tidal.com/browse/track/241908256",
			"nativeAppUriMobile": null,
			"nativeAppUriDesktop": null
		},
		{
			"platform": "soundcloud",
			"url": "https://soundcloud.com/haven-music/i-run-feat-kaitlin-aragon",
			"nativeAppUriMobile": null,
			"nativeAppUriDesktop": null
		}
	]
}
```

---

### Error Responses

#### `400 Bad Request`

Returned when the mandatory `url` query parameter is missing from the request.

- **Payload**:
  ```json
  {
  	"message": "Missing \"url\" query parameter"
  }
  ```

#### `502 Bad Gateway`

Returned when the provided URL cannot be recognized or lookup fails against the upstream metadata APIs.

- **Payload**:
  ```json
  {
  	"message": "Failed to look up song: Could not recognize this URL. Supported platforms: Spotify, Youtube, AppleMusic, Tidal, Soundcloud, Deezer, AmazonMusic, Pandora, Napster, Yandex, Audiomack, Audius, Anghami, Boomplay"
  }
  ```

---

## 2. Shareable URL Endpoints

The application supports clean, short, user-friendly URLs that redirect or load the unified sharing page for a specific release on a platform. These URLs map the dynamic platform prefix and the original native platform ID into a standardized path:

`/[prefix]/[native_id]`

### Dynamic Prefix Mapping

| Path Format       | Source Platform | Example Shareable URL                       |
| :---------------- | :-------------- | :------------------------------------------ |
| `/s/[native_id]`  | Spotify         | `/s/48bSId8uPZ96rE29pTq6iX`                 |
| `/a/[native_id]`  | Apple Music     | `/a/1638367913`                             |
| `/y/[native_id]`  | YouTube         | `/y/Fstz3_S2Nlo`                            |
| `/d/[native_id]`  | Deezer          | `/d/1854890257`                             |
| `/t/[native_id]`  | Tidal           | `/t/241908256`                              |
| `/sc/[native_id]` | SoundCloud      | `/sc/haven-music-i-run-feat-kaitlin-aragon` |

When a visitor loads one of these shareable paths, the server automatically extracts the ID, looks up the cached song metadata, or resolves the platform link asynchronously if it is the first time the track is being requested.
