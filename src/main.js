function showAlert(message) {
    const popup = document.getElementById('custom-popup');
    const messageContainer = popup.querySelector('.popup-message');
    messageContainer.textContent = message;
    popup.style.display = 'block';
    document.activeElement.blur();
}

function closePopup() {
    document.getElementById('custom-popup').style.display = 'none';
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.key === 'Enter') {
        closePopup();
    }
});

const API_BASE_URL = "http://localhost:8000/api";

function loadGoogleMapsAPI() {
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places&loading=async&callback=initializeMap';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGoogleMapsAPI);
} else {
    loadGoogleMapsAPI();
}

(function ($) {
    $(document).ready(function () {
        var plugin = window._plugin = new OfsPlugin(true);
        plugin.init();
    });
})(jQuery);

function fetchWithAuth(url, options = {}) {
    const username = "u7Qw9z!2pL4vXr6s";
    const password = "A3$k8z!mQ2@vXr7pL4w9Zb6sT1#nJ5eR";
    const headers = options.headers || {};
    headers["Authorization"] = "Basic " + btoa(`${username}:${password}`);
    return fetch(url, { ...options, headers });
}

let map;
let userLocationMarker = null;

const ICONS = {
    chamberNearby: "./icons/chamber.svg",
    splice: "./icons/splice.svg",
    chamber: "./icons/chamber.svg",
    originLocation: "./icons/location-pin.svg",
    central: "./icons/central.svg",
    nearbyNode: "./icons/node-nearby.svg",
    reachableNode: "./icons/node-reachable.svg",
    loop: "./icons/loop.svg",
    currentLocation: "./icons/current-location.svg",
};

