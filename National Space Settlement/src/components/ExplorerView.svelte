<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        Explorer,
        type ExplorerMode,
        type MapTheme,
        type FlightMapMode,
    } from "./Explorer";

    let containerRef = $state<HTMLDivElement | null>(null);
    let explorer: Explorer | null = null;
    let currentMode = $state<ExplorerMode>("dual");
    let currentTheme = $state<MapTheme>("default");
    let flightMapOn = $state(true);
    let loading = $state(true);
    let error = $state("");

    const modes: { value: ExplorerMode; label: string }[] = [
        { value: "dual", label: "Dual" },
        { value: "street", label: "Street" },
        { value: "stars", label: "Stars" },
    ];

    const themes: { value: MapTheme; label: string }[] = [
        { value: "default", label: "Default" },
        { value: "CRT", label: "CRT" },
        { value: "FLIR", label: "FLIR" },
        { value: "NVG", label: "NVG" },
    ];

    const presetLocations = [
        { name: "Earth Overview", lon: 0, lat: 0, height: 20_000_000 },
        { name: "ISS Orbit View", lon: 0, lat: 51.6, height: 408_000 },
        {
            name: "Kennedy Space Center",
            lon: -80.604,
            lat: 28.573,
            height: 50_000,
        },
        {
            name: "Baikonur Cosmodrome",
            lon: 63.342,
            lat: 45.965,
            height: 50_000,
        },
        { name: "ISRO - Sriharikota", lon: 80.23, lat: 13.72, height: 50_000 },
        { name: "ESA - Kourou", lon: -52.768, lat: 5.239, height: 50_000 },
    ];

    onMount(async () => {
        if (!containerRef) return;

        explorer = new Explorer();

        try {
            await explorer.init({
                container: containerRef,
                mode: currentMode,
                theme: currentTheme,
                flightMap: flightMapOn ? "on" : "off",
                defaultCoords: { lon: 0, lat: 20, height: 20_000_000 },
            });
            loading = false;
        } catch (err: any) {
            error = err.message || "Failed to initialize Explorer";
            loading = false;
        }
    });

    onDestroy(() => {
        explorer?.destroy();
        explorer = null;
    });

    const changeMode = (mode: ExplorerMode) => {
        currentMode = mode;
        explorer?.setMode(mode);
    };

    const changeTheme = (theme: MapTheme) => {
        currentTheme = theme;
        explorer?.setTheme(theme);
    };

    const toggleFlight = () => {
        flightMapOn = !flightMapOn;
        explorer?.setFlightMap(flightMapOn ? "on" : "off");
    };

    const goToLocation = (loc: (typeof presetLocations)[0]) => {
        explorer?.flyTo({ lon: loc.lon, lat: loc.lat, height: loc.height }, 2);
    };
</script>

<div
    class="flex flex-col w-full h-full bg-[#11161c] border border-[#2a3138] rounded-xl overflow-hidden shadow-2xl font-mono relative"
>
    <!-- Control Bar -->
    <div
        class="flex items-center justify-between px-4 py-3 border-b border-[#2a3138] bg-[#161b22] z-10 flex-wrap gap-2"
    >
        <!-- Mode Selector -->
        <div class="flex items-center gap-1">
            <span
                class="text-[9px] uppercase tracking-widest text-[#9da7b3]/40 mr-2"
                >Layer</span
            >
            {#each modes as mode}
                <button
                    onclick={() => changeMode(mode.value)}
                    class="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold transition-all rounded
          {currentMode === mode.value
                        ? 'bg-[#4da3ff] text-[#0b0f14]'
                        : 'text-[#9da7b3] hover:text-[#e6edf3] hover:bg-[#2a3138]/50'}"
                >
                    {mode.label}
                </button>
            {/each}
        </div>

        <!-- Theme Selector -->
        <div class="flex items-center gap-1">
            <span
                class="text-[9px] uppercase tracking-widest text-[#9da7b3]/40 mr-2"
                >Theme</span
            >
            {#each themes as theme}
                <button
                    onclick={() => changeTheme(theme.value)}
                    class="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold transition-all rounded
          {currentTheme === theme.value
                        ? 'bg-[#4da3ff] text-[#0b0f14]'
                        : 'text-[#9da7b3] hover:text-[#e6edf3] hover:bg-[#2a3138]/50'}"
                >
                    {theme.label}
                </button>
            {/each}
        </div>

        <!-- Flight Map Toggle -->
        <button
            onclick={toggleFlight}
            class="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold transition-all rounded border
      {flightMapOn
                ? 'border-emerald-400 text-emerald-400 bg-emerald-400/10'
                : 'border-[#2a3138] text-[#9da7b3]'}"
        >
            Flight {flightMapOn ? "ON" : "OFF"}
        </button>
    </div>

    <!-- Globe Container -->
    <div class="flex-1 relative">
        <div bind:this={containerRef} class="absolute inset-0"></div>

        {#if loading}
            <div
                class="absolute inset-0 flex items-center justify-center bg-[#0b0f14] z-10"
            >
                <div class="flex flex-col items-center gap-4">
                    <div
                        class="w-8 h-8 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin"
                    ></div>
                    <span
                        class="text-[10px] uppercase tracking-widest text-[#9da7b3]/60"
                        >Initializing Globe...</span
                    >
                </div>
            </div>
        {/if}

        {#if error}
            <div
                class="absolute inset-0 flex items-center justify-center bg-[#0b0f14] z-10"
            >
                <div class="text-center max-w-md">
                    <p class="text-red-400 text-sm mb-2">EXPLORER_INIT_ERR</p>
                    <p class="text-[#9da7b3] text-xs">{error}</p>
                    <p class="text-[#9da7b3]/40 text-[10px] mt-4">
                        Cesium requires a valid ion access token. Set
                        window.CESIUM_BASE_URL and Cesium.Ion.defaultAccessToken
                        before loading.
                    </p>
                </div>
            </div>
        {/if}

        <!-- Quick Nav -->
        <div class="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
            {#each presetLocations as loc}
                <button
                    onclick={() => goToLocation(loc)}
                    class="px-3 py-1.5 text-[9px] uppercase tracking-wider font-bold bg-[#161b22]/90 border border-[#2a3138] text-[#9da7b3] hover:text-[#4da3ff] hover:border-[#4da3ff]/40 transition-all rounded backdrop-blur-sm text-left"
                >
                    {loc.name}
                </button>
            {/each}
        </div>

        <!-- Coordinates Display -->
        <div
            class="absolute top-4 right-4 z-10 px-3 py-2 bg-[#161b22]/90 border border-[#2a3138] rounded backdrop-blur-sm"
        >
            <span
                class="text-[9px] uppercase tracking-widest text-[#9da7b3]/40"
            >
                Mode: {currentMode} | Theme: {currentTheme}
            </span>
        </div>
    </div>
</div>
