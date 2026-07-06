(function initVisitorCounter() {
    const NS = 'charan-rathore';
    const TOTAL_KEY = 'portfolio';
    const MOBILE_KEY = 'portfolio-mobile';
    const DESKTOP_KEY = 'portfolio-desktop';
    const API = 'https://api.counterapi.dev/v1';

    const isMobile = window.matchMedia('(max-width: 768px)').matches
        || window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    async function counterRequest(key, increment) {
        const suffix = increment ? '/up' : '/';
        const res = await fetch(`${API}/${NS}/${key}${suffix}`);
        if (!res.ok) throw new Error('Counter unavailable');
        const data = await res.json();
        return data.count;
    }

    function setText(selector, value) {
        document.querySelectorAll(selector).forEach((el) => {
            el.textContent = typeof value === 'number' ? value.toLocaleString() : value;
        });
    }

    async function init() {
        const hasCounter = document.querySelector('[data-visitor-count]');
        if (!hasCounter) return;

        const deviceKey = isMobile ? MOBILE_KEY : DESKTOP_KEY;
        const sessionTotal = 'portfolio-visit-recorded';
        const sessionDevice = `portfolio-device-${deviceKey}`;

        try {
            let total;
            if (!sessionStorage.getItem(sessionTotal)) {
                total = await counterRequest(TOTAL_KEY, true);
                sessionStorage.setItem(sessionTotal, '1');
            } else {
                total = await counterRequest(TOTAL_KEY, false);
            }

            if (!sessionStorage.getItem(sessionDevice)) {
                await counterRequest(deviceKey, true);
                sessionStorage.setItem(sessionDevice, '1');
            }

            const [mobileCount, desktopCount] = await Promise.all([
                counterRequest(MOBILE_KEY, false),
                counterRequest(DESKTOP_KEY, false)
            ]);

            setText('[data-visitor-count]', total);
            setText('[data-mobile-count]', mobileCount);
            setText('[data-desktop-count]', desktopCount);

            document.querySelectorAll('[data-device-mode]').forEach((el) => {
                el.textContent = isMobile ? 'mobile' : 'desktop';
            });
        } catch {
            setText('[data-visitor-count]', '—');
            setText('[data-mobile-count]', '—');
            setText('[data-desktop-count]', '—');
        }
    }

    init();
})();