function processActivityData(latitude, longitude, distance, wireName) {
    if (!isNaN(latitude) && !isNaN(longitude)) {
        const customLocation = { latitude, longitude };
        if (window.activityMarker) {
            window.activityMarker.setMap(null);
        }
        window.activityMarker = new google.maps.Marker({
            position: customLocation,
            map,
            icon: {
                url: ICONS.originLocation,
                scaledSize: new google.maps.Size(24, 24),
            },
        });
        map.setCenter(customLocation);
        if (!isNaN(distance) && distance > 0) {
            const distanceInput = document.getElementById('distance');
            if (distanceInput) {
                distanceInput.value = distance;
            }
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) loadingOverlay.style.display = 'flex';
            calculateFailurePoint(latitude, longitude, distance, wireName);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    showLoadingOverlay();
    var requestDiv = document.querySelector('.json__request');

    function processRequestDiv() {
        var requestData = requestDiv ? requestDiv.textContent.trim() : '';
        if (!requestData) {
            return;
        }
        try {
            if (!/^[{|[]/.test(requestData)) {
                return;
            }
            var requestJson = JSON.parse(requestData);
            if (requestJson && requestJson.activity) {
                const longitude = requestJson.activity.acoord_x;
                const latitude = requestJson.activity.acoord_y;
                const distance = requestJson.activity.XA_distance;
                const wireName = requestJson.activity.XA_wire_name;
                const activityId = requestJson.activity.aid;

                document.getElementById('info-longitude').textContent = longitude ?? '-';
                document.getElementById('info-latitude').textContent = latitude ?? '-';
                document.getElementById('info-distance').textContent = distance ?? '-';
                document.getElementById('info-wire-name').textContent = wireName ?? '-';
                document.getElementById('info-activity-id').textContent = activityId ?? '-';

                if (!isNaN(latitude) && !isNaN(longitude)) {
                    window.activityCoords = { latitude, longitude, distance, activityId, wireName };
                    const distanceInput = document.getElementById('distance');
                    const wireNameInput = document.getElementById('wire-name');
                    if (distanceInput && distance && !isNaN(parseFloat(distance))) {
                        distanceInput.value = distance;
                    }
                    if (wireNameInput && wireName) {
                        wireNameInput.value = wireName;
                    }
                    if (window.map) {
                        processActivityData(latitude, longitude, distance, wireName);
                    }
                }
            }
        } catch (e) {
            if (requestData && requestData !== "") {
            }
        }
    }

    if (requestDiv) {
        processRequestDiv();
        var observer = new MutationObserver(processRequestDiv);
        observer.observe(requestDiv, { childList: true, subtree: true, characterData: true });
    }

    const toggleCentral = document.getElementById('toggle-central');
    const groupCentrals = document.getElementById('group-centrals-select');
    const groupAddress = document.getElementById('group-autocomplete-address');
    const centralsSelect = document.getElementById('centrals-select');

    function updateSearchMode() {
        if (toggleCentral.checked) {
            groupCentrals.style.display = '';
            groupAddress.style.display = 'none';
        } else {
            groupCentrals.style.display = 'none';
            groupAddress.style.display = '';
            if (window.initializeAutocomplete && !window.autocompleteInitialized) {
                setTimeout(() => {
                    window.initializeAutocomplete();
                }, 100);
            }
        }
        centralsSelect.value = '';
        const autocompleteElement = document.querySelector('gmp-place-autocomplete');
        if (autocompleteElement) {
            autocompleteElement.value = '';
        }
    }

    updateSearchMode();

    toggleCentral.addEventListener('change', updateSearchMode);
});

function showLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

function loadCentrals() {
    const selectElement = document.getElementById('centrals-select');

    if (!selectElement) {
        hideLoadingOverlay();
        return;
    }

    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    fetchWithAuth(`${API_BASE_URL}/all_centrals`)
        .then(res => res.json())
        .then(data => {
            if (data && data.features && Array.isArray(data.features)) {
                data.features.forEach(feature => {
                    if (feature.geometry &&
                        feature.geometry.coordinates &&
                        feature.properties &&
                        feature.properties.name &&
                        feature.properties.address) {
                        const longitude = feature.geometry.coordinates[0];
                        const latitude = feature.geometry.coordinates[1];
                        const name = feature.properties.name || 'No name';
                        const address = feature.properties.address || 'No address';
                        const option = document.createElement('option');
                        option.value = JSON.stringify({ latitude, longitude });
                        option.textContent = `${name} - ${address}`;
                        selectElement.appendChild(option);
                    }
                });
            }
            hideLoadingOverlay();
        })
        .catch(error => {
            showAlert('Error loading the list of centrals');
            hideLoadingOverlay();
        });
}

function initializeMap() {
    map = window.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 4.65, lng: -74.1 },
        zoom: 17,
    });
    function initializeAutocomplete() {
        const autocompleteInput = document.getElementById('autocomplete-address');
        if (!autocompleteInput || window.autocompleteInitialized) {
            return;
        }
        
        if (window.google && google.maps && google.maps.places) {
            try {
                const autocompleteElement = new google.maps.places.PlaceAutocompleteElement({
                    componentRestrictions: { country: 'co' },
                    fields: ['geometry', 'formatted_address']
                });
                
                if (autocompleteInput.placeholder) {
                    autocompleteElement.placeholder = autocompleteInput.placeholder;
                }
                autocompleteElement.className = autocompleteInput.className;
                
                autocompleteInput.parentNode.replaceChild(autocompleteElement, autocompleteInput);
                
                autocompleteElement.addEventListener('gmp-placeselect', (event) => {
                    const place = event.place;
                    if (place.geometry && place.geometry.location) {
                        map.setCenter(place.geometry.location);
                        map.setZoom(17);
                    }
                });
                
                window.autocompleteInitialized = true;
            } catch (error) {
                const autocomplete = new google.maps.places.Autocomplete(autocompleteInput, {
                    types: ['geocode'],
                    componentRestrictions: { country: 'co' }
                });
                autocomplete.addListener('place_changed', function () {
                    const place = autocomplete.getPlace();
                    if (place.geometry && place.geometry.location) {
                        map.setCenter(place.geometry.location);
                        map.setZoom(17);
                    }
                });
                window.autocompleteInitialized = true;
            }
        }
    }
    
    const groupAddress = document.getElementById('group-autocomplete-address');
    if (groupAddress && groupAddress.style.display !== 'none') {
        initializeAutocomplete();
    }
    
    window.initializeAutocomplete = initializeAutocomplete;

    const kingfisherLogo = document.querySelector('.header__logo');
    if (kingfisherLogo) {
        kingfisherLogo.style.cursor = 'pointer';
        kingfisherLogo.addEventListener('click', function() {
            ensureMapControls();
        });
    }

    loadCentrals();

    const centralsSelect = document.getElementById('centrals-select');
    if (centralsSelect) {
        centralsSelect.addEventListener('change', function (e) {
            if (e.target.value) {
                try {
                    const coords = JSON.parse(e.target.value);
                    if (coords.latitude && coords.longitude) {
                        map.setCenter({ lat: coords.latitude, lng: coords.longitude });
                        map.setZoom(17);
                    }
                } catch (error) {
                }
            }
        });
    }

    if (window.activityCoords) {
        const { latitude, longitude, distance, activityId, wireName } = window.activityCoords;
        processActivityData(latitude, longitude, distance, wireName);
    }

    map.addListener("zoom_changed", () => {
        const zoomLevel = map.getZoom();
        const iconSize = zoomLevel < 10 ? 4 : 16;
        if (window.chambersMarkers) {
            window.chambersMarkers.forEach((marker) => {
                marker.setIcon({
                    url: ICONS.chamberNearby,
                    scaledSize: new google.maps.Size(iconSize, iconSize),
                });
            });
        }
    });

    document.getElementById('calculate-failure').addEventListener('click', () => {
        if (!currentLocationWatchId && navigator.geolocation) {
            startCurrentLocationTracking();
        }
        showLoadingOverlay();
        const distanceInput = document.getElementById('distance');
        const autocompleteElement = document.querySelector('gmp-place-autocomplete');
        const centralsSelect = document.getElementById('centrals-select');
        const wireNameInput = document.getElementById('wire-name');
        const useActivityCoords = document.getElementById('use-activity-coords');
        let wireName = '';

        if (wireNameInput && wireNameInput.value) {
            wireName = wireNameInput.value.trim();
        }

        if (!wireName) {
            const infoWireName = document.getElementById('info-wire-name');
            if (infoWireName && infoWireName.textContent) {
                wireName = infoWireName.textContent.trim();
            } else if (window.activityCoords && window.activityCoords.wireName) {
                wireName = window.activityCoords.wireName;
            }
        }

        const distance = parseFloat(distanceInput.value);
        const address = autocompleteElement ? autocompleteElement.value : '';
        const selectedCentral = centralsSelect.value;

        if (!address && !selectedCentral && distance) {
            if (useActivityCoords && useActivityCoords.checked) {
                const latitude = parseFloat(document.getElementById('info-latitude').textContent);
                const longitude = parseFloat(document.getElementById('info-longitude').textContent);
                if (!isNaN(latitude) && !isNaN(longitude)) {
                    calculateFailurePoint(latitude, longitude, distance, wireName);
                    hideLoadingOverlay();
                    return;
                } else {
                    showAlert('No activity coordinates are available.');
                    hideLoadingOverlay();
                    return;
                }
            } else {
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const latitude = position.coords.latitude;
                            const longitude = position.coords.longitude;
                            calculateFailurePoint(latitude, longitude, distance, wireName);
                            hideLoadingOverlay();
                        },
                        (error) => {
                            showAlert('Unable to get the current location. Please enter an address.');
                            hideLoadingOverlay();
                        }
                    );
                    return;
                } else {
                    showAlert('Your browser does not support geolocation. Please enter an address.');
                    hideLoadingOverlay();
                    return;
                }
            }
        }

        if (distance <= 0) {
            showAlert('The distance must be greater than 0');
            hideLoadingOverlay();
            return;
        }

        function updateLocationMarker(latitude, longitude) {
            if (userLocationMarker) {
                userLocationMarker.setMap(null);
            }
            userLocationMarker = new google.maps.Marker({
                position: { lat: latitude, lng: longitude },
                map: window.map,
                icon: {
                    url: ICONS.originLocation,
                    scaledSize: new google.maps.Size(24, 24),
                }
            });
            window.map.setCenter({ lat: latitude, lng: longitude });
        }

        if (selectedCentral) {
            try {
                const coords = JSON.parse(selectedCentral);
                updateLocationMarker(coords.latitude, coords.longitude);
                calculateFailurePoint(coords.latitude, coords.longitude, distance, wireName);
                hideLoadingOverlay();
            } catch (error) {
                hideLoadingOverlay();
                showAlert('Error processing the selected coordinates');
            }
        }
        else if (address) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address }, (results, status) => {
                if (status === 'OK') {
                    const location = results[0].geometry.location;
                    const latitude = location.lat();
                    const longitude = location.lng();
                    updateLocationMarker(latitude, longitude);
                    calculateFailurePoint(latitude, longitude, distance, wireName);
                    hideLoadingOverlay();
                } else {
                    showAlert('Unable to find the address: ' + status);
                    hideLoadingOverlay();
                }
            });
        }
        else if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    updateLocationMarker(latitude, longitude);
                    calculateFailurePoint(latitude, longitude, distance, wireName);
                    hideLoadingOverlay();
                },
                (error) => {
                    showAlert('Unable to get the current location. Please enter an address.');
                    hideLoadingOverlay();
                }
            );
        } else {
            showAlert('Your browser does not support geolocation. Please enter an address.');
            hideLoadingOverlay();
        }
    });

    if (window.activityCoords) {
        const { latitude, longitude, distance, activityId, wireName } = window.activityCoords;
        if (!isNaN(latitude) && !isNaN(longitude)) {
        map.setCenter({ lat: latitude, lng: longitude });
            if (!isNaN(distance) && distance > 0) {
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) loadingOverlay.style.display = 'flex';
                calculateFailurePoint(latitude, longitude, distance, wireName);
                if (loadingOverlay) loadingOverlay.style.display = 'none';
            }
        }
    }

    setTimeout(() => {
        initializeElementRegistrationEvents();
    }, 200);
    initializeElementLocationEvents();
}

