/**
 * In-memory photo cache for the frontend.
 *
 * Stores compressed base64 photo data so that navigating between
 * the swipe page and rankings page doesn't re-download everything.
 *
 * The cache is keyed by room ID, and each room stores a map of
 * photo_id → compressed_data.  A simple LRU-style eviction is used
 * to keep total memory bounded (max ~150 photos across all rooms).
 */

const MAX_CACHED_PHOTOS = 150;

interface CachedPhoto {
  compressed_data: string;
  timestamp: number;
}

class PhotoCache {
  private cache = new Map<string, CachedPhoto>(); // key = `roomId:photoId`
  private roomPhotosKey = new Map<string, any[]>(); // roomId → full photos array
  private roomPhotosTTL = new Map<string, number>(); // roomId → expiry timestamp
  private rankingsData = new Map<string, any[]>(); // roomId → rankings
  private rankingsTTL = new Map<string, number>(); // roomId → expiry timestamp

  // ----- Photo base64 cache -----

  /** Cache a single photo's compressed data */
  setPhoto(roomId: string, photoId: string, compressedData: string) {
    const key = `${roomId}:${photoId}`;
    this.cache.set(key, {
      compressed_data: compressedData,
      timestamp: Date.now(),
    });
    this.evictIfNeeded();
  }

  /** Get a cached photo's compressed data (or null) */
  getPhoto(roomId: string, photoId: string): string | null {
    const key = `${roomId}:${photoId}`;
    const entry = this.cache.get(key);
    if (entry) {
      entry.timestamp = Date.now(); // touch for LRU
      return entry.compressed_data;
    }
    return null;
  }

  /** Bulk-cache photos from an API response */
  cachePhotos(roomId: string, photos: any[]) {
    for (const photo of photos) {
      const id = photo._id || photo.id || photo.photo_id;
      if (id && photo.compressed_data) {
        this.setPhoto(roomId, id, photo.compressed_data);
      }
    }
  }

  // ----- Room photos list cache (avoids full re-fetch) -----

  setRoomPhotos(roomId: string, photos: any[], ttlMs: number = 60_000) {
    this.roomPhotosKey.set(roomId, photos);
    this.roomPhotosTTL.set(roomId, Date.now() + ttlMs);
  }

  getRoomPhotos(roomId: string): any[] | null {
    const expiry = this.roomPhotosTTL.get(roomId);
    if (expiry && Date.now() < expiry) {
      return this.roomPhotosKey.get(roomId) || null;
    }
    this.roomPhotosKey.delete(roomId);
    this.roomPhotosTTL.delete(roomId);
    return null;
  }

  invalidateRoomPhotos(roomId: string) {
    this.roomPhotosKey.delete(roomId);
    this.roomPhotosTTL.delete(roomId);
  }

  // ----- Rankings cache -----

  setRankings(roomId: string, rankings: any[], ttlMs: number = 30_000) {
    this.rankingsData.set(roomId, rankings);
    this.rankingsTTL.set(roomId, Date.now() + ttlMs);
  }

  getRankings(roomId: string): any[] | null {
    const expiry = this.rankingsTTL.get(roomId);
    if (expiry && Date.now() < expiry) {
      return this.rankingsData.get(roomId) || null;
    }
    this.rankingsData.delete(roomId);
    this.rankingsTTL.delete(roomId);
    return null;
  }

  invalidateRankings(roomId: string) {
    this.rankingsData.delete(roomId);
    this.rankingsTTL.delete(roomId);
  }

  // ----- Eviction -----

  private evictIfNeeded() {
    if (this.cache.size <= MAX_CACHED_PHOTOS) return;

    // Sort by timestamp ascending, remove oldest
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = entries.length - MAX_CACHED_PHOTOS;
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /** Clear everything (e.g., on logout) */
  clear() {
    this.cache.clear();
    this.roomPhotosKey.clear();
    this.roomPhotosTTL.clear();
    this.rankingsData.clear();
    this.rankingsTTL.clear();
  }
}

// Singleton instance shared across the app
export const photoCache = new PhotoCache();
