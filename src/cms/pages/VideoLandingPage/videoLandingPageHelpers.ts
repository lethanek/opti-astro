export function formatDuration(seconds?: number | null): string | null {
    if (!seconds || seconds <= 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const VIDEO_TYPE_LABELS: Record<string, string> = {
    demo: 'Demo',
    webinar: 'Webinar',
    customer_story: 'Customer Story',
    product_tour: 'Product Tour',
    explainer: 'Explainer',
    event_recording: 'Event Recording',
    training: 'Training',
};

export function videoTypeLabel(value?: string | null): string {
    if (!value) return '';
    return VIDEO_TYPE_LABELS[value] ?? value;
}