function ensureMapControls() {
    let controlsDiv = document.getElementById('map-controls');
    if (!controlsDiv) {
        controlsDiv = document.createElement('div');
        controlsDiv.id = 'map-controls';
        controlsDiv.style.position = 'absolute';
        controlsDiv.style.top = '10px';
        controlsDiv.style.right = '10px';
        controlsDiv.style.background = 'rgba(255,255,255,0.95)';
        controlsDiv.style.padding = '10px';
        controlsDiv.style.borderRadius = '8px';
        controlsDiv.style.zIndex = 1000;
        controlsDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        controlsDiv.innerHTML = `
            <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="chk-chambers" checked>
                <img src="${ICONS.chamber}" alt="Chamber" style="width:20px;height:20px;">
                <span>Chambers</span>
            </label><br>
            <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="chk-wires" checked>
                <span style="width:20px;height:20px;display:inline-block;text-align:center;line-height:20px;font-size:16px;">━</span>
                <span>Wires</span>
            </label><br>
            <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="chk-centrals" checked>
                <img src="${ICONS.central}" alt="Central" style="width:20px;height:20px;">
                <span>Centrals</span>
            </label><br>
            <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="chk-splices">
                <img src="${ICONS.splice}" alt="Splice" style="width:20px;height:20px;">
                <span>Splices</span>
            </label><br>
            <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="chk-loops">
                <img src="${ICONS.loop}" alt="Loop" style="width:20px;height:20px;">
                <span>Loops</span>
            </label><br>
            <label style="margin-top:8px;display:block;">Reachable node:
                <select id="select-reachable-node" style="width:220px;margin-top:4px;"></select>
            </label>
            <label style="margin-top:8px;display:block;">Search radius ratio (%):
                <input id="outer-radius-percent" type="number" min="1" max="100" value="25" style="width:60px;"> <span style="font-size:12px;">(distance ratio)</span>
            </label>
            <label style="margin-top:8px;display:block;">Distance discount (%):
                <input id="discount-percent" type="number" min="0" max="100" value="18" style="width:60px;"> <span style="font-size:12px;">(discount percentage)</span>
            </label>
        `;
        const mapDiv = document.getElementById('map');
        if (mapDiv) {
            mapDiv.appendChild(controlsDiv);
        } else {
            document.body.appendChild(controlsDiv);
        }
    }
}

let discountPercent = 18;

