<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    interface Signal {
        type: "up" | "down";
        band: string;
        dataRate: string;
        power: string;
        spacecraft: string;
    }

    interface Target {
        name: string;
        upRange: string;
        downRange: string;
        rtlt: string; // Round-trip light time
    }

    interface Dish {
        name: string;
        activity: string;
        azimuth: string;
        elevation: string;
        wind: string;
        targets: Target[];
        signals: Signal[];
    }

    interface Station {
        friendlyName: string;
        timeUTC: string;
        dishes: Dish[];
    }

    let stations = $state<Station[]>([]);
    let loading = $state(true);
    let error = $state("");
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let lastUpdate = $state<Date | null>(null);

    const fetchDSN = async () => {
        try {
            const res = await fetch("https://eyes.nasa.gov/dsn/data/dsn.xml", {
                referrerPolicy: "no-referrer",
                cache: "no-store",
            });
            if (!res.ok) throw new Error("NASA DSN API unreachable");

            const text = await res.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, "text/xml");

            const root = xml.documentElement;
            const newStations: Station[] = [];
            let currentStation: Station | null = null;

            for (let i = 0; i < root.children.length; i++) {
                const node = root.children[i];

                if (node.tagName === "station") {
                    currentStation = {
                        friendlyName:
                            node.getAttribute("friendlyName") ||
                            "Unknown Station",
                        timeUTC: node.getAttribute("timeUTC") || "",
                        dishes: [],
                    };
                    newStations.push(currentStation);
                } else if (node.tagName === "dish" && currentStation) {
                    const dish: Dish = {
                        name: node.getAttribute("name") || "Unknown",
                        activity: node.getAttribute("activity") || "Idle",
                        azimuth: node.getAttribute("azimuthAngle") || "0",
                        elevation: node.getAttribute("elevationAngle") || "0",
                        wind: node.getAttribute("windSpeed") || "0",
                        targets: [],
                        signals: [],
                    };

                    for (let j = 0; j < node.children.length; j++) {
                        const child = node.children[j];
                        if (child.tagName === "target") {
                            dish.targets.push({
                                name: child.getAttribute("name") || "",
                                upRange: child.getAttribute("uplegRange") || "",
                                downRange:
                                    child.getAttribute("downlegRange") || "",
                                rtlt: child.getAttribute("rtlt") || "",
                            });
                        } else if (
                            child.tagName === "upSignal" ||
                            child.tagName === "downSignal"
                        ) {
                            if (child.getAttribute("active") === "true") {
                                dish.signals.push({
                                    type:
                                        child.tagName === "upSignal"
                                            ? "up"
                                            : "down",
                                    band: child.getAttribute("band") || "",
                                    dataRate:
                                        child.getAttribute("dataRate") || "0",
                                    power: child.getAttribute("power") || "0",
                                    spacecraft:
                                        child.getAttribute("spacecraft") || "",
                                });
                            }
                        }
                    }
                    currentStation.dishes.push(dish);
                }
            }

            stations = newStations;
            lastUpdate = new Date();
            error = "";
        } catch (err: any) {
            error = err.message || "Failed to fetch DSN data";
        } finally {
            loading = false;
        }
    };

    onMount(() => {
        fetchDSN();
        pollInterval = setInterval(fetchDSN, 5000);
    });

    onDestroy(() => {
        if (pollInterval) clearInterval(pollInterval);
    });

    const formatRate = (rateStr: string) => {
        const r = parseFloat(rateStr);
        if (isNaN(r)) return "0 bps";
        if (r > 1000000) return (r / 1000000).toFixed(2) + " Mbps";
        if (r > 1000) return (r / 1000).toFixed(2) + " kbps";
        return r.toFixed(0) + " bps";
    };
</script>

<div
    class="flex flex-col w-full h-full bg-[#11161c] border border-[#2a3138] rounded-xl overflow-hidden shadow-2xl font-mono text-[#9da7b3]"
