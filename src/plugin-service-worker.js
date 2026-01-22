
const CACHE_IDENTIFIER_SEPARATOR = '#v'
const FETCH_RETRY_ATTEMPTS_NUMBER = 10;
const FETCH_RETRY_PAUSE = 1000;

let VERSION = '1.0.0';

if (!isNaN(VERSION)) {
    VERSION = parseInt(VERSION, 10);
}

addEventListener('message', async event => {
    const data = event.data || {};

    if (!data.type) {
        return;
    }

    if (!event.ports[0]) {
        return;
    }

    let result;

    switch (data.type) {
        case 'GET_VERSION':
            event.ports[0].postMessage({type: 'GET_VERSION_RESPONSE', result: VERSION});
            break;
        case 'CACHE_VIA_CACHE_MANIFEST':
            result = await cacheViaCacheManifestOrResourcesList(event.source.url, data.path, data.cacheName, data.cacheVersion);
            event.ports[0].postMessage({type: 'CACHE_VIA_CACHE_MANIFEST_RESPONSE', result});
            break;
        case 'CACHE_RESOURCES_LIST':
            result = await cacheViaCacheManifestOrResourcesList(event.source.url, data.resourcesList, data.cacheName, data.cacheVersion);
            event.ports[0].postMessage({type: 'CACHE_VIA_CACHE_MANIFEST_RESPONSE', result});
            break;
        default:
            break;
    }
});

addEventListener('install', (event) => {
    self.skipWaiting();
});

addEventListener('activate', (event) => {
});

addEventListener('fetch', e => {
    e.respondWith(
        (async function () {
            const fetchStrategy = chooseFetchStrategy(e.request);

            return fetchStrategy(e.request);
        }())
    );
});

async function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function fetchAsset(assetUrl, params = {}) {
    let latestResponse;
    for (let retryCount = 0; retryCount < FETCH_RETRY_ATTEMPTS_NUMBER; ++retryCount) {
        try {
            const response = latestResponse = await fetch(assetUrl, params);

            switch (response.status) {
                case 200:
                    return {
                        response: response,
                        asset: assetUrl,
                        success: true,
                        statusCode: response.status,
                        statusText: response.statusText
                    }
                case 502:
                case 503:
                    await wait(FETCH_RETRY_PAUSE);
                    break;

                default:
                    return {
                        response: response,
                        asset: assetUrl,
                        success: false,
                        statusCode: response.status,
                        statusText: response.statusText
                    }
            }
        } catch (e) {
            return {
                response: null,
                asset: assetUrl,
                success: false,
                statusCode: 0,
                statusText: e.message
            };
        }
    }

    return {
        response: latestResponse,
        asset: assetUrl,
        success: false,
        statusCode: latestResponse && latestResponse.status || 0,
        statusText: latestResponse && latestResponse.statusText || 'Unexpected error'
    }
}

async function cacheViaCacheManifestOrResourcesList(sourcePath, manifestPathOrResourcesList, cacheName = undefined, cacheVersion = undefined) {
    if (!shouldCache(sourcePath)) {
        return {
            status: 'skipped',
            reason: 'URL not eligible for caching',
            cacheName,
            cacheVersion,
            cachedItems: [],
            failedItems: []
        };
    }

    if (cacheName === undefined || cacheVersion === undefined) {
        const resolvedCacheNameAndVersion = resolveCacheNameAndVersion(sourcePath);
        if (resolvedCacheNameAndVersion) {
            if (cacheName === undefined) {
                cacheName = resolvedCacheNameAndVersion[0];
            }
            if (cacheVersion === undefined) {
                cacheVersion = resolvedCacheNameAndVersion[1];
            }
        }
    }

    if (cacheName === null || cacheName === undefined || cacheName === '' || cacheName === false || (cacheName && cacheName.indexOf && cacheName.indexOf('#') >= 0)) {
        return {
            status: 'failed',
            failReason: 'Cache name is undefined',
            cachedItems: [],
            failedItems: [],
            cacheName,
            cacheVersion,
            serviceWorkerVersion: VERSION
        };
    }

    if (cacheVersion === null || cacheVersion === undefined || cacheVersion === '' || cacheVersion === false) {
        return {
            status: 'failed',
            failReason: 'Cache version is undefined',
            cachedItems: [],
            failedItems: [],
            cacheName,
            cacheVersion,
            serviceWorkerVersion: VERSION
        };
    }

    const cacheList = await getCacheList();
    const cacheId = getCacheId(cacheName, cacheVersion);

    if (cacheList[cacheName] && cacheList[cacheName][cacheVersion]) {
        const existingCache = await caches.open(cacheId);
        const existingCacheKeys = await existingCache.keys();
        return {
            status: 'notChanged',
            cachedItems: existingCacheKeys.map(request => request.url),
            failedItems: [],
            cacheName,
            cacheVersion,
            serviceWorkerVersion: VERSION
        };
    }

    let cacheAssets;

    if (manifestPathOrResourcesList instanceof Array) {
        cacheAssets = manifestPathOrResourcesList;
    } else {
        try {
            const absoluteManifestPath = new URL(manifestPathOrResourcesList, sourcePath).href;
            const manifestFetchResult = await fetch(absoluteManifestPath);
            const manifestText = await manifestFetchResult.text();
            cacheAssets = getCacheAssetsFromManifest(manifestText);
        } catch (e) {
            return {
                status: 'failed',
                failReason: 'Unable to fetch appcache manifest',
                cachedItems: [],
                failedItems: [],
                cacheName,
                cacheVersion,
                serviceWorkerVersion: VERSION
            };
        }
    }

    const cache = await caches.open(cacheId);

    if (!cacheList[cacheName]) {
        cacheList[cacheName] = {};
    }

    cacheList[cacheName][cacheVersion] = {
        id: cacheId,
        name: cacheName,
        version: cacheVersion
    };

    let cachedItems = [];
    let failedItems = [];

    await Promise.all(cacheAssets.map(cacheAsset => new URL(cacheAsset, sourcePath).href)
        .map(asset => fetchAsset(asset, {cache: "no-store"}).then(result => {
            if (result.success) {
                cachedItems.push(result.asset);
                return cache.put(result.asset, result.response);
            } else {
                failedItems.push({asset: result.asset, error: result.statusCode, errorText: result.statusText});
            }
        })));

    if (failedItems.length > 0) {
        await caches.delete(cacheList[cacheName].id);
        delete cacheList[cacheName][cacheVersion];

        return {
            status: 'failed',
            failReason: 'Unable to fetch all resources',
            cachedItems: [],
            failedItems,
            cacheName,
            cacheVersion,
            serviceWorkerVersion: VERSION
        };
    }

    if (cacheList[cacheName]) {
        const allCacheVersions = Object.values(cacheList[cacheName]);
        for (let versionedCacheData of allCacheVersions) {
            if (versionedCacheData.version !== cacheVersion) {
                await caches.delete(versionedCacheData.id);
            }
        }
    }

    return {
        status: 'success',
        cacheName,
        cacheVersion,
        cachedItems,
        failedItems: [],
        serviceWorkerVersion: VERSION
    };
}