function calculateFailurePoint(latitude, longitude, distance, wireName = null) {
    ensureMapControls();
    const discountInput = document.getElementById('discount-percent');
    if (discountInput) {
        discountPercent = parseFloat(discountInput.value) || 0;
    }
    distance = distance * (1 - discountPercent / 100);
    let percentInput = document.getElementById('outer-radius-percent');
    let percent = percentInput ? parseFloat(percentInput.value) : 25;
    if (isNaN(percent) || percent < 1) percent = 25;
    getClosestWire(latitude, longitude, distance, wireName).then(result => {
        if (result && result.features && result.features.length > 0) {
            const feature = result.features[0];
            const distanceMeters = feature.properties && feature.properties.distance_meters ? feature.properties.distance_meters : 0;
            const reachableDistance = distance - distanceMeters;
            const url = `${API_BASE_URL}/reachable_nodes_in_wire_network?longitude=${longitude}&latitude=${latitude}&distance=${reachableDistance}&margin_factor=0.99`;
            fetchWithAuth(url)
                .then(res => res.json())
                .then(nodosResult => {
                    let loadingOverlay = document.getElementById('loading-overlay');
                    if (!nodosResult || nodosResult.status !== 'success' || !nodosResult.features || !Array.isArray(nodosResult.features)) {
                        showAlert('No reachable nodes found in the route.');
                        if (loadingOverlay) loadingOverlay.style.display = 'none';
                        return;
                    }
                    if (!window.reachableNodesMarkers) window.reachableNodesMarkers = [];
                    window.reachableNodesMarkers.forEach(m => m.setMap(null));
                    window.reachableNodesMarkers = [];
                    let closest = null;
                    let minDiff = Infinity;
                    const selectReachableNode = document.getElementById('select-reachable-node');
                    selectReachableNode.innerHTML = '';
                    const distanceMeters = feature.properties && feature.properties.distance_meters ? feature.properties.distance_meters : 0;

                    nodosResult.features.forEach((f, idx) => {
                        const d = f.properties && typeof f.properties.accumulated_distance === 'number' ? f.properties.accumulated_distance : null;
                        const coords = f.geometry && f.geometry.coordinates;
                        if (d !== null && coords) {
                            const diff = Math.abs(d - reachableDistance);
                            if (diff < minDiff) {
                                minDiff = diff;
                                closest = f;
                            }
                        }
                    });

                    nodosResult.features.forEach((f, idx) => {
                        const d = f.properties && typeof f.properties.accumulated_distance === 'number' ? f.properties.accumulated_distance : null;
                        const coords = f.geometry && f.geometry.coordinates;
                        let dTotal = d !== null ? d + distanceMeters : null;
                        if (!coords) return;
                        const option = document.createElement('option');
                        option.value = idx;
                        option.textContent = `${coords[1].toFixed(6)},${coords[0].toFixed(6)} - ${dTotal !== null ? dTotal.toFixed(1) : '?'} m - ${f.properties.wire_name || 'N/A'}`;
                        if (f === closest) option.selected = true;
                        selectReachableNode.appendChild(option);
                    });

                    selectReachableNode.onchange = function () {
                        const idx = parseInt(this.value);
                        const f = nodosResult.features[idx];
                        if (!f) return;
                        const coords = f.geometry && f.geometry.coordinates;
                        if (!coords) return;
                        window.map.setCenter({ lat: coords[1], lng: coords[0] });
                        let percent = percentInput ? parseFloat(percentInput.value) : 25;
                        if (isNaN(percent) || percent < 1) percent = 25;
                        const outerRadius = Math.abs(distance) * (percent / 100);
                        if (document.getElementById('chk-chambers').checked) fetchChambers(coords[1], coords[0], 0, outerRadius);
                        if (document.getElementById('chk-wires').checked) fetchWires(coords[1], coords[0], outerRadius);
                        if (document.getElementById('chk-centrals').checked) fetchCentrals(coords[1], coords[0], outerRadius);
                        if (document.getElementById('chk-splices').checked) fetchSplices(coords[1], coords[0], 0, outerRadius);
                        if (document.getElementById('chk-loops').checked) fetchLoops(coords[1], coords[0], 0, outerRadius);
                    };

                    nodosResult.features.forEach((f, idx) => {
                        const coords = f.geometry && f.geometry.coordinates;
                        if (!coords) return;
                        const isClosest = closest === f;
                        const marker = new google.maps.Marker({
                            position: { lat: coords[1], lng: coords[0] },
                            map: window.map,
                            icon: {
                                url: isClosest ? ICONS.nearbyNode : ICONS.reachableNode,
                                scaledSize: new google.maps.Size(24, 24),
                            },
                            title: isClosest ? 'Closest reachable node' : 'Reachable node'
                        });
                        window.reachableNodesMarkers.push(marker);
                        if (isClosest) {
                            window.map.setCenter({ lat: coords[1], lng: coords[0] });
                            let percent = percentInput ? parseFloat(percentInput.value) : 25;
                            if (isNaN(percent) || percent < 1) percent = 25;
                            const outerRadius = Math.abs(distance) * (percent / 100);
                            if (document.getElementById('chk-chambers').checked) fetchChambers(coords[1], coords[0], 0, outerRadius);
                            if (document.getElementById('chk-wires').checked) fetchWires(coords[1], coords[0], outerRadius);
                            if (document.getElementById('chk-centrals').checked) fetchCentrals(coords[1], coords[0], outerRadius);
                            if (document.getElementById('chk-splices').checked) fetchSplices(coords[1], coords[0], 0, outerRadius);
                            if (document.getElementById('chk-loops').checked) fetchLoops(coords[1], coords[0], 0, outerRadius);
                        }
                    });

                    ['chk-chambers', 'chk-wires', 'chk-centrals', 'chk-splices', 'chk-loops'].forEach(id => {
                        document.getElementById(id).onchange = function () {
                            const idx = parseInt(selectReachableNode.value);
                            const f = reachableNodesResult.features[idx];
                            if (!f) return;
                            const coords = f.geometry && f.geometry.coordinates;
                            if (!coords) return;
                            let percent = percentInput ? parseFloat(percentInput.value) : 25;
                            if (isNaN(percent) || percent < 1) percent = 25;
                            const outerRadius = Math.abs(distance) * (percent / 100);

                            if (id === 'chk-chambers' && this.checked) fetchChambers(coords[1], coords[0], 0, outerRadius);
                            if (id === 'chk-wires' && this.checked) fetchWires(coords[1], coords[0], outerRadius);
                            if (id === 'chk-centrals' && this.checked) fetchCentrals(coords[1], coords[0], outerRadius);
                            if (id === 'chk-splices' && this.checked) fetchSplices(coords[1], coords[0], 0, outerRadius);
                            if (id === 'chk-loops' && this.checked) fetchLoops(coords[1], coords[0], 0, outerRadius);

                            if (id === 'chk-chambers' && !this.checked && window.chambersMarkers) window.chambersMarkers.forEach(m => m.setMap(null));
                            if (id === 'chk-wires' && !this.checked && window.wiresMarkers) window.wiresMarkers.forEach(m => m.setMap(null));
                            if (id === 'chk-centrals' && !this.checked && window.centralsMarkers) window.centralsMarkers.forEach(m => m.setMap(null));
                            if (id === 'chk-splices' && !this.checked && window.splicesMarkers) window.splicesMarkers.forEach(m => m.setMap(null));
                            if (id === 'chk-loops' && !this.checked && window.loopsMarkers) window.loopsMarkers.forEach(m => m.setMap(null));
                        };
                    });

                    if (percentInput) {
                        percentInput.onchange = function () {
                            const idx = parseInt(selectReachableNode.value);
                            const f = nodosResult.features[idx];
                            if (!f) return;
                            const coords = f.geometry && f.geometry.coordinates;
                            if (!coords) return;
                            let percent = parseFloat(this.value);
                            if (isNaN(percent) || percent < 1) percent = 25;
                            const outerRadius = Math.abs(distance) * (percent / 100);
                            if (document.getElementById('chk-chambers').checked) fetchChambers(coords[1], coords[0], 0, outerRadius);
                            if (document.getElementById('chk-wires').checked) fetchWires(coords[1], coords[0], outerRadius);
                            if (document.getElementById('chk-centrals').checked) fetchCentrals(coords[1], coords[0], outerRadius);
                            if (document.getElementById('chk-splices').checked) fetchSplices(coords[1], coords[0], 0, outerRadius);
                            if (document.getElementById('chk-loops').checked) fetchLoops(coords[1], coords[0], 0, outerRadius);
                        };
                    }
                })
                .catch(error => {
                    hideLoadingOverlay();
                });
        } else {
            showAlert('Failed to calculate reachable distance because there is no result.');
            hideLoadingOverlay();
        }
    });
}

