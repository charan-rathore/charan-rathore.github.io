(function initVisitorWeather() {
    const tempEl = document.getElementById('visitorTemp');
    const widgetEl = document.getElementById('visitorWeather');

    if (!tempEl || !widgetEl) return;

    const FALLBACK = { lat: 28.367, lng: 75.588 };

    async function resolveCoordsFromIp() {
        const providers = [
            async () => {
                const res = await fetch('https://ipwho.is/');
                if (!res.ok) throw new Error('ipwho unavailable');
                const data = await res.json();
                if (!data.success) throw new Error('ipwho failed');
                const lat = Number(data.latitude);
                const lng = Number(data.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('invalid ipwho');
                return { lat, lng };
            },
            async () => {
                const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
                if (!res.ok) throw new Error('geojs unavailable');
                const data = await res.json();
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('invalid geojs');
                return { lat, lng };
            },
        ];

        for (const provider of providers) {
            try {
                return await provider();
            } catch {
                continue;
            }
        }

        return FALLBACK;
    }

    async function fetchTemperature(lat, lng) {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(lat));
        url.searchParams.set('longitude', String(lng));
        url.searchParams.set('current', 'temperature_2m');
        url.searchParams.set('timezone', 'auto');

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('weather unavailable');

        const data = await res.json();
        const temp = data?.current?.temperature_2m;
        if (typeof temp !== 'number') throw new Error('invalid weather payload');
        return temp;
    }

    function setTemperature(value) {
        tempEl.textContent = `${Math.round(value)}°C`;
        widgetEl.setAttribute(
            'aria-label',
            `Your approximate local temperature is ${Math.round(value)} degrees Celsius`
        );
    }

    async function start() {
        tempEl.textContent = '…';

        try {
            const { lat, lng } = await resolveCoordsFromIp();
            setTemperature(await fetchTemperature(lat, lng));
            return;
        } catch {
            /* try fallback coords */
        }

        try {
            setTemperature(await fetchTemperature(FALLBACK.lat, FALLBACK.lng));
        } catch {
            tempEl.textContent = '—';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