const fetchStrategies = {
    cacheFirstThenNetwork: async (request) => {
        const cacheMatch = await caches.match(request);

        if (cacheMatch) {
            return cacheMatch;
        }

        return fetchStrategies.networkOnly(request);
    },

    networkOnly: async (request) => {
        const result = await fetchAsset(request);
        return result.response;
    }
};

async function getCacheList() {
    const cacheNames = await caches.keys();

    let loadedCacheList = {};
    cacheNames.forEach(cacheIdentifier => {
        if (cacheIdentifier.indexOf(CACHE_IDENTIFIER_SEPARATOR) < 0) {
            return;
        }

        const identifierParts = cacheIdentifier.split(CACHE_IDENTIFIER_SEPARATOR);

        if (identifierParts.length !== 2) {
            return;
        }

        const cacheName = identifierParts[0];
        const cacheVersion = identifierParts[1];

        if (isNaN(cacheVersion) && !cacheVersion.match(/^[0-9.]+$/)) {
            return;
        }

        if (!loadedCacheList[cacheName]) {
            loadedCacheList[cacheName] = {};
        }

        loadedCacheList[cacheName][cacheVersion] = {
            id: `${cacheIdentifier}`,
            name: `${cacheName}`,
            version: `${cacheVersion}`
        };
    });

    return loadedCacheList;
}

function getCacheId(name, version) {
    return `${name}${CACHE_IDENTIFIER_SEPARATOR}${version}`;
}

function shouldCache(url) {
    return !url.includes('maps.googleapis.com') && 
           !url.includes('google.com') &&
           !url.includes('gstatic.com');
}

function chooseFetchStrategy(request) {
    if (!shouldCache(request.url)) {
        return fetchStrategies.networkOnly;
    }
    if (request.method === 'GET') {
        return fetchStrategies.cacheFirstThenNetwork;
    } else if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
        return fetchStrategies.networkOnly;
    }
    return fetchStrategies.networkOnly;
}

function resolveCacheNameAndVersion(sourcePath) {
    const hostedPluginResult = sourcePath.match(/\/hosted-plugins\/([\w-_.]+)\/([0-9]+)-\w{16}\/([0-9]+)-\w{64}\/.*/);
    if (hostedPluginResult) {
        const instanceName = hostedPluginResult[1];
        const pluginId = hostedPluginResult[2];
        const pluginVersion = parseInt(hostedPluginResult[3], 10);
        const pluginName = `${instanceName}_p${pluginId}`;
        return [pluginName, pluginVersion];
    }
    const standardPluginResult = sourcePath.match(/\/plugins\/([\w-_.]+)\/([0-9.]+)\/.*/);
    if (standardPluginResult) {
        const pluginName = standardPluginResult[1];
        const pluginVersion = standardPluginResult[2];
        return [pluginName, pluginVersion];
    }
    return null;
}

function getCacheAssetsFromManifest(manifestContent) {
    const parsedManifest = parseAppCacheManifest(manifestContent);
    return parsedManifest.cache;
}

function parseAppCacheManifest(manifestContent) {
    let currentSection = 'cache';

    let result = {
        cache: [],
        network: [],
        fallback: {},
        settings: []
    };

    const lines = manifestContent.split(/\n|\r|\r\n/);
    for (let lineNumber = 1; lineNumber < lines.length; ++lineNumber) {
        let line = lines[lineNumber].trim();

        if (!line || line[0] === '#') {
            continue;
        }

        if (['CACHE:', 'NETWORK:', 'FALLBACK:', 'SETTINGS:'].includes(line)) {
            currentSection = line.substr(0, line.length - 1).toLowerCase();
        } else if (line.substr(line.length - 1) !== ':') {
            if (currentSection === 'fallback') {
                const contentParts = line.split(/ +/);
                result.fallback[contentParts[0]] = contentParts[1];
            } else {
                result[currentSection].push(line);
            }
        }
    }

    return result;
}