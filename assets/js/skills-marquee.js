(function initSkillsMarquee() {
    const viewport = document.getElementById('skillsMarquee');
    if (!viewport) return;

    const skills = [
        { name: 'Python', icon: 'https://cdn.simpleicons.org/python/3776AB' },
        { name: 'PyTorch', icon: 'https://cdn.simpleicons.org/pytorch/EE4C2C' },
        { name: 'LangChain', icon: 'https://cdn.simpleicons.org/langchain/1C3C3C' },
        { name: 'Ollama', icon: 'https://cdn.simpleicons.org/ollama/000000' },
        { name: 'Hugging Face', icon: 'https://cdn.simpleicons.org/huggingface/FFD21E' },
        { name: 'FastAPI', icon: 'https://cdn.simpleicons.org/fastapi/009688' },
        { name: 'PostgreSQL', icon: 'https://cdn.simpleicons.org/postgresql/4169E1' },
        { name: 'Redis', icon: 'https://cdn.simpleicons.org/redis/DC382D' },
        { name: 'Docker', icon: 'https://cdn.simpleicons.org/docker/2496ED' },
        { name: 'React', icon: 'https://cdn.simpleicons.org/react/61DAFB' },
        { name: 'Next.js', icon: 'https://cdn.simpleicons.org/nextdotjs/000000' },
        { name: 'TypeScript', icon: 'https://cdn.simpleicons.org/typescript/3178C6' },
        { name: 'Tailwind CSS', icon: 'https://cdn.simpleicons.org/tailwindcss/06B6D4' },
        { name: 'Celery', icon: 'https://cdn.simpleicons.org/celery/37814A' },
        { name: 'Azure', icon: 'https://cdn.simpleicons.org/microsoftazure/0078D4' },
        { name: 'GitHub Actions', icon: 'https://cdn.simpleicons.org/githubactions/2088FF' },
        { name: 'Vercel', icon: 'https://cdn.simpleicons.org/vercel/000000' },
        { name: 'Jupyter', icon: 'https://cdn.simpleicons.org/jupyter/F37626' },
        { name: 'NumPy', icon: 'https://cdn.simpleicons.org/numpy/013243' },
        { name: 'scikit-learn', icon: 'https://cdn.simpleicons.org/scikitlearn/F7931E' },
        { name: 'MLflow', icon: 'https://cdn.simpleicons.org/mlflow/0194E2' },
        { name: 'Mixpanel', icon: 'https://cdn.simpleicons.org/mixpanel/7856FF' },
        { name: 'ChromaDB', icon: 'https://cdn.simpleicons.org/sqlite/003B57' },
        { name: 'OpenAI', icon: 'https://cdn.simpleicons.org/openai/412991' },
    ];

    function buildChip(skill) {
        const chip = document.createElement('div');
        chip.className = 'skill-chip';
        chip.title = skill.name;
        chip.setAttribute('aria-label', skill.name);

        const img = document.createElement('img');
        img.src = skill.icon;
        img.alt = '';
        img.loading = 'lazy';
        img.width = 32;
        img.height = 32;

        chip.appendChild(img);
        return chip;
    }

    const track = document.createElement('div');
    track.className = 'skills-marquee-track';

    const renderSet = () => skills.forEach((skill) => track.appendChild(buildChip(skill)));

    renderSet();
    renderSet();

    viewport.appendChild(track);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        track.style.animation = 'none';
        track.style.flexWrap = 'wrap';
        track.style.justifyContent = 'center';
    }
})();
