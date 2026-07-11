(function initVisitorWeather() {
    const tempEl = document.getElementById('visitorTemp');
    const widgetEl = document.getElementById('visitorWeather');

    if (!tempEl || !widgetEl) return;

    const FALLBACK = { lat: 28.3670, lng: 75.5880 };

    async function resolveCoordsFromIp() {
        const providers = [
            async () => {
                const res = await fetch('https://ipwho.is/');
                if (!res.ok) throw new Error('ipwho unavailable');
                const data = await res.json();
                if (!data.success) throw new Error('ipwho failed');
                return { lat: data.latitude, lng: data.longitude };
            },
            async () => {
                const res = await fetch('https://ipapi.co/json/');
                if (!res.ok) throw new Error('ipapi unavailable');
                const data = await res.json();
                if (data.error) throw new Error('ipapi failed');
                return { lat: data.latitude, lng: data.longitude };
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

        const res = await fetch(url);
        if (!res.ok) throw new Error('weather unavailable');

        const data = await res.json();
        const temp = data?.current?.temperature_2m;
        if (typeof temp !== 'number') throw new Error('invalid weather payload');
        return temp;
    }

    function setTemperature(value) {
        tempEl.textContent = `${Math.round(value)}°C`;
        widgetEl.setAttribute('aria-label', `Your approximate local temperature is ${Math.round(value)} degrees Celsius`);
    }

    async function start() {
        try {
            const { lat, lng } = await resolveCoordsFromIp();
            const temp = await fetchTemperature(lat, lng);
            setTemperature(temp);
        } catch {
            try {
                const temp = await fetchTemperature(FALLBACK.lat, FALLBACK.lng);
                setTemperature(temp);
            } catch {
                tempEl.textContent = '—';
            }
        }
    }

    start();
})();
