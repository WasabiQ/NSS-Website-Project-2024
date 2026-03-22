<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { fade } from "svelte/transition";
    import * as Cesium from "cesium";

    // ── Types & Interfaces ─────────────────────────────────────
    interface RoverImage {
        id: number;
        title: string;
        url: string;
        camera: string;
        sol: number;
        date: string;
    }

    type Rover = "curiosity" | "opportunity" | "spirit" | "perseverance";
    type TrekBody = "moon" | "mars" | "vesta";

    // ── Tab State ─────────────────────────────────────────────
    let activeTab = $state<"rovers" | "trek">("rovers");

    // ── Rovers State ──────────────────────────────────────────
    let marsImages = $state<RoverImage[]>([]);
    let loadingRovers = $state(false);
    let selectedRover = $state<Rover>("perseverance");
    let marsSol = $state(1000);
    let selectedImage = $state<RoverImage | null>(null);

    // ── Trek State ────────────────────────────────────────────
    let selectedBody = $state<TrekBody>("moon");
    let cesiumContainer = $state<HTMLDivElement | null>(null);
    let viewer: Cesium.Viewer | null = null;
    let loadingTrek = $state(false);

    // ── Lifecycle ─────────────────────────────────────────────
    onMount(() => {
        fetchMarsImages();
    });

    onDestroy(() => {
        destroyTrekViewer();
    });

    $effect(() => {
        if (activeTab === "trek") {
            if (!viewer && cesiumContainer) {
                initTrekViewer();
            }
        } else {
            destroyTrekViewer();
        }
    });

    $effect(() => {
        if (activeTab === "trek" && viewer) {
            updateTrekBody();
        }
    });

    // ── Rover Methods ─────────────────────────────────────────
    const fetchMarsImages = async () => {
        if (marsSol < 0 || marsSol > 5000) marsSol = 1000;

        loadingRovers = true;
        marsImages = []; // free memory eagerly

        try {
            // Security: encode inputs, no-referrer
            const roverParam = encodeURIComponent(selectedRover);
            const solParam = encodeURIComponent(Math.floor(marsSol).toString());

            const res = await fetch(
                `https://api.nasa.gov/mars-photos/api/v1/rovers/${roverParam}/photos?sol=${solParam}&page=1&api_key=DEMO_KEY`,
                { referrerPolicy: "no-referrer" },
            );

            if (!res.ok) throw new Error("API FAILED");

            const data = await res.json();
            marsImages = (data.photos || []).slice(0, 40).map((p: any) => ({
                id: p.id,
                title: `${p.camera.full_name}`,
                url: p.img_src,
                camera: p.camera.name,
                sol: p.sol,
                date: p.earth_date,
            }));
        } catch (err) {
            console.error("Failed to fetch Mars images", err);
        } finally {
            loadingRovers = false;
        }
    };

    const openImage = (img: RoverImage) => {
        selectedImage = img;
    };
    const closeImage = () => {
        selectedImage = null;
    };

    const handleImageKeydown = (e: KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "Enter") closeImage();
    };

    // ── Trek Methods (EXTREME OPTIMIZATION) ───────────────────
    const getEllipsoid = (body: TrekBody): Cesium.Ellipsoid => {
        switch (body) {
            case "moon":
                return new Cesium.Ellipsoid(1737400.0, 1737400.0, 1737400.0);
            case "mars":
                return new Cesium.Ellipsoid(3396190.0, 3396190.0, 3376200.0);
            case "vesta":
                return new Cesium.Ellipsoid(285000.0, 265000.0, 229000.0);
        }
    };

    const getWMTSUrl = (body: TrekBody): string => {
        switch (body) {
            case "moon":
                return "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg";
            case "mars":
                return "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg";
            case "vesta":
                return "https://trek.nasa.gov/tiles/Vesta/EQ/Vesta_Dawn_GRaND_ClrIronCorrectedCounts_Global_2ppd/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg";
        }
    };

    const initTrekViewer = () => {
        if (!cesiumContainer || viewer) return;
        loadingTrek = true;
        try {
            viewer = new Cesium.Viewer(cesiumContainer, {
                animation: false,
                baseLayerPicker: false,
                fullscreenButton: false,
                vrButton: false,
                geocoder: false,
                homeButton: false,
                infoBox: false,
                sceneModePicker: false,
                selectionIndicator: false,
                timeline: false,
                navigationHelpButton: false,
                navigationInstructionsInitiallyVisible: false,
                scene3DOnly: true,
                requestRenderMode: true, // Memory/Battery Optimization
                maximumRenderTimeChange: Infinity,
            });

            // Remove credit container to keep UI clean
            (viewer.cesiumWidget.creditContainer as HTMLElement).style.display =
                "none";
            updateTrekBody();
        } catch (err) {
            console.error("Cesium init failed", err);
        }
        loadingTrek = false;
    };

    const updateTrekBody = () => {
        if (!viewer) return;

        // Clear old layers
        viewer.imageryLayers.removeAll();

        const ellipsoid = getEllipsoid(selectedBody);
        viewer.scene.globe.ellipsoid = ellipsoid;

        const provider = new Cesium.WebMapTileServiceImageryProvider({
            url: getWMTSUrl(selectedBody),
            layer: "default",
            style: "default",
            format: "image/jpeg",
            tileMatrixSetID: "default028mm",
            ellipsoid: ellipsoid,
        });

        viewer.imageryLayers.addImageryProvider(provider);

        // Reset camera appropriately for the specific body
        const initialHeight = ellipsoid.maximumRadius * 3;
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                0,
                0,
                initialHeight,
                ellipsoid,
            ),
            duration: 1.0,
        });
    };

    // EXTREME MEMORY LEAK PREVENTION
    const destroyTrekViewer = () => {
        if (viewer) {
            try {
                viewer.destroy();
            } catch (e) {
                /* ignore cleanup errors */
            }
            viewer = null;
            if (cesiumContainer) cesiumContainer.innerHTML = "";
        }
    };
