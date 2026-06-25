<script lang="ts">
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