let currentLocationMarker = null;
let currentLocationWatchId = null;

function startCurrentLocationTracking() {
    if (!navigator.geolocation) return;
    if (currentLocationWatchId) {
        navigator.geolocation.clearWatch(currentLocationWatchId);
    }
    currentLocationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            if (currentLocationMarker) {
                currentLocationMarker.setPosition({ lat: latitude, lng: longitude });
            } else {
                currentLocationMarker = new google.maps.Marker({
                    position: { lat: latitude, lng: longitude },
                    map: window.map,
                    icon: {
                        url: ICONS.currentLocation,
                        scaledSize: new google.maps.Size(24, 24),
                    },
                    title: 'Current location',
                    zIndex: 9999
                });
            }
        },
        (error) => {
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
}

function initializeElementRegistrationEvents() {
    const elementType = document.getElementById('element-type');
    if (elementType) {
        document.querySelectorAll('.registration-form').forEach(form => {
            form.style.display = 'none';
        });
        
        elementType.addEventListener('change', function (e) {
            document.querySelectorAll('.registration-form').forEach(form => {
                form.style.display = 'none';
            });
            
            const selectedValue = e.target.value;
            if (selectedValue) {
                const formId = `form-${selectedValue}`;
                const formElement = document.getElementById(formId);
                if (formElement) {
                    formElement.style.display = 'block';
                }
            }
        });
    }
}

let chamberCoordinates = null;
let spliceCoordinates = null;

function getCurrentLocation(callback) {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                callback(coords);
            },
            (error) => {
                showAlert('Failed to get current location.');
            }
        );
    } else {
        showAlert('Your browser does not supports geolocation.');
    }
}

function initializeLocationAutocomplete(inputId, longitudeInputId, latitudeInputId, coordinatesRef) {
    const locationInput = document.getElementById(inputId);
    if (!locationInput || !window.google || !google.maps || !google.maps.places) {
        return;
    }
    
    try {
        const autocompleteElement = new google.maps.places.PlaceAutocompleteElement({
            componentRestrictions: { country: 'co' },
            fields: ['geometry', 'formatted_address']
        });
        
        if (locationInput.placeholder) {
            autocompleteElement.placeholder = locationInput.placeholder;
        }
        autocompleteElement.className = locationInput.className;
        
        locationInput.parentNode.replaceChild(autocompleteElement, locationInput);
        
        autocompleteElement.addEventListener('gmp-placeselect', (event) => {
            const place = event.place;
            if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                
                const longitudeInput = document.getElementById(longitudeInputId);
                const latitudeInput = document.getElementById(latitudeInputId);
                
                if (longitudeInput && latitudeInput) {
                    longitudeInput.value = lng;
                    latitudeInput.value = lat;
                    longitudeInput.readOnly = true;
                    latitudeInput.readOnly = true;
                }
                
                if (coordinatesRef) {
                    coordinatesRef.current = { lat, lng };
                }
                
                if (place.formatted_address && autocompleteElement.value !== undefined) {
                    autocompleteElement.value = place.formatted_address;
                }
                
                if (window.map) {
                    window.map.setCenter({ lat, lng });
                    window.map.setZoom(17);
                }
            }
        });
    } catch (error) {
        const autocomplete = new google.maps.places.Autocomplete(locationInput, {
            types: ['geocode'],
            componentRestrictions: { country: 'co' }
        });
        
        autocomplete.addListener('place_changed', function () {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                
                const longitudeInput = document.getElementById(longitudeInputId);
                const latitudeInput = document.getElementById(latitudeInputId);
                
                if (longitudeInput && latitudeInput) {
                    longitudeInput.value = lng;
                    latitudeInput.value = lat;
                    longitudeInput.readOnly = true;
                    latitudeInput.readOnly = true;
                }
                
                if (coordinatesRef) {
                    coordinatesRef.current = { lat, lng };
                }
                
                if (place.formatted_address && locationInput) {
                    locationInput.value = place.formatted_address;
                }
                
                if (window.map) {
                    window.map.setCenter({ lat, lng });
                    window.map.setZoom(17);
                }
            }
        });
    }
}

let chamberCoordsRef = { current: null };
let spliceCoordsRef = { current: null };

