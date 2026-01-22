let serviceWorkerRegistrationMutexName = 'mutex-root-service-worker-registration';
let requiredRootServiceWorkerVersion = '1.0.0';
let serviceWorkerScriptPath = 'plugin-service-worker.js';
let serviceWorkerScope = './';

let GET_SERVICE_WORKER_VERSION_TIME_LIMIT = 5000;
let CACHE_RESOURCES_TIME_LIMIT = 30000;
let SW_ACTIVATION_TIME_LIMIT = 10000;
let REGISTRATION_WAITING_TIME_LIMIT = 10000;

class PluginServiceWorkerInterface {
    static async cacheViaCacheManifest(serviceWorkerScriptPath, cacheManifestPath, cacheName=null, cacheVersion=null) {
        if (!navigator.locks) {
            throw new Error("Web Locks API is not supported");
        }

        return await navigator.locks.request(serviceWorkerRegistrationMutexName, async (lock) => {
            const {
                serviceWorker,
                serviceWorkerRegistration
            } = await this.getActualServiceWorkerAndRegistration(serviceWorkerScriptPath);

            const cacheResultData = await postMessageToServiceWorkerViaMessageChannel(serviceWorker, createCacheRequest({
                type: 'CACHE_VIA_CACHE_MANIFEST',
                path: cacheManifestPath
            }, cacheName, cacheVersion), CACHE_RESOURCES_TIME_LIMIT);

            const cacheResult = cacheResultData.result;

            return {cache: cacheResult, serviceWorkerRegistration, serviceWorker};
        });
    }
    static async cacheResourcesList(serviceWorkerScriptPath, resourcesList, cacheName=null, cacheVersion=null) {
        if (!navigator.locks) {
            throw new Error("Web Locks API is not supported");
        }

        return await navigator.locks.request(serviceWorkerRegistrationMutexName, async (lock) => {
            const {
                serviceWorker,
                serviceWorkerRegistration
            } = await this.getActualServiceWorkerAndRegistration(serviceWorkerScriptPath);

            const cacheResultData = await postMessageToServiceWorkerViaMessageChannel(serviceWorker, createCacheRequest({
                type: 'CACHE_RESOURCES_LIST',
                resourcesList
            }, cacheName, cacheVersion), CACHE_RESOURCES_TIME_LIMIT);

            const cacheResult = cacheResultData.result;

            return {cache: cacheResult, serviceWorkerRegistration, serviceWorker};
        });
    }

    static async getActualServiceWorkerAndRegistration(serviceWorkerScriptPath) {
        if (!navigator.serviceWorker) {
            throw new Error("Service workers are not supported");
        }

        let serviceWorker = await this.registerOrGetRootServiceWorker(serviceWorkerScriptPath);
        const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();

        serviceWorker = await this.actualizeServiceWorker(serviceWorker, serviceWorkerScriptPath);

        return {serviceWorker, serviceWorkerRegistration};
    }

    static async registerOrGetRootServiceWorker(serviceWorkerScriptPath) {
        let registration = await navigator.serviceWorker.getRegistration();

        if (registration) {
            return this.waitUntilServiceWorkerIsActivated(registration);
        }

        const newRegistration = await this.registerServiceWorker(serviceWorkerScriptPath);
        if (!newRegistration) {
            const registration = await this.waitForServiceWorkerRegistration();
            return registration.active;
        }
        return this.waitUntilServiceWorkerIsActivated(newRegistration);
    }

    static async actualizeServiceWorker(serviceWorker, serviceWorkerScriptPath) {
        const serviceWorkerVersionData = await postMessageToServiceWorkerViaMessageChannel(serviceWorker, {
            type: 'GET_VERSION'
        }, GET_SERVICE_WORKER_VERSION_TIME_LIMIT);
        const serviceWorkerVersion = serviceWorkerVersionData.result;

        if (this.isServiceWorkerVersionNeedsToBeUpdated(serviceWorkerVersion)) {
            let newRegistration;
            try {
                newRegistration = await this.registerServiceWorker(serviceWorkerScriptPath);
            } catch (e) {
                if (e && e.message === 'Job rejected for non app-bound domain') {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    if (!registrations) {
                        throw e;
                    }

                    await Promise.all(
                        registrations.map(
                            registration => {
                                return registration.unregister();
                            }
                        )
                    );

                    newRegistration = await this.registerServiceWorker(serviceWorkerScriptPath);
                } else {
                    throw e;
                }
            }

            if (!newRegistration) {
                newRegistration = await this.waitForServiceWorkerRegistration();
                return this.actualizeServiceWorker(await this.waitUntilServiceWorkerIsActivated(newRegistration), serviceWorkerScriptPath);
            } else {
                return this.waitUntilServiceWorkerIsActivated(newRegistration);
            }
        }

        return serviceWorker;
    }

    static async registerServiceWorker(serviceWorkerScriptPath) {
        const options = {};
        if (serviceWorkerScope) {
            options.scope = serviceWorkerScope;
        }
        const newRegistration = await navigator.serviceWorker.register(serviceWorkerScriptPath, options);
        return newRegistration;
    }

