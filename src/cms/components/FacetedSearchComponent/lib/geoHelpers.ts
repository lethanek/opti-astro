/**
 * Server-side geo helpers for the "Find an Advisor Close to Me" feature.
 *
 * Geocodes free-text EmployeeBio addresses to coordinates using the free
 * OpenStreetMap Nominatim service, and computes great-circle distances.
 *
 * Nominatim usage policy notes (https://operations.osmfoundation.org/policies/nominatim/):
 *  - Maximum 1 request per second -> we throttle sequential lookups.
 *  - A valid identifying User-Agent / Referer is required.
 *  - Results should be cached -> we keep a module-level cache so repeat
 *    lookups for the same address are instant and don't hit the API again.
 */

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_USER_AGENT = 'opti-astro-faceted-search/1.0 (advisor-locator)';
const RATE_LIMIT_MS = 1100; // stay just above the 1 req/sec policy

export interface Coordinates {
	lat: number;
	lng: number;
}

// Module-level cache: address string -> resolved coordinates (or null if it
// could not be geocoded). Persists for the lifetime of the server process.
const geocodeCache = new Map<string, Coordinates | null>();

let lastRequestAt = 0;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Geocode a single free-text address to coordinates using Nominatim.
 * Returns null when the address is empty or cannot be resolved.
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
	const normalized = (address || '').trim();
	if (!normalized) return null;

	const cacheKey = normalized.toLowerCase();
	if (geocodeCache.has(cacheKey)) {
		return geocodeCache.get(cacheKey) ?? null;
	}

	// Throttle to respect the Nominatim usage policy
	const sinceLast = Date.now() - lastRequestAt;
	if (sinceLast < RATE_LIMIT_MS) {
		await delay(RATE_LIMIT_MS - sinceLast);
	}
	lastRequestAt = Date.now();

	try {
		const params = new URLSearchParams({
			q: normalized,
			format: 'json',
			limit: '1',
		});
		const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
			headers: {
				'User-Agent': NOMINATIM_USER_AGENT,
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			geocodeCache.set(cacheKey, null);
			return null;
		}

		const data = (await response.json()) as Array<{ lat: string; lon: string }>;
		if (!Array.isArray(data) || data.length === 0) {
			geocodeCache.set(cacheKey, null);
			return null;
		}

		const coords: Coordinates = {
			lat: parseFloat(data[0].lat),
			lng: parseFloat(data[0].lon),
		};

		if (Number.isNaN(coords.lat) || Number.isNaN(coords.lng)) {
			geocodeCache.set(cacheKey, null);
			return null;
		}

		geocodeCache.set(cacheKey, coords);
		return coords;
	} catch (error) {
		console.error('Geocoding error for address:', normalized, error);
		// Don't cache transient failures so a later request can retry
		return null;
	}
}

/**
 * Great-circle distance between two coordinates using the haversine formula.
 * Returns the distance in kilometers.
 */
export function haversineKm(a: Coordinates, b: Coordinates): number {
	const R = 6371; // Earth radius in km
	const toRad = (deg: number) => (deg * Math.PI) / 180;

	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);

	const sinDLat = Math.sin(dLat / 2);
	const sinDLng = Math.sin(dLng / 2);
	const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

	return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const KM_TO_MILES = 0.621371;
