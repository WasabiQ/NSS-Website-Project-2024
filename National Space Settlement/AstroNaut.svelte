<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import type { ApodData, MarsItem, PanelID, NavItem } from '$lib/types';

  // === SYSTEM STATE ===
  let apod = $state<ApodData | null>(null);
  let marsImages = $state<MarsItem[]>([]);
  let selectedDate = $state<string>('');
  let loadingMars = $state(false);
  let activePanel = $state<PanelID | null>(null);
  let theme = $state<'light' | 'dark'>('dark');
  let showBriefing = $state(false);
  let dateTimeout: ReturnType<typeof setTimeout>;

  // === CONFIG (Emojis removed) ===
  const navItems: NavItem[] = [
    { id: 'Explorer', label: 'Explorer' },
    { id: 'JotDown', label: 'Jot Down' },
    { id: 'QuickBits', label: 'Quick Bits' },
    { id: 'Eyes', label: 'Eyes' }
  ];

  const toggleTheme = () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  };

  const fetchAPOD = async () => {
    try {
      const now = new Date();
      const weekKey = `apod-${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
      const cached = localStorage.getItem('apodCached');
      const lastFetch = localStorage.getItem('apodLastFetch');

      if (cached && lastFetch === weekKey) {
        apod = JSON.parse(cached);
        return;
      }

      const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=BQ61JZz7GQmytZ4GOF67UawdelUefcBIm6DVUUOr');
      const data = await res.json();
      apod = { ...data, isVideo: data.media_type === 'video' };
      localStorage.setItem('apodCached', JSON.stringify(apod));
      localStorage.setItem('apodLastFetch', weekKey);
    } catch (err) {
      console.error('Data link failure:', err);
    }
  };

  const fetchMarsImages = async (date?: string) => {
    loadingMars = true;
    const url = date
      ? `https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&date=${date}`
      : `https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020`;
    try {
      const res = await fetch(url);
      const xmlDoc = new DOMParser().parseFromString(await res.text(), 'text/xml');
      marsImages = Array.from(xmlDoc.querySelectorAll('item')).slice(0, 10).map(item => ({
        title: item.querySelector('title')?.textContent || 'Mars Visual',
        imgUrl: item.querySelector('enclosure')?.getAttribute('url') || ''
      }));
    } finally {
      loadingMars = false;
    }
  };

  onMount(() => {
    fetchAPOD();
    fetchMarsImages();
  });

  $effect(() => {
    if (selectedDate) {
      clearTimeout(dateTimeout);
      dateTimeout = setTimeout(() => fetchMarsImages(selectedDate), 500);
    }
  });
</script>

<div class="relative w-screen h-screen font-mono overflow-hidden transition-colors duration-700 
  {theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}">

  {#if apod}
    <div class="absolute inset-0 z-0 overflow-hidden" transition:fade>
      {#if apod.isVideo}
        <iframe src={apod.url} title={apod.title} class="w-full h-full scale-110 blur-sm opacity-30 pointer-events-none"></iframe>
      {:else}
        <img src={apod.url} alt={apod.title} class="w-full h-full object-cover opacity-40 blur-[1px]" />
      {/if}
      <div class="absolute inset-0 bg-gradient-to-br 
        {theme === 'dark' ? 'from-transparent via-slate-950/60 to-slate-950' : 'from-transparent via-white/60 to-white'}">
      </div>
    </div>
  {/if}

  <div class="relative z-10 flex h-full">
    <aside class="flex flex-col justify-between p-4 border-r w-20 md:w-24
      {theme === 'dark' ? 'bg-black/30 border-white/5 backdrop-blur-2xl' : 'bg-white/40 border-slate-200 backdrop-blur-2xl'}">
      
      <div class="flex flex-col gap-12 mt-8">
        {#each navItems as item}
          <button 
            onclick={() => activePanel = activePanel === item.id ? null : item.id}
            class="relative group flex flex-col items-center gap-2 transition-all 
            {activePanel === item.id ? 'text-orange-500' : 'opacity-40 hover:opacity-100'}"
          >
            <div class="w-8 h-8 border border-current rounded flex items-center justify-center text-[10px] font-black">
              {item.id.substring(0, 2).toUpperCase()}
            </div>
            <span class="hidden md:block text-[8px] uppercase tracking-[0.2em] font-black">{item.label}</span>
          </button>
        {/each}
      </div>

      <div class="mb-6 flex flex-col items-center gap-6">
        <button onclick={toggleTheme} class="relative w-12 h-12 flex items-center justify-center group">
          {#if theme === 'dark'}
            <div class="absolute inset-0 bg-blue-400/20 blur-xl rounded-full animate-pulse"></div>
            <svg class="w-6 h-6 text-blue-100 drop-shadow-[0_0_8px_rgba(191,219,254,0.8)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3c.132 0 .263 0 .393.007a9 9 0 0010.656 10.656 9 9 0 11-11.049-10.663z" />
            </svg>
          {:else}
            <div class="absolute inset-0 bg-amber-400/40 blur-xl rounded-full animate-pulse"></div>
            <svg class="w-7 h-7 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 7a5 5 0 100 10 5 5 0 000-10zM2 13h2a1 1 0 100-2H2a1 1 0 100 2zm18 0h2a1 1 0 100-2h-2a1 1 0 100 2zM11 2v2a1 1 0 102 0V2a1 1 0 10-2 0zm0 18v2a1 1 0 102 0v-2a1 1 0 10-2 0zM5.99 4.58a1 1 0 10-1.41 1.41l1.06 1.06a1 1 0 101.41-1.41L5.99 4.58zm12.37 12.37a1 1 0 10-1.41 1.41l1.06 1.06a1 1 0 101.41-1.41l-1.06-1.06zm1.06-10.96a1 1 0 11-1.41-1.41l1.06 1.06a1 1 0 111.41 1.41l-1.06-1.06zM7.05 18.36a1 1 0 11-1.41-1.41l1.06 1.06a1 1 0 111.41 1.41l-1.06-1.06z" />
            </svg>
          {/if}
        </button>
      </div>
    </aside>

    <main class="flex-1 relative flex flex-col items-center justify-center pointer-events-none px-6">
      <h1 class="text-7xl md:text-[11rem] font-black tracking-tighter italic select-none 
        {theme === 'dark' ? 'text-white/5' : 'text-slate-900/5'} transition-colors duration-1000">
        ASTRONAUT
      </h1>

      <div class="absolute bottom-12 left-12 flex items-end gap-5 pointer-events-auto">
        <div class="w-16 h-16 border-2 border-orange-600 flex items-center justify-center font-black text-2xl transform rotate-3 shadow-lg bg-orange-600 text-white">
          A_04
        </div>
        <div class="flex flex-col text-left">
          <span class="text-[9px] opacity-40 uppercase tracking-[0.4em] font-bold">Protocol Active</span>
          <div class="text-[11px] font-black tracking-widest border-b border-orange-600 pb-1">
            STATION_04 // FORK_ME
          </div>
        </div>
      </div>

      {#if activePanel}
        <div id="active-panel" 
          class="absolute top-8 right-8 bottom-8 w-full max-w-lg p-10 rounded-xl shadow-2xl border flex flex-col pointer-events-auto
          {theme === 'dark' ? 'bg-black/90 border-white/10 backdrop-blur-3xl' : 'bg-white border-slate-200 shadow-slate-200'}"
          transition:fly={{ x: 40, duration: 400 }}>
          
          <header class="flex justify-between items-center mb-10 border-b border-orange-500/20 pb-8">
            <h2 class="text-4xl font-black uppercase italic text-orange-500 tracking-tighter">{activePanel}</h2>
            <button onclick={() => activePanel = null} class="text-[10px] font-bold tracking-widest border px-3 py-1 hover:bg-orange-500 hover:text-white transition-colors">CLOSE</button>
          </header>

          <div class="flex-1 overflow-y-auto custom-scrollbar">
            {#if activePanel === 'Eyes'}
              <div class="space-y-6">
                <input type="date" bind:value={selectedDate} 
                  class="w-full bg-transparent border-b border-orange-500/50 p-3 text-sm outline-none font-bold" />
                
                {#if loadingMars}
                  <div class="h-40 border border-dashed border-orange-500/20 animate-pulse flex items-center justify-center text-[10px] tracking-widest opacity-40">FETCHING_VISUALS...</div>
                {:else}
                  <div class="grid gap-6">
                    {#each marsImages as item}
                      <div class="border border-white/5 overflow-hidden shadow-2xl group">
                        <img src={item.imgUrl} alt={item.title} class="w-full h-48 object-cover transition-transform duration-1000 group-hover:scale-105" />
                        <div class="p-3 bg-black/40 text-[9px] uppercase font-bold tracking-tighter">
                          {item.title}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="h-full flex items-center justify-center opacity-20 text-[10px] tracking-[0.5em]">SYSTEM_PENDING</div>
            {/if}
          </div>
        </div>
      {/if}
    </main>
  </div>
</div>

<style lang="postcss">
  .custom-scrollbar::-webkit-scrollbar { width: 2px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { @apply bg-orange-500; }

  /* Sun/Moon Glow Animation */
  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.1); }
  }
  .animate-pulse {
    animation: pulse 3s ease-in-out infinite;
  }
</style>
