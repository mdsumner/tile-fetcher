/**
 * TileFetcher - Simple raster tile fetcher using a GDAL warp tile API
 *
 * Installation:
 *   Option 1 - Script tag (via jsDelivr CDN):
 *     <script src="https://cdn.jsdelivr.net/gh/USER/REPO@main/tile-fetcher.js"></script>
 *     Then use: const fetcher = new TileFetcher({ endpoint: '...' });
 *
 *   Option 2 - ES module:
 *     <script type="module">
 *       import 'https://cdn.jsdelivr.net/gh/USER/REPO@main/tile-fetcher.js';
 *       const fetcher = new TileFetcher({ endpoint: '...' });
 *     </script>
 *
 * Requirements:
 *   The endpoint must accept GET requests with these query parameters:
 *   - bbox: Bounding box as "xmin,ymin,xmax,ymax" in target CRS units
 *   - crs: Target coordinate reference system as PROJ4 string or EPSG code
 *   - source: GDAL-readable data source path (e.g., /vsicurl/https://... for remote COGs,
 *      or WMTS:... for tile image servers)
 *   - bands: Comma-separated band indices (e.g., "1" or "1,2,3")
 *   - width: Output image width in pixels
 *   - height: Output image height in pixels
 *
 *   The endpoint must return a PNG image warped to the requested bbox/crs/size.
 *   Server-side GDAL handles format decoding, reprojection, and resampling.
 *
 * Usage:
 *   const fetcher = new TileFetcher({ endpoint: 'https://your-endpoint.com/tile' });
 *   const img = await fetcher.fetch({
 *     bbox: [xmin, ymin, xmax, ymax],
 *     crs: '+proj=tmerc +lat_0=0 +lon_0=115 ...',
 *     source: '/vsicurl/https://example.com/data.tif',
 *     width: 512,
 *     height: 512
 *   });
 *   ctx.drawImage(img, 0, 0);
 */

class TileFetcher {
    constructor(options = {}) {
        if (!options.endpoint) {
            throw new Error('TileFetcher requires an endpoint URL');
        }
        this.endpoint = options.endpoint;
        this.defaultWidth = options.width || 512;
        this.defaultHeight = options.height || 512;
        this.defaultBands = options.bands || '1,2,3';
        this.cache = new Map();
        this.cacheEnabled = options.cache !== false;
        this.maxCacheSize = options.maxCacheSize || 50;
    }

    /**
     * Build URL for tile request
     */
    buildUrl(params) {
        const { bbox, crs, source, bands, width, height } = params;
        const urlParams = new URLSearchParams({
            bbox: Array.isArray(bbox) ? bbox.join(',') : bbox,
            crs: crs,
            source: source,
            bands: bands || this.defaultBands,
            width: width || this.defaultWidth,
            height: height || this.defaultHeight
        });
        return `${this.endpoint}?${urlParams.toString()}`;
    }

    /**
     * Generate cache key from params
     */
    cacheKey(params) {
        return JSON.stringify({
            bbox: params.bbox,
            crs: params.crs,
            source: params.source,
            bands: params.bands || this.defaultBands,
            width: params.width || this.defaultWidth,
            height: params.height || this.defaultHeight
        });
    }

    /**
     * Fetch tile and return as ImageBitmap
     * @param {Object} params - { bbox, crs, source, bands?, width?, height? }
     * @returns {Promise<ImageBitmap>}
     */
    async fetch(params) {
        const key = this.cacheKey(params);

        // Check cache
        if (this.cacheEnabled && this.cache.has(key)) {
            return this.cache.get(key);
        }

        const url = this.buildUrl(params);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Tile fetch failed: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const img = await createImageBitmap(blob);

        // Cache result
        if (this.cacheEnabled) {
            if (this.cache.size >= this.maxCacheSize) {
                // Remove oldest entry
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(key, img);
        }

        return img;
    }

    /**
     * Fetch tile and draw directly to canvas context
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params - { bbox, crs, source, bands?, width?, height? }
     * @param {number} x - Canvas x position (default 0)
     * @param {number} y - Canvas y position (default 0)
     */
    async fetchAndDraw(ctx, params, x = 0, y = 0) {
        const img = await this.fetch(params);
        ctx.drawImage(img, x, y);
        return img;
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Make available globally for browser script tag usage
// For ES modules, use: import TileFetcher from 'https://esm.sh/gh/USER/REPO/tile-fetcher.js'
if (typeof window !== 'undefined') {
    window.TileFetcher = TileFetcher;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TileFetcher;
}