function initializeElementLocationEvents() {
    const getChamberLocation = document.getElementById('get-chamber-location');
    const getSpliceLocation = document.getElementById('get-splice-location');
    const submitChamber = document.getElementById('submit-chamber');
    const submitSplice = document.getElementById('submit-splice');
    
    function initChamberAutocomplete() {
        if (window.google && google.maps && google.maps.places) {
            initializeLocationAutocomplete('chamber-location', 'chamber-longitude', 'chamber-latitude', chamberCoordsRef);
        } else {
            setTimeout(initChamberAutocomplete, 100);
        }
    }
    
    function initSpliceAutocomplete() {
        if (window.google && google.maps && google.maps.places) {
            initializeLocationAutocomplete('splice-location', 'splice-longitude', 'splice-latitude', spliceCoordsRef);
        } else {
            setTimeout(initSpliceAutocomplete, 100);
        }
    }
    
    initChamberAutocomplete();
    initSpliceAutocomplete();

    if (getChamberLocation) {
        getChamberLocation.addEventListener('click', function () {
            getCurrentLocation((coords) => {
                chamberCoordinates = coords;
                const longitudeInput = document.getElementById('chamber-longitude');
                const latitudeInput = document.getElementById('chamber-latitude');
                const locationInput = document.getElementById('chamber-location') || document.querySelector('#chamber-location');
                if (longitudeInput && latitudeInput) {
                    longitudeInput.value = coords.lng;
                    latitudeInput.value = coords.lat;
                    longitudeInput.readOnly = true;
                    latitudeInput.readOnly = true;
                }
                if (locationInput) {
                    locationInput.value = '';
                    if (locationInput.setAttribute) {
                        locationInput.readOnly = false;
                    }
                }
                if (chamberCoordsRef) {
                    chamberCoordsRef.current = coords;
                }
            }, () => {
                const locationInput = document.getElementById('chamber-location') || document.querySelector('#chamber-location');
                if (locationInput) {
                    locationInput.value = '';
                    if (locationInput.setAttribute) {
                        locationInput.readOnly = false;
                    }
                }
            });
        });
    }

    if (getSpliceLocation) {
        getSpliceLocation.addEventListener('click', function () {
            getCurrentLocation((coords) => {
                spliceCoordinates = coords;
                const longitudeInput = document.getElementById('splice-longitude');
                const latitudeInput = document.getElementById('splice-latitude');
                const locationInput = document.getElementById('splice-location') || document.querySelector('#splice-location');
                if (longitudeInput && latitudeInput) {
                    longitudeInput.value = coords.lng;
                    latitudeInput.value = coords.lat;
                    longitudeInput.readOnly = true;
                    latitudeInput.readOnly = true;
                }
                if (locationInput) {
                    locationInput.value = '';
                    if (locationInput.setAttribute) {
                        locationInput.readOnly = false;
                    }
                }
                if (spliceCoordsRef) {
                    spliceCoordsRef.current = coords;
                }
            }, () => {
                const locationInput = document.getElementById('splice-location') || document.querySelector('#splice-location');
                if (locationInput) {
                    locationInput.value = '';
                    if (locationInput.setAttribute) {
                        locationInput.readOnly = false;
                    }
                }
            });
        });
    }


    if (submitChamber) {
        submitChamber.addEventListener('click', function () {
            const longitudeInput = document.getElementById('chamber-longitude');
            const latitudeInput = document.getElementById('chamber-latitude');
            const hasCoordinates = (longitudeInput && latitudeInput && longitudeInput.value && latitudeInput.value) || chamberCoordinates || (chamberCoordsRef && chamberCoordsRef.current);
            
            if (!hasCoordinates) {
                showAlert('Please capture the location of the chamber or select an address');
                return;
            }
            
            if (longitudeInput && latitudeInput && longitudeInput.value && latitudeInput.value) {
                chamberCoordinates = {
                    lat: parseFloat(latitudeInput.value),
                    lng: parseFloat(longitudeInput.value)
                };
            } else if (chamberCoordsRef && chamberCoordsRef.current) {
                chamberCoordinates = chamberCoordsRef.current;
            }
            const data = {
                type: document.getElementById('chamber-type').value,
                id_text: document.getElementById('chamber-id-text').value,
                name: document.getElementById('chamber-name').value,
                opening_type: document.getElementById('chamber-opening').value,
                location: document.getElementById('chamber-location').value,
                owner: document.getElementById('chamber-owner').value,
                construction: document.getElementById('chamber-construction').value,
                state: document.getElementById('chamber-state').value,
                code: document.getElementById('chamber-code').value,
                longitude: parseFloat(document.getElementById('chamber-longitude').value),
                latitude: parseFloat(document.getElementById('chamber-latitude').value)
            };
            fetchWithAuth(`${API_BASE_URL}/chambers/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
                .then(response => response.json())
                .then(result => {
                    showAlert('Chamber registered successfully');
                    document.getElementById('chamber-type').value = 'manhole';
                    document.getElementById('chamber-id-text').value = '';
                    document.getElementById('chamber-name').value = '';
                    document.getElementById('chamber-opening').value = 'standard';
                    document.getElementById('chamber-location').value = '';
                    document.getElementById('chamber-owner').value = 'telecom-alpha';
                    document.getElementById('chamber-construction').value = 'is';
                    document.getElementById('chamber-state').value = 'no-news';
                    document.getElementById('chamber-code').value = '';
                    document.getElementById('chamber-longitude').value = '';
                    document.getElementById('chamber-latitude').value = '';
                    chamberCoordinates = null;
                })
                .catch(error => {
                    showAlert('Error registering the chamber');
                });
        });
    }

    if (submitSplice) {
        submitSplice.addEventListener('click', function () {
            const longitudeInput = document.getElementById('splice-longitude');
            const latitudeInput = document.getElementById('splice-latitude');
            const hasCoordinates = (longitudeInput && latitudeInput && longitudeInput.value && latitudeInput.value) || spliceCoordinates || (spliceCoordsRef && spliceCoordsRef.current);
            
            if (!hasCoordinates) {
                showAlert('Please capture the location of the splice or select an address');
                return;
            }
            
            if (longitudeInput && latitudeInput && longitudeInput.value && latitudeInput.value) {
                spliceCoordinates = {
                    lat: parseFloat(latitudeInput.value),
                    lng: parseFloat(longitudeInput.value)
                };
            } else if (spliceCoordsRef && spliceCoordsRef.current) {
                spliceCoordinates = spliceCoordsRef.current;
            }
            const data = {
                name: document.getElementById('splice-name').value,
                type: document.getElementById('splice-type').value,
                id_text: document.getElementById('splice-id-text').value,
                segment: document.getElementById('splice-segment').value,
                owner: document.getElementById('splice-owner').value,
                splice_type: document.getElementById('splice-splice-type').value,
                id_specification: document.getElementById('splice-id-specification').value,
                construction_status: document.getElementById('splice-construction-status').value,
                specification_name: document.getElementById('splice-specification-name').value,
                longitude: parseFloat(document.getElementById('splice-longitude').value),
                latitude: parseFloat(document.getElementById('splice-latitude').value)
            };
            fetchWithAuth(`${API_BASE_URL}/splices/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
                .then(response => response.json())
                .then(result => {
                    showAlert('Splice registered successfully');
                    document.getElementById('splice-name').value = '';
                    document.getElementById('splice-type').value = 'mechanical';
                    document.getElementById('splice-id-text').value = '';
                    document.getElementById('splice-segment').value = 'corporate';
                    document.getElementById('splice-owner').value = 'telecom-alpha';
                    document.getElementById('splice-splice-type').value = 'break';
                    document.getElementById('splice-id-specification').value = '4604';
                    document.getElementById('splice-construction-status').value = 'is';
                    document.getElementById('splice-specification-name').value = 'type 2';
                    document.getElementById('splice-longitude').value = '';
                    document.getElementById('splice-latitude').value = '';
                    spliceCoordinates = null;
                })
                .catch(error => {
                    showAlert('Error registering the splice');
                });
        });
    }
    const menuVisualization = document.getElementById('menu-visualization');
    const menuRegistration = document.getElementById('menu-registration');
    const mapContainer = document.querySelector('.map-container');
    const registrationSection = document.getElementById('registration-section');
    const formContainer = document.querySelector('.form-container');
    const optionsContainer = document.querySelector('.options-container');
    function showVisualization() {
        menuVisualization.classList.add('active');
        menuRegistration.classList.remove('active');
        if (mapContainer) mapContainer.style.display = '';
        if (registrationSection) registrationSection.style.display = 'none';
        if (formContainer) formContainer.style.display = '';
        if (optionsContainer) optionsContainer.style.display = '';
    }
    function showRegistration() {
        menuVisualization.classList.remove('active');
        menuRegistration.classList.add('active');
        if (mapContainer) mapContainer.style.display = 'none';
        if (registrationSection) registrationSection.style.display = 'block';
        if (formContainer) formContainer.style.display = 'none';
        if (optionsContainer) optionsContainer.style.display = 'none';
    }
    menuVisualization.addEventListener('click', showVisualization);
    menuRegistration.addEventListener('click', showRegistration);
    showVisualization();
}

function getWiresNearby(latitude, longitude, distance, limit, include_troncals, wireName = null, exactSearch = null) {
    const params = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        internal_radius: 0,
        external_radius: distance,
        limit: limit,
        include_troncals: include_troncals ? 'true' : 'false'
    });
    if (wireName) params.append('wire_name', wireName);
    if (exactSearch !== null) params.append('exact_search', exactSearch ? 'true' : 'false');
    const url = `${API_BASE_URL}/wires_nearby?${params.toString()}`;
    return fetchWithAuth(url)
        .then(res => res.json());
}

