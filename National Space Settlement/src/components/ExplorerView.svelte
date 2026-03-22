<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        Explorer,
        type ExplorerMode,
        type MapTheme,
        type FlightMapMode,
    } from "./Explorer";
    import * as Cesium from "cesium";

    let containerRef = $state<HTMLDivElement | null>(null);
    let explorer: Explorer | null = null;
    let currentMode = $state<ExplorerMode>("dual");
    let currentTheme = $state<MapTheme>("default");
    let flightMapOn = $state(true);
    let loading = $state(true);
    let error = $state("");
    let webglError = $state(false);

    let showISS = $state(false);
    let issInterval: ReturnType<typeof setInterval> | null = null;
    let issEntity: any = null;

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
            loading = false;
            const msg = err.message || "";
            if (msg.includes("WebGL") || msg.includes("graphics")) {
                webglError = true;
            } else {
                error = msg || "Failed to initialize Explorer";
            }
        }
    });

    onDestroy(() => {
        if (issInterval) clearInterval(issInterval);
        explorer?.destroy();
        explorer = null;
    });

    const toggleISS = async () => {
        showISS = !showISS;
        const viewer = explorer?.cesiumViewer;
        if (!viewer) return;

        // Dynamic import of Cesium just for types/constants if we need them,
        // but viewer provides entities.
        if (showISS) {
            issEntity = viewer.entities.add({
                id: "ISS_LIVE",
                position: undefined,
                point: {
                    pixelSize: 8,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                },
                label: {
                    text: "ISS (LIVE)",
                    font: "10pt monospace",
                    pixelOffset: new Cesium.Cartesian2(0, -12),
                },
            });
            fetchISS();
            issInterval = setInterval(fetchISS, 4000);
        } else {
            if (issInterval) clearInterval(issInterval);
            if (issEntity) viewer.entities.remove(issEntity);
            issEntity = null;
        }
    };

    const fetchISS = async () => {
        try {
            const res = await fetch(
                "https://api.wheretheiss.at/v1/satellites/25544",
                { referrerPolicy: "no-referrer" },
            );
            const data = await res.json();
            if (issEntity && data.latitude) {
                issEntity.position = Cesium.Cartesian3.fromDegrees(
                    data.longitude,
                    data.latitude,
                    data.altitude * 1000,
                );
            }
        } catch {
            /* ignore */
        }
    };

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

        <!-- ISS Live Tracker -->
        <button
            onclick={toggleISS}
            class="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold transition-all rounded border
      {showISS
                ? 'border-red-500 text-red-500 bg-red-500/10 animate-pulse'
                : 'border-[#2a3138] text-[#9da7b3]'}"
        >
            ISS {showISS ? "TRACKING" : "OFF"}
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

        {#if webglError}
            <div
                class="absolute inset-0 flex items-center justify-center bg-[#0b0f14] z-10"
            >
                <div
                    class="text-center max-w-md border border-red-500/30 bg-red-500/5 p-8 rounded-lg"
                >
                    <p
                        class="text-red-400 font-bold mb-4 uppercase tracking-widest text-lg"
                    >
                        WebGL Disabled
                    </p>
                    <p class="text-[#9da7b3] text-sm leading-relaxed mb-4">
                        The Explorer subsystem requires hardware acceleration
                        (WebGL) to render the 3D globe.
                    </p>
                    <p class="text-[#9da7b3]/60 text-xs italic">
                        This is often disabled in privacy browsers (LibreWolf,
                        Tor) or headless environments. Please enable WebGL in
                        your browser settings to access this module.
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
