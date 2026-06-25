<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		getTitle,
		getSubtitle,
		getImageUrl,
		getImageAlt,
		getPlaceholderGradient,
	} from './lib/searchResultHelpers';

	interface Props {
		config: {
			locale: string;
			domain: string;
		};
		isEditMode?: boolean;
		buttonLabel?: string;
		count?: number;
	}

	let {
		config,
		isEditMode = false,
		buttonLabel = 'Find an Advisor Close to Me',
		count = 3,
	}: Props = $props();

	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let advisors = $state<any[]>([]);
	let hasSearched = $state(false);
	let userCoords = $state<{ lat: number; lng: number } | null>(null);

	// Leaflet map state. Leaflet touches `window`/`document` at import time, so
	// it is loaded lazily in the browser only (this component is client:load).
	let mapEl = $state<HTMLDivElement | null>(null);
	let leaflet: any = null;
	let map: any = null;
	let markersLayer: any = null;

	// (Re)render the map whenever we have advisors with coordinates and the
	// container is mounted. $effect runs in the browser only.
	$effect(() => {
		// Track dependencies so the effect re-runs when results change.
		const currentAdvisors = advisors;
		const el = mapEl;
		if (!el || currentAdvisors.length === 0) return;
		renderMap();
	});

	async function renderMap() {
		if (!leaflet) {
			const mod = await import('leaflet');
			await import('leaflet/dist/leaflet.css');
			leaflet = mod.default ?? mod;
		}
		if (!mapEl) return;

		if (!map) {
			map = leaflet.map(mapEl, { scrollWheelZoom: false });
			leaflet
				.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					maxZoom: 19,
					attribution: '&copy; OpenStreetMap contributors',
				})
				.addTo(map);
		}

		// Reset markers from any previous search.
		if (markersLayer) {
			markersLayer.remove();
		}
		markersLayer = leaflet.layerGroup().addTo(map);

		const redIcon = leaflet.divIcon({
			className: 'advisor-pin',
			html: `<svg width="28" height="40" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<path fill="#e11d48" stroke="#ffffff" stroke-width="1.5" d="M12 .75C6.063.75 1.25 5.563 1.25 11.5c0 7.844 9.5 22.5 10.75 22.5S22.75 19.344 22.75 11.5C22.75 5.563 17.937.75 12 .75z"/>
				<circle cx="12" cy="11.5" r="4" fill="#ffffff"/>
			</svg>`,
			iconSize: [28, 40],
			iconAnchor: [14, 40],
			popupAnchor: [0, -36],
		});

		const bounds: Array<[number, number]> = [];

		for (const advisor of advisors) {
			const coords = advisor.coordinates;
			if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
				continue;
			}
			const point: [number, number] = [coords.lat, coords.lng];
			const popupHtml = `<strong>${escapeHtml(getTitle(advisor))}</strong>${
				advisor.Address ? `<br>${escapeHtml(advisor.Address)}` : ''
			}`;
			leaflet.marker(point, { icon: redIcon, title: getTitle(advisor) })
				.bindPopup(popupHtml)
				.addTo(markersLayer);
			bounds.push(point);
		}

		// Mark the visitor's own location for context.
		if (userCoords) {
			const youPoint: [number, number] = [userCoords.lat, userCoords.lng];
			leaflet
				.circleMarker(youPoint, {
					radius: 7,
					color: '#ffffff',
					weight: 2,
					fillColor: '#2563eb',
					fillOpacity: 1,
				})
				.bindPopup('You are here')
				.addTo(markersLayer);
			bounds.push(youPoint);
		}

		if (bounds.length > 0) {
			map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
		}

		// The container may have been sized after init; ensure tiles fill it.
		setTimeout(() => map && map.invalidateSize(), 0);
	}

	function destroyMap() {
		if (map) {
			map.remove();
			map = null;
			markersLayer = null;
		}
	}

	function escapeHtml(value: string): string {
		return String(value ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	onDestroy(destroyMap);

	function requestLocation() {
		if (isEditMode) return;

		error = null;
		advisors = [];

		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			error = 'Location services are not available in your browser.';
			return;
		}

		isLoading = true;

		navigator.geolocation.getCurrentPosition(
			(position) => {
				fetchNearby(position.coords.latitude, position.coords.longitude);
			},
			(geoError) => {
				isLoading = false;
				switch (geoError.code) {
					case geoError.PERMISSION_DENIED:
						error = 'Location access was denied. Please allow location access and try again.';
						break;
					case geoError.POSITION_UNAVAILABLE:
						error = 'Your location could not be determined. Please try again.';
						break;
					case geoError.TIMEOUT:
						error = 'Finding your location timed out. Please try again.';
						break;
					default:
						error = 'Something went wrong while finding your location.';
				}
			},
			{ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
		);
	}

	async function fetchNearby(lat: number, lng: number) {
		userCoords = { lat, lng };
		try {
			const params = new URLSearchParams({
				lat: lat.toString(),
				lng: lng.toString(),
				locale: config.locale,
				domain: config.domain,
				count: count.toString(),
			});

			const response = await fetch(`/api/nearby-advisors.json?${params.toString()}`);
			if (!response.ok) {
				throw new Error(`Request failed: ${response.status}`);
			}

			const data = await response.json();
			advisors = data.items || [];
			hasSearched = true;

			if (advisors.length === 0) {
				error = 'No advisors with a locatable address were found near you.';
			}
		} catch (err) {
			console.error('Error finding nearby advisors:', err);
			error = 'Unable to find nearby advisors right now. Please try again later.';
		} finally {
			isLoading = false;
		}
	}

	function clearResults() {
		advisors = [];
		hasSearched = false;
		error = null;
		userCoords = null;
		destroyMap();
	}

	function formatDistance(advisor: any): string {
		if (typeof advisor.distanceMi !== 'number') return '';
		return `${advisor.distanceMi.toFixed(1)} mi away`;
	}
</script>

<div class="nearby-advisors mb-6">
	<div class="flex flex-wrap items-center gap-3">
		<button
			type="button"
			class="btn btn-primary"
			onclick={requestLocation}
			disabled={isLoading || isEditMode}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
				Finding advisors near you…
			{:else}
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				{buttonLabel}
			{/if}
		</button>

		{#if hasSearched && advisors.length > 0}
			<button type="button" class="btn btn-ghost btn-sm" onclick={clearResults}>
				Clear
			</button>
		{/if}
	</div>

	{#if error}
		<div class="alert alert-warning mt-3">
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	{#if advisors.length > 0}
		<section class="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4" aria-label="Advisors closest to you">
			<h3 class="text-lg font-bold mb-4 flex items-center gap-2">
				<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				Advisors closest to you
			</h3>

			<!-- Map: grayscale tiles with red advisor pins -->
			<div
				bind:this={mapEl}
				class="advisor-map w-full h-[400px] rounded-lg overflow-hidden mb-4 z-0"
				role="application"
				aria-label="Map showing the advisors closest to you"
			></div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				{#each advisors as advisor (advisor._metadata.key)}
					{@const imageUrl = getImageUrl(advisor)}
					<article class="card bg-base-100 shadow-md h-full">
						<div class="card-body p-4">
							<div class="flex items-center gap-3 mb-2">
								{#if imageUrl}
									<img src={imageUrl} alt={getImageAlt(advisor)} class="w-14 h-14 rounded-full object-cover shrink-0" />
								{:else}
									<div class="w-14 h-14 rounded-full shrink-0 flex items-center justify-center {getPlaceholderGradient(advisor)}">
										<svg class="w-7 h-7 text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
										</svg>
									</div>
								{/if}
								<div class="min-w-0">
									<a href={advisor._metadata.url.hierarchical} class="font-bold hover:text-primary line-clamp-1">
										{getTitle(advisor)}
									</a>
									{#if getSubtitle(advisor)}
										<p class="text-sm text-base-content/70 line-clamp-1">{getSubtitle(advisor)}</p>
									{/if}
								</div>
							</div>

							<p class="text-sm font-semibold text-primary">{formatDistance(advisor)}</p>

							{#if advisor.Address}
								<p class="text-sm text-base-content/70">{advisor.Address}</p>
							{/if}

							<div class="text-sm text-base-content/70 space-y-0.5 mt-1">
								{#if advisor.Phone}
									<p><a href={`tel:${advisor.Phone}`} class="hover:text-primary">{advisor.Phone}</a></p>
								{/if}
								{#if advisor.Email}
									<p class="truncate"><a href={`mailto:${advisor.Email}`} class="hover:text-primary">{advisor.Email}</a></p>
								{/if}
							</div>

							<div class="card-actions mt-auto pt-2">
								<a href={advisor._metadata.url.hierarchical} class="btn btn-primary btn-sm btn-block">
									View profile
								</a>
							</div>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	/* Grayscale the basemap tiles only — markers/pins keep their colour
	   because they live in a separate Leaflet pane. */
	.advisor-map :global(.leaflet-tile-pane) {
		filter: grayscale(100%);
	}

	/* The red pin uses a transparent divIcon, so strip Leaflet's default
	   marker background/border. */
	.advisor-map :global(.advisor-pin) {
		background: transparent;
		border: none;
	}
</style>