function getClosestWire(latitude, longitude, distance, wireName = null) {
    return new Promise((resolve) => {
        getWiresNearby(latitude, longitude, distance, 1, 0, wireName, 1).then(result1 => {
            if (result1 && result1.features && result1.features.length > 0) {
                resolve(result1);
                return;
            }
            let wireNameClean = wireName;
            if (wireName && wireName.includes('-')) {
                wireNameClean = wireName.split('-')[0].trim();
            }
            getWiresNearby(latitude, longitude, distance, 10, 1, wireNameClean, 0).then(result2 => {
                if (result2 && result2.features && result2.features.length > 0) {
                    resolve(result2);
                    return;
                }
                getWiresNearby(latitude, longitude, distance, 1, 1, wireNameClean, 0).then(result3 => {
                    if (result3 && result3.features && result3.features.length > 0) {
                        resolve(result3);
                        return;
                    }
                    getWiresNearby(latitude, longitude, distance, 1, 1, null, null).then(result4 => {
                        if (result4 && result4.features && result4.features.length > 0) {
                            resolve(result4);
                            return;
                        }
                        showAlert('No wires found nearby.');
                        resolve(null);
                    });
                });
            });
        });
    });
}

function fetchChambers(latitude, longitude, innerRadius, outerRadius) {
    const url = `${API_BASE_URL}/chambers?latitude=${latitude}&longitude=${longitude}&internal_radius=${innerRadius}&external_radius=${outerRadius}`;
    return fetchWithAuth(url).then(res => res.json()).then(data => {
        if (!window.chambersMarkers) window.chambersMarkers = [];
        window.chambersMarkers.forEach(m => m.setMap(null));
        window.chambersMarkers = [];
        if (data && data.features && data.features.length > 0) {
            let minDist = Infinity;
            let minIdx = -1;
            data.features.forEach((f, idx) => {
                const coords = f.geometry && f.geometry.coordinates;
                if (!coords) return;
                let d = f.properties && (f.properties.distance || f.properties.distance_meters);
                if (typeof d === 'number' && d < minDist) {
                    minDist = d;
                    minIdx = idx;
                }
            });
            data.features.forEach((f, idx) => {
                const coords = f.geometry && f.geometry.coordinates;
                if (!coords) return;
                const isClosest = idx === minIdx;
                const marker = new google.maps.Marker({
                    position: { lat: coords[1], lng: coords[0] },
                    map: window.map,
                    icon: {
                        url: isClosest ? ICONS.chamberNearby : ICONS.chamber,
                        scaledSize: new google.maps.Size(24, 24),
                    },
                    title: isClosest ? 'Closest chamber' : 'Chamber'
                });
                if (f.properties) {
                    const latitude = coords[1];
                    const longitude = coords[0];
                    const infoHtml = `
                        <div style="max-width:220px;font-family:sans-serif;font-size:13px;line-height:1.3;padding:4px 2px 2px 2px;">
                            <div style="margin-bottom:4px;">
                                ${Object.entries(f.properties).map(([k, v]) => `<div style='margin-bottom:2px;'><span style='color:#1976D2;font-weight:600;'>${k}:</span> <span style='color:#222;'>${v}</span></div>`).join('')}
                            </div>
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving" target="_blank" style="display:inline-block;margin-top:4px;padding:4px 8px;background:#1976D2;color:#fff;border-radius:4px;text-decoration:none;font-weight:600;font-size:13px;">Go to this chamber</a>
                        </div>`;
                    const infoWindow = new google.maps.InfoWindow({
                        content: infoHtml
                    });
                    marker.addListener('click', () => infoWindow.open(window.map, marker));
                }
                window.chambersMarkers.push(marker);
            });
        }
        return data;
    });
}