>
    <div
        class="flex items-center justify-between px-6 py-4 border-b border-[#2a3138] bg-[#161b22]"
    >
        <div class="flex items-center gap-4">
            <h2
                class="text-sm font-bold uppercase tracking-widest text-[#e6edf3]"
            >
                Deep Space Network
            </h2>
            {#if loading && stations.length === 0}
                <span class="text-[10px] text-emerald-400 animate-pulse"
                    >Establishing Uplink...</span
                >
            {:else if error}
                <span class="text-[10px] text-red-500">{error}</span>
            {:else}
                <span class="text-[10px] text-emerald-400">● LIVE</span>
            {/if}
        </div>
        <div class="text-[10px] uppercase tracking-widest text-[#9da7b3]/60">
            Last Refresh: {lastUpdate ? lastUpdate.toLocaleTimeString() : "---"}
        </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div class="flex flex-col gap-8">
            {#each stations as station}
                <div
                    class="bg-[#0b0f14] border border-[#2a3138] rounded-lg overflow-hidden"
                >
                    <div
                        class="px-4 py-2 bg-[#2a3138]/20 border-b border-[#2a3138]"
                    >
                        <h3
                            class="text-xs font-bold text-[#4da3ff] uppercase tracking-wider"
                        >
                            {station.friendlyName} Complex
                        </h3>
                    </div>

                    <div
                        class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {#each station.dishes as dish}
                            <div
                                class="border border-[#2a3138] rounded p-3 bg-[#11161c] flex flex-col gap-3"
                            >
                                <div class="flex justify-between items-start">
                                    <div>
                                        <span
                                            class="text-lg font-bold text-[#e6edf3]"
                                            >{dish.name}</span
                                        >
                                        <p
                                            class="text-[9px] uppercase tracking-widest text-emerald-400 mt-1 truncate"
                                            title={dish.activity}
                                        >
                                            {dish.activity}
                                        </p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-[10px]">
                                            AZ: <span class="text-[#e6edf3]"
                                                >{dish.azimuth}°</span
                                            >
                                        </p>
                                        <p class="text-[10px]">
                                            EL: <span class="text-[#e6edf3]"
                                                >{dish.elevation}°</span
                                            >
                                        </p>
                                        <p class="text-[10px]">
                                            WIND: <span class="text-[#e6edf3]"
                                                >{dish.wind} km/h</span
                                            >
                                        </p>
                                    </div>
                                </div>

                                {#if dish.signals.length > 0 || dish.targets.length > 0}
                                    <div
                                        class="border-t border-[#2a3138] pt-2 mt-1"
                                    >
                                        {#each dish.signals as sig}
                                            <div
                                                class="flex justify-between items-center text-[10px] mb-1"
                                            >
                                                <span
                                                    class="flex items-center gap-1 font-bold {sig.type ===
                                                    'up'
                                                        ? 'text-[#4da3ff]'
                                                        : 'text-emerald-400'}"
                                                >
                                                    {sig.type === "up"
                                                        ? "↑ UP"
                                                        : "↓ DN"} ({sig.band})
                                                </span>
                                                <span
                                                    class="text-[#e6edf3] truncate text-right"
                                                    >{sig.spacecraft}: {formatRate(
                                                        sig.dataRate,
                                                    )}</span
                                                >
                                            </div>
                                        {/each}

                                        {#if dish.targets.some((t) => parseFloat(t.rtlt) > 0)}
                                            <div
                                                class="mt-2 text-[9px] text-[#9da7b3]/60"
                                            >
                                                {#each dish.targets.filter((t) => parseFloat(t.rtlt) > 0) as tgt}
                                                    <div
                                                        class="flex justify-between"
                                                    >
                                                        <span
                                                            >TARGET: {tgt.name}</span
                                                        >
                                                        <span
                                                            >RTLT: {(
                                                                parseFloat(
                                                                    tgt.rtlt,
                                                                ) / 3600
                                                            ).toFixed(2)} hrs</span
                                                        >
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                {:else}
                                    <div
                                        class="border-t border-[#2a3138] pt-2 mt-1 flex-1 flex items-center justify-center"
                                    >
                                        <span
                                            class="text-[10px] text-[#9da7b3]/40 uppercase tracking-widest"
                                            >Standing By</span
                                        >
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>