</script>

<div
    class="flex flex-col w-full h-full bg-[#11161c] border border-[#2a3138] rounded-xl overflow-hidden shadow-2xl font-mono"
>
    <!-- Header -->
    <div
        class="flex items-center justify-between border-b border-[#2a3138] bg-[#161b22]"
    >
        <div class="flex">
            <button
                class="px-6 py-4 text-xs uppercase tracking-widest font-bold transition-colors {activeTab ===
                'rovers'
                    ? 'text-[#4da3ff] bg-[#0b0f14]'
                    : 'text-[#9da7b3] hover:text-[#e6edf3]'}"
                onclick={() => (activeTab = "rovers")}
            >
                Mars Rovers
            </button>
            <button
                class="px-6 py-4 text-xs uppercase tracking-widest font-bold transition-colors {activeTab ===
                'trek'
                    ? 'text-emerald-400 bg-[#0b0f14]'
                    : 'text-[#9da7b3] hover:text-[#e6edf3]'}"
                onclick={() => (activeTab = "trek")}
            >
                NASA Trek WMTS
            </button>
        </div>

        <div class="flex items-center gap-3 pr-4">
            {#if activeTab === "rovers"}
                <label
                    class="flex items-center gap-2 text-[9px] uppercase tracking-widest text-[#9da7b3]/60"
                >
                    Rover:
                    <select
                        bind:value={selectedRover}
                        class="bg-[#0b0f14] border border-[#2a3138] rounded px-2 py-1 text-xs text-[#e6edf3] outline-none focus:border-[#4da3ff]/50 uppercase"
                    >
                        <option value="perseverance">Perseverance</option>
                        <option value="curiosity">Curiosity</option>
                        <option value="opportunity">Opportunity</option>
                        <option value="spirit">Spirit</option>
                    </select>
                </label>
                <label
                    class="flex items-center gap-2 text-[9px] uppercase tracking-widest text-[#9da7b3]/60"
                >
                    Sol:
                    <input
                        type="number"
                        min="1"
                        max="5000"
                        bind:value={marsSol}
                        class="w-16 bg-[#0b0f14] border border-[#2a3138] rounded px-2 py-1 text-xs text-[#e6edf3] outline-none focus:border-[#4da3ff]/50"
                    />
                </label>
                <button
                    onclick={() => fetchMarsImages()}
                    class="px-3 py-1.5 border border-[#4da3ff] text-[#4da3ff] text-[10px] uppercase tracking-widest hover:bg-[#4da3ff] hover:text-[#0b0f14] transition-colors rounded font-bold"
                >
                    Fetch
                </button>
            {:else}
                <label
                    class="flex items-center gap-2 text-[9px] uppercase tracking-widest text-[#9da7b3]/60"
                >
                    Target Body:
                    <select
                        bind:value={selectedBody}
                        class="bg-[#0b0f14] border border-[#2a3138] rounded px-2 py-1 text-xs text-emerald-400 outline-none focus:border-emerald-400/50 uppercase"
                    >
                        <option value="moon">Moon Maps (LRO WAC)</option>
                        <option value="mars">Mars Maps (MGS MOLA)</option>
                        <option value="vesta">Vesta Maps (Dawn GRaND)</option>
                    </select>
                </label>
            {/if}
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 relative bg-[#0b0f14]">
        {#if activeTab === "rovers"}
            <div class="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
                {#if loadingRovers}
                    <div class="flex items-center justify-center h-full">
                        <div class="flex flex-col items-center gap-4">
                            <div
                                class="w-8 h-8 border-2 border-[#4da3ff] border-t-transparent rounded-full animate-spin"
                            ></div>
                            <span
                                class="text-[10px] uppercase tracking-widest text-[#9da7b3]/60"
                                >Connecting to DSN...</span
                            >
                        </div>
                    </div>
                {:else}
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {#each marsImages as img (img.id)}
                            <button
                                class="group relative overflow-hidden rounded-lg border border-[#2a3138] bg-[#11161c] hover:border-[#4da3ff]/40 transition-all cursor-pointer aspect-square block text-left"
                                onclick={() => openImage(img)}
                            >
                                <!-- Anti-fingerprint and performance flags on images -->
                                <img
                                    src={img.url}
                                    alt="{img.title} Rover Cam"
                                    loading="lazy"
                                    decoding="async"
                                    crossorigin="anonymous"
                                    referrerpolicy="no-referrer"
                                    class="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-700"
                                />
                                <div
                                    class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-transparent p-3 pointer-events-none"
                                >
                                    <p
                                        class="text-[10px] font-bold text-[#e6edf3] truncate"
                                    >
                                        {img.camera}
                                    </p>
                                    <p class="text-[9px] text-[#4da3ff]">
                                        Sol {img.sol} · {selectedRover.toUpperCase()}
                                    </p>
                                </div>
                            </button>
                        {/each}
                    </div>
                    {#if marsImages.length === 0}
                        <div
                            class="text-[#9da7b3]/50 text-center mt-20 text-sm flex flex-col items-center gap-2"
                        >
                            <span class="text-3xl">📡</span>
                            <span
                                >NO DATA RECEIVED FROM {selectedRover.toUpperCase()}
                                FOR SOL {marsSol}.</span
                            >
                        </div>
                    {/if}
                {/if}
            </div>
        {:else}
            <!-- Trek Viewer Container -->
            <div class="absolute inset-0">
                <div bind:this={cesiumContainer} class="w-full h-full"></div>
                {#if loadingTrek}
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-[#0b0f14] z-10"
                    >
                        <div class="flex flex-col items-center gap-4">
                            <div
                                class="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"
                            ></div>
                            <span
                                class="text-[10px] uppercase tracking-widest text-emerald-400/60"
                                >Initializing WebGL Engine...</span
                            >
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Lightbox -->
    {#if selectedImage}
        <div
            class="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-8"
            role="dialog"
            aria-label="Rover Image Lightbox"
            tabindex="-1"
            onclick={closeImage}
            onkeydown={handleImageKeydown}
            transition:fade
        >
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <section
                class="max-w-5xl max-h-full flex flex-col items-center gap-4"
                role="document"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
            >
                <img
                    src={selectedImage.url}
                    alt="{selectedImage.title} Full Resolution"
                    class="max-w-full max-h-[75vh] object-contain border border-[#4da3ff]/30 rounded-lg"
                    crossorigin="anonymous"
                    referrerpolicy="no-referrer"
                    decoding="async"
                />
                <div class="text-center max-w-2xl">
                    <p class="text-sm font-bold text-[#4da3ff] mb-1">
                        {selectedImage.camera}
                    </p>
                    <p class="text-xs text-[#9da7b3]/70 uppercase">
                        {selectedRover} · Sol {selectedImage.sol} · {selectedImage.date}
                    </p>
                </div>
                <button
                    onclick={closeImage}
                    class="px-4 py-2 border border-[#2a3138] text-[#9da7b3] text-[10px] uppercase tracking-widest hover:border-[#4da3ff] hover:text-[#4da3ff] transition-colors rounded"
                >
                    [ Esc to Close ]
                </button>
            </section>
        </div>
    {/if}
</div>
