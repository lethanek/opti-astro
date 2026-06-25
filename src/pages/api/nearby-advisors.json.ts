import type { APIRoute } from 'astro';
import type { Locales } from '../../../__generated/sdk';
import { getOptimizelySdk } from '../../graphql/getSdk';
import type { ContentPayload } from '../../graphql/shared/ContentPayload';
import { localeToSdkLocale } from '../../lib/locale-helpers';
import {
	geocodeAddress,
	haversineKm,
	KM_TO_MILES,
	type Coordinates,
} from '../../cms/components/FacetedSearchComponent/lib/geoHelpers';

export const GET: APIRoute = async ({ url }) => {
	try {
		// Parse and validate the visitor's coordinates
		const lat = parseFloat(url.searchParams.get('lat') || '');
		const lng = parseFloat(url.searchParams.get('lng') || '');

		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			return new Response(
				JSON.stringify({ error: 'Valid "lat" and "lng" query parameters are required' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const origin: Coordinates = { lat, lng };
		const locale = url.searchParams.get('locale') || 'en';
		const domain = url.searchParams.get('domain') || url.origin;
		const count = Math.min(parseInt(url.searchParams.get('count') || '3'), 20);

		// Create content payload
		const contentPayload: ContentPayload = {
			ctx: 'view',
			key: '',
			ver: '',
			loc: localeToSdkLocale(locale) as Locales,
			preview_token: '',
			types: [],
		};

		// Fetch all published EmployeeBio pages for this domain/locale
		const sdk = getOptimizelySdk(contentPayload);
		const result = await sdk.employeeBios({
			locale: [contentPayload.loc as Locales],
			domain: domain,
			limit: 100, // Optimizely Graph caps limit at 100
		});

		// getSdk returns undefined when the GraphQL request fails
		if (!result) {
			return new Response(
				JSON.stringify({ error: 'Failed to load advisors from the content graph' }),
				{ status: 502, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const advisors = (result.EmployeeBio?.items || []).filter(
			(item: any): item is any => !!item?.Address && item.Address.trim().length > 0
		);

		// Geocode each advisor's address and compute distance from the visitor.
		// Geocoding is throttled + cached inside geocodeAddress to respect the
		// Nominatim usage policy.
		const withDistance: any[] = [];
		for (const advisor of advisors) {
			const address: string = advisor.Address;
			const coords = await geocodeAddress(address);
			if (!coords) continue;

			const distanceKm = haversineKm(origin, coords);
			withDistance.push({
				...advisor,
				__contentType: 'EmployeeBio',
				coordinates: coords,
				distanceKm,
				distanceMi: distanceKm * KM_TO_MILES,
			});
		}

		// Sort by nearest and take the requested number
		withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
		const items = withDistance.slice(0, count);

		return new Response(
			JSON.stringify({
				items,
				total: withDistance.length,
				totalAdvisors: advisors.length,
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					// Distances are per-visitor, so cache only briefly
					'Cache-Control': 'private, max-age=30',
				},
			}
		);
	} catch (error) {
		console.error('Nearby advisors API error:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to find nearby advisors',
				details: error instanceof Error ? error.message : 'Unknown error',
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
