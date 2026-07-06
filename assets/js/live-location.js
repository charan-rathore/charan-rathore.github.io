(function initLiveLocation() {
    const API_KEY = 'AIzaSyAkBhswuo9mnwQFYk8s2OQWVHDQ1CpUhL4';
    const FALLBACK = { lat: 28.3670, lng: 75.5880, label: 'BITS Pilani, Pilani' };

    const mapEl = document.getElementById('liveMap');
    const tempEl = document.getElementById('liveTemp');
    const locationEl = document.getElementById('liveLocation');
    const conditionEl = document.getElementById('liveCondition');
    const humidityEl = document.getElementById('liveHumidity');
    const updatedEl = document.getElementById('liveUpdated');

    if (!mapEl) return;

    const darkMapStyles = [
        { elementType: 'geometry', stylers: [{ color: '#EDE6DB' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#4A4540' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#F3EDE4' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#E8E0D4' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D4E4F0' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#E8E0D4' }] }
    ];

    function setStatus(message) {
        if (locationEl && !locationEl.dataset.resolved) {
            locationEl.textContent = message;
        }
    }

    function loadMapsScript(callback) {
        if (window.google && window.google.maps) {
            callback();
            return;
        }
        window.__initLiveMap = callback;
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=__initLiveMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }

    async function fetchWeather(lat, lng) {
        const url = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
        url.searchParams.set('key', API_KEY);
        url.searchParams.set('location.latitude', lat);
        url.searchParams.set('location.longitude', lng);
        url.searchParams.set('unitsSystem', 'METRIC');

        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API unavailable');
        return res.json();
    }

    async function reverseGeocode(lat, lng) {
        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        url.searchParams.set('latlng', `${lat},${lng}`);
        url.searchParams.set('key', API_KEY);

        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results[0]) {
            return data.results[0].formatted_address;
        }
        return `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
    }

    function initMap(lat, lng) {
        const pos = { lat, lng };
        const map = new google.maps.Map(mapEl, {
            center: pos,
            zoom: 14,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'cooperative',
            styles: darkMapStyles
        });
        new google.maps.Marker({ position: pos, map });
    }

    function formatTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async function updateWidget(lat, lng, usedFallback) {
        initMap(lat, lng);

        try {
            const weather = await fetchWeather(lat, lng);
            const temp = weather.temperature?.degrees;
            if (tempEl && typeof temp === 'number') {
                tempEl.textContent = `${Math.round(temp)}°C`;
            }
            if (conditionEl) {
                conditionEl.textContent = weather.weatherCondition?.description?.text || 'Current conditions';
            }
            if (humidityEl && weather.relativeHumidity != null) {
                humidityEl.textContent = `${weather.relativeHumidity}% humidity`;
            }
        } catch {
            if (tempEl) tempEl.textContent = '—';
            if (conditionEl) conditionEl.textContent = 'Enable Weather API for live data';
        }

        try {
            const address = usedFallback ? FALLBACK.label : await reverseGeocode(lat, lng);
            if (locationEl) {
                locationEl.textContent = address;
                locationEl.dataset.resolved = 'true';
            }
        } catch {
            if (locationEl) {
                locationEl.textContent = usedFallback ? FALLBACK.label : `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
                locationEl.dataset.resolved = 'true';
            }
        }

        if (updatedEl) {
            updatedEl.textContent = `Updated ${formatTime()}`;
        }
    }

    function start() {
        setStatus('Locating you…');

        if (!navigator.geolocation) {
            updateWidget(FALLBACK.lat, FALLBACK.lng, true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => updateWidget(pos.coords.latitude, pos.coords.longitude, false),
            () => updateWidget(FALLBACK.lat, FALLBACK.lng, true),
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
        );
    }

    loadMapsScript(start);
})();
