/**
 * Utility to handle Google Drive URLs and convert them to direct-viewable links
 * for img or video tags.
 */

export function getDriveDirectLink(url: string): string {
    if (!url || typeof url !== 'string') return url;

    // Matches standard Drive sharing links
    const driveRegex = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/;
    const match = url.match(driveRegex);

    if (match && match[1]) {
        const fileId = match[1];
        // Using the bypass/universal preview link which works better for mixed content
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    return url;
}

export function getMediaType(url: string, explicitType?: 'image' | 'video'): 'image' | 'video' {
    if (explicitType) return explicitType;

    // If it's a drive link, we might not know the type from the extension
    // But we can guess or default to image
    const isVideoExtension = url.match(/\.(mp4|webm|ogg|mov)$/i);
    if (isVideoExtension) return 'video';

    // If it's a drive link and not explicitly video, assume image for now
    // (Actual detection would require an API call or metadata)
    return 'image';
}
