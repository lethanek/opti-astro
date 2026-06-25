/**
 * Helper functions for formatting and extracting data from search results
 */

/**
 * Format a date string according to locale
 */
export function formatDate(dateString: string, locale: string = 'en'): string {
	const date = new Date(dateString);
	return date.toLocaleDateString(locale, {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

/**
 * Truncate HTML content to a specified length
 */
export function getExcerpt(html: string, maxLength: number = 200): string {
	const text = html?.replace(/<[^>]*>/g, '') || '';
	return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Get the title for any content type (ArticlePage or Experience)
 */
export function getTitle(result: any): string {
	if (result.__contentType === 'Experience') {
		// Try SEO MetaTitle first, then displayName
		return result.BlankExperienceSeoSettings?.MetaTitle || result._metadata?.displayName || 'Untitled';
	}
	if (result.__contentType === 'EmployeeBio') {
		// Build full name from FirstName + LastName, fall back to displayName
		const fullName = `${result.FirstName || ''} ${result.LastName || ''}`.trim();
		return fullName || result._metadata?.displayName || 'Untitled';
	}
	// ArticlePage
	return result.Heading || result._metadata?.displayName || 'Untitled';
}

/**
 * Get the excerpt/description for any content type (ArticlePage or Experience)
 */
export function getContentExcerpt(result: any): string {
	if (result.__contentType === 'Experience') {
		// Try SEO MetaDescription first, then _fulltext
		if (result.BlankExperienceSeoSettings?.MetaDescription) {
			return result.BlankExperienceSeoSettings.MetaDescription;
		}
		// Use _fulltext as fallback (it's an array, join and truncate)
		const fulltext = Array.isArray(result._fulltext) ? result._fulltext.join(' ') : (result._fulltext || '');
		return getExcerpt(fulltext, 200);
	}
	if (result.__contentType === 'EmployeeBio') {
		// Use the Bio rich text, truncated
		return result.Bio?.html ? getExcerpt(result.Bio.html) : '';
	}
	// ArticlePage
	return result.Body?.html ? getExcerpt(result.Body.html) : '';
}

/**
 * Check if a result is an Experience content type
 */
export function isExperience(result: any): boolean {
	return result.__contentType === 'Experience';
}

/**
 * Check if a result is an EmployeeBio content type
 */
export function isEmployeeBio(result: any): boolean {
	return result.__contentType === 'EmployeeBio';
}

/**
 * Get a subtitle for a result (e.g. job title for an EmployeeBio, subheading for an ArticlePage)
 */
export function getSubtitle(result: any): string {
	if (result.__contentType === 'EmployeeBio') {
		return result.JobTitle || '';
	}
	if (result.__contentType === 'Experience') {
		return '';
	}
	// ArticlePage
	return result.SubHeading || '';
}

/**
 * Get image URL from a search result
 * Returns the PromoImage URL for ArticlePage, SharingImage for Experience, or null if missing
 * Handles both Content Reference URLs (url.default) and DAM asset URLs (item.Url)
 */
export function getImageUrl(result: any): string | null {
	if (result.__contentType === 'Experience') {
		// Experience: get SharingImage from SEO settings
		// Try Content Reference URL first, then DAM asset URL
		return result.BlankExperienceSeoSettings?.SharingImage?.url?.default ||
		       result.BlankExperienceSeoSettings?.SharingImage?.item?.Url ||
		       null;
	}
	if (result.__contentType === 'EmployeeBio') {
		// EmployeeBio: get Headshot
		// Try Content Reference URL first, then DAM asset URL
		return result.Headshot?.url?.default ||
		       result.Headshot?.item?.Url ||
		       null;
	}
	// ArticlePage: get PromoImage
	// Try Content Reference URL first, then DAM asset URL
	return result.PromoImage?.url?.default ||
	       result.PromoImage?.item?.Url ||
	       null;
}

/**
 * Get image alt text from a search result
 */
export function getImageAlt(result: any): string {
	if (result.__contentType === 'Experience') {
		// Experience: get alt text from SharingImage
		return result.BlankExperienceSeoSettings?.SharingImage?.item?.AltText ||
		       result.BlankExperienceSeoSettings?.SharingImage?.item?._metadata?.displayName ||
		       getTitle(result);
	}
	if (result.__contentType === 'EmployeeBio') {
		// EmployeeBio: get alt text from Headshot, fall back to the person's name
		return result.Headshot?.item?.AltText ||
		       result.Headshot?.item?._metadata?.displayName ||
		       getTitle(result);
	}
	// ArticlePage: get alt text from PromoImage
	return result.PromoImage?.item?.AltText || result.PromoImage?.item?._metadata?.displayName || getTitle(result);
}

/**
 * Generate a deterministic gradient class based on content title
 * Returns consistent colors for the same title (for placeholders)
 */
export function getPlaceholderGradient(result: any): string {
	const title = getTitle(result);
	// Simple hash function to get a number from the title
	let hash = 0;
	for (let i = 0; i < title.length; i++) {
		hash = ((hash << 5) - hash) + title.charCodeAt(i);
		hash = hash & hash; // Convert to 32-bit integer
	}

	// Use hash to pick from predefined gradient combinations
	const gradients = [
		'bg-gradient-to-br from-primary/20 to-secondary/20',
		'bg-gradient-to-br from-accent/20 to-primary/20',
		'bg-gradient-to-br from-secondary/20 to-accent/20',
		'bg-gradient-to-br from-info/20 to-primary/20',
		'bg-gradient-to-br from-success/20 to-secondary/20',
		'bg-gradient-to-br from-primary/20 to-accent/20',
		'bg-gradient-to-br from-secondary/20 to-info/20',
		'bg-gradient-to-br from-accent/20 to-success/20',
	];

	const index = Math.abs(hash) % gradients.length;
	return gradients[index];
}