    static waitForServiceWorkerRegistration() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Registration waiting time limit is reached'));
            }, REGISTRATION_WAITING_TIME_LIMIT);
            navigator.serviceWorker.ready.then((registration) => {
                clearTimeout(timeout);
                return resolve(registration);
            });
        });
    }

    static isServiceWorkerVersionNeedsToBeUpdated(version) {
        if (isNaN(requiredRootServiceWorkerVersion) && requiredRootServiceWorkerVersion !== version) {
            return true;
        }

        if (!isNaN(requiredRootServiceWorkerVersion) && !isNaN(version)) {
            const intVersion = parseInt(version, 10);
            const intRequiredVersion = parseInt(requiredRootServiceWorkerVersion, 10);

            if (intVersion < intRequiredVersion) {
                return true;
            }
        }

        return false;
    }

    static async waitServiceWorkerToBecomeActive(serviceWorker) {
        if (serviceWorker.state === "activated") {
            return serviceWorker;
        }

        let previousState = serviceWorker.state;

        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                serviceWorker.onstatechange = null;
                reject(new Error('Service Worker activation time limit is reached'));
            }, SW_ACTIVATION_TIME_LIMIT);

            serviceWorker.onstatechange = () => {
                if (serviceWorker.state === 'activated') {
                    clearTimeout(timeout);
                    serviceWorker.onstatechange = null;
                    return resolve(serviceWorker);
                }

                if (serviceWorker.state === 'redundant') {
                    serviceWorker.onstatechange = null;
                    return reject('Service Worker became redundant');
                }
            };
        });
    }

    static async waitUntilServiceWorkerIsActivated(registration) {
        let serviceWorker = registration.active;

        if (registration.installing) {
            return this.waitServiceWorkerToBecomeActive(registration.installing);
        } else if (registration.waiting) {
            return this.waitServiceWorkerToBecomeActive(registration.waiting);
        }

        return serviceWorker;
    }

    static getServiceWorkerRegistrationMutexName() {
        return serviceWorkerRegistrationMutexName;
    }

    static setServiceWorkerRegistrationMutexName(name) {
        serviceWorkerRegistrationMutexName = name;
    }

    static getRequiredRootServiceWorkerVersion() {
        return requiredRootServiceWorkerVersion;
    }

    static setRequiredRootServiceWorkerVersion(version) {
        requiredRootServiceWorkerVersion = version;
    }

    static setLogMessageFunction(fn) {
    
    }

    static getServiceWorkerVersionTimeLimit() {
        return GET_SERVICE_WORKER_VERSION_TIME_LIMIT;
    }

    static setServiceWorkerVersionTimeLimit(value) {
        GET_SERVICE_WORKER_VERSION_TIME_LIMIT = value;
    }

    static getCacheResourcesTimeLimit() {
        return CACHE_RESOURCES_TIME_LIMIT;
    }

    static setCacheResourcesTimeLimit(value) {
        CACHE_RESOURCES_TIME_LIMIT = value;
    }

    static getServiceWorkerActivationTimeLimit() {
        return SW_ACTIVATION_TIME_LIMIT;
    }

    static setServiceWorkerActivationTimeLimit(value) {
        SW_ACTIVATION_TIME_LIMIT = value;
    }

    static getRegistrationWaitingTimeLimit() {
        return REGISTRATION_WAITING_TIME_LIMIT;
    }

    static setRegistrationWaitingTimeLimit(value) {
        REGISTRATION_WAITING_TIME_LIMIT = value;
    }

    static getRootServiceWorkerScriptPath() {
        return serviceWorkerScriptPath;
    }

    static setRootServiceWorkerScriptPath(path) {
        serviceWorkerScriptPath = path;
    }

    static getServiceWorkerScope() {
        return serviceWorkerScope;
    }

    static setServiceWorkerScope(value) {
        serviceWorkerScope = value;
    }
}

function createCacheRequest(request, cacheName, cacheVersion) {
    if (cacheName !== null && cacheVersion !== null && !isNaN(cacheVersion) && cacheName.indexOf('#') < 0) {
        request.cacheName = cacheName;
        request.cacheVersion = parseInt(cacheVersion, 10);
    }
    return request;
}

function postMessageToServiceWorkerViaMessageChannel(serviceWorker, content, timeLimit = 5000) {
    return new Promise((resolve, reject) => {
        if (content && content.type) {
        }
        let isProcessed = false;
        const timeLimitTimeout = setTimeout(() => {
            if (!isProcessed) {
                reject(new Error(`Time limit of ${timeLimit}ms is reached`));
            }
        }, timeLimit);

        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
            clearTimeout(timeLimitTimeout);
            const data = event && event.data;
            isProcessed = true;
            resolve(data);
        };
        serviceWorker.postMessage(content, [messageChannel.port2]);
    });
}

if (window.define && window.define.amd) {
    define([], () => PluginServiceWorkerInterface);
} else if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = PluginServiceWorkerInterface;
} else {
    window.PluginServiceWorkerInterface = PluginServiceWorkerInterface;
}