function fetchWires(latitude, longitude, outerRadius) {
    outerRadius = outerRadius * 2;
    const url = `${API_BASE_URL}/wires?latitude=${latitude}&longitude=${longitude}&external_radius=${outerRadius}`;
    return fetchWithAuth(url).then(res => res.json()).then(data => {
        if (!window.wiresPolylines) window.wiresPolylines = [];
        window.wiresPolylines.forEach(l => l.setMap(null));
        window.wiresPolylines = [];
        if (data && data.features && data.features.length > 0) {
            if (outerRadius) {
                let zoom;
                if (outerRadius < 50) zoom = 18;
                else if (outerRadius < 150) zoom = 18;
                else if (outerRadius < 400) zoom = 18;
                else if (outerRadius < 1000) zoom = 17;
                else if (outerRadius < 2000) zoom = 16;
                else if (outerRadius < 4000) zoom = 15;
                else zoom = 12;
                if (window.map && typeof window.map.setZoom === 'function') {
                    window.map.setZoom(zoom);
                }
            }
            data.features.forEach(f => {
                if (f.geometry && f.geometry.type === 'LineString' && Array.isArray(f.geometry.coordinates)) {
                    let color = '#1976D2';
                    if (!f.properties || !f.properties.placement || !f.properties.placement.toLowerCase().includes('trunk')) {
                        color = '#43A047';
                    }
                    const path = f.geometry.coordinates.map(coord => ({ lng: coord[0], lat: coord[1] }));
                    const polyline = new google.maps.Polyline({
                        path,
                        geodesic: true,
                        strokeColor: color,
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        map: window.map
                    });

                    if (f.properties) {
                        const infoWindow = new google.maps.InfoWindow({
                            content: Object.entries(f.properties).map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`).join('')
                        });
                        polyline.addListener('click', (e) => {
                            infoWindow.setPosition(e.latLng);
                            infoWindow.open(window.map);
                        });
                    }
                    window.wiresPolylines.push(polyline);
                }
            });
        }
        return data;
    });
}

function fetchCentrals(latitude, longitude, outerRadius) {
    const url = `${API_BASE_URL}/centrals?latitude=${latitude}&longitude=${longitude}&external_radius=${outerRadius}`;
    return fetchWithAuth(url).then(res => res.json()).then(data => {
        if (!window.centralsMarkers) window.centralsMarkers = [];
        window.centralsMarkers.forEach(m => m.setMap(null));
        window.centralsMarkers = [];
        if (data && data.features && data.features.length > 0) {
            data.features.forEach(f => {
                const coords = f.geometry && f.geometry.coordinates;
                if (!coords) return;
                const marker = new google.maps.Marker({
                    position: { lat: coords[1], lng: coords[0] },
                    map: window.map,
                    icon: {
                        url: ICONS.central,
                        scaledSize: new google.maps.Size(24, 24),
                    },
                    title: 'Central'
                });

                if (f.properties) {
                    const infoWindow = new google.maps.InfoWindow({
                        content: Object.entries(f.properties).map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`).join('')
                    });
                    marker.addListener('click', () => infoWindow.open(window.map, marker));
                }
                window.centralsMarkers.push(marker);
            });
        }
        return data;
    });
}

function fetchSplices(latitude, longitude, innerRadius, outerRadius) {
    const url = `${API_BASE_URL}/splices?latitude=${latitude}&longitude=${longitude}&internal_radius=${innerRadius}&external_radius=${outerRadius}`;
    return fetchWithAuth(url).then(res => res.json()).then(data => {
        if (!window.splicesMarkers) window.splicesMarkers = [];
        window.splicesMarkers.forEach(m => m.setMap(null));
        window.splicesMarkers = [];
        if (data && data.features && data.features.length > 0) {
            data.features.forEach(f => {
                const coords = f.geometry && f.geometry.coordinates;
                if (!coords) return;
                const marker = new google.maps.Marker({
                    position: { lat: coords[1], lng: coords[0] },
                    map: window.map,
                    icon: {
                        url: ICONS.splice,
                        scaledSize: new google.maps.Size(24, 24),
                    },
                    title: 'Splice'
                });
                if (f.properties) {
                    const infoWindow = new google.maps.InfoWindow({
                        content: Object.entries(f.properties).map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`).join('')
                    });
                    marker.addListener('click', () => infoWindow.open(window.map, marker));
                }
                window.splicesMarkers.push(marker);
            });
        }
        return data;
    });
}

function fetchLoops(latitude, longitude, innerRadius, outerRadius) {
    const url = `${API_BASE_URL}/loops?latitude=${latitude}&longitude=${longitude}&internal_radius=${innerRadius}&external_radius=${outerRadius}`;
    return fetchWithAuth(url).then(res => res.json()).then(data => {
        if (!window.loopsMarkers) window.loopsMarkers = [];
        window.loopsMarkers.forEach(m => m.setMap(null));
        window.loopsMarkers = [];
        if (data && data.features && data.features.length > 0) {
            data.features.forEach(f => {
                const coords = f.geometry && f.geometry.coordinates;
                if (!coords) return;
                const marker = new google.maps.Marker({
                    position: { lat: coords[1], lng: coords[0] },
                    map: window.map,
                    icon: {
                        url: ICONS.loop,
                        scaledSize: new google.maps.Size(24, 24),
                    },
                    title: 'Loop'
                });
                if (f.properties) {
                    const infoWindow = new google.maps.InfoWindow({
                        content: Object.entries(f.properties).map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`).join('')
                    });
                    marker.addListener('click', () => infoWindow.open(window.map, marker));
                }
                window.loopsMarkers.push(marker);
            });
        }
        return data;
    });
}
