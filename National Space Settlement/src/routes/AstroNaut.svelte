<script lang="ts">
  import { onMount } from "svelte";
  import { spring } from "svelte/motion";
  import { fade } from "svelte/transition";
  import type { ApodData, PanelID, NavItem } from "$lib/types";
  import Notes from "../components/Notes.svelte";
  import QuickBits from "../components/QuickBits.svelte";
  import ExplorerView from "../components/ExplorerView.svelte";
  import EyesView from "../components/EyesView.svelte";
  import DsnView from "../components/DsnView.svelte";

  // ==========================
  // DEVICE CHECK
  // ==========================
  const isMobile =
    typeof window !== "undefined"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;

  let active = $state(true);

  // ==========================
  // CURSOR SYSTEM
  // ==========================
  let coords = spring(
    { x: 0, y: 0 },
    {
      stiffness: 0.15,
      damping: 0.4,
    },
  );

  let hovering = $state(false);

  const handlePointer = (e: PointerEvent) => {
    if (!active) return;
    coords.set({ x: e.clientX, y: e.clientY });
  };

  // ==========================
  // RIPPLE SYSTEM
  // ==========================
  let ripples = $state<{ id: number; x: number; y: number }[]>([]);
  let rippleCount = 0;
  const MAX_RIPPLES = 10;

  const handleClick = (e: MouseEvent) => {
    const id = rippleCount++;
    ripples = [...ripples, { id, x: e.clientX, y: e.clientY }].slice(
      -MAX_RIPPLES,
    );

    const remove = () => {
      ripples = ripples.filter((r) => r.id !== id);
    };
    setTimeout(remove, 600);
  };

  // ==========================
  // TERMINAL SYSTEM
  // ==========================
  let terminalInput = $state("");
  let terminalFocus = $state(false);
  let terminalRef = $state<HTMLInputElement | null>(null);

  // ==========================
  // AUDIOSCAPE SYSTEM
  // ==========================
  let audioEnabled = $state(false);
  let audioCtx: AudioContext | null = null;
  let humOsc: OscillatorNode | null = null;
  let humGain: GainNode | null = null;

  const toggleAudio = () => {
    if (!audioEnabled) {
      const AudioContextCtor =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      audioCtx = new AudioContextCtor();
      humOsc = audioCtx.createOscillator();
      humGain = audioCtx.createGain();
      humOsc.type = "sine";
      humOsc.frequency.value = 55;
      humGain.gain.value = 0.05;
      humOsc.connect(humGain);
      humGain.connect(audioCtx.destination);
      humOsc.start();
      audioEnabled = true;
      if (audioCtx.state === "suspended") audioCtx.resume();
    } else {
      humOsc?.stop();
      humOsc?.disconnect();
      humGain?.disconnect();
      audioCtx?.suspend();
      audioEnabled = false;
    }
  };

  const playKeystroke = () => {
    if (!audioEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        40,
        audioCtx.currentTime + 0.05,
      );
      gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + 0.05,
      );
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch {
      /* ignore audio errors */
    }
  };

  const commandMap: Record<string, PanelID> = {
    "/eye": "Eyes",
    "/eyes": "Eyes",
    "/explorer": "Explorer",
    "/settings": "JotDown",
    "/home": "Home",
    "/skynet": "QuickBits",
    "/quickbits": "QuickBits",
    "/jotdown": "JotDown",
    "/notes": "JotDown",
    "/dsn": "DSN",
  };

  const availableCommands = Object.keys(commandMap);

  // 🔥 SMART SUGGESTION
  let suggestion = $derived.by(() => {
    if (!terminalInput || !terminalInput.startsWith("/")) return "";

    const input = terminalInput.toLowerCase();

    let match = availableCommands.find((cmd) => cmd.startsWith(input));

    if (!match) {
      match = availableCommands.find((cmd) => cmd.includes(input));
    }

    return match || "";
  });

  const processCommand = (e: KeyboardEvent) => {
    // autocomplete
    if (e.key === "Tab" || e.key === "ArrowRight") {
      if (suggestion && suggestion !== terminalInput) {
        e.preventDefault();
        terminalInput = suggestion;
        return;
      }
    }

    if (e.key !== "Enter") return;

    const cmd = terminalInput.toLowerCase().trim();
    const target = commandMap[cmd];

    if (target) {
      activePanel = target;
      triggerToast(`EXEC: ${cmd.toUpperCase()}`);
    } else {
      triggerToast("UNKNOWN_COMMAND");
    }

    terminalInput = "";
  };

  // ==========================
  // CORE STATE
  // ==========================
  let apod = $state<ApodData | null>(null);
  let activePanel = $state<PanelID | null>("Home");
  let toastMessage = $state("");
  let selectedImage = $state<string | null>(null);

  const navItems: NavItem[] = [
    { id: "Home", label: "Home" },
    { id: "Explorer", label: "Explorer" },
    { id: "JotDown", label: "Jot Down" },
    { id: "QuickBits", label: "Skynet" },
    { id: "Eyes", label: "Eyes" },
    { id: "DSN", label: "DSN" },
  ];

  // ==========================
  // APOD CACHE
  // ==========================
  const fetchApodWeekly = async () => {
    const WEEK = 604800000;
    try {
      const cache = localStorage.getItem("apod");
      const time = localStorage.getItem("apod_time");

      if (cache && time && Date.now() - Number(time) < WEEK) {
        apod = JSON.parse(cache);
        return;
      }
    } catch {
      /* LibreWolf strict isolation fallback */
    }

    try {
      const res = await fetch(
        `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`,
        { referrerPolicy: "no-referrer" },
      );
      const data = await res.json();
      apod = data;
      try {
        localStorage.setItem("apod", JSON.stringify(data));
        localStorage.setItem("apod_time", Date.now().toString());
      } catch {
        /* ignore */
      }
    } catch {
      triggerToast("APOD_ERR");
    }
  };

  const triggerToast = (msg: string) => {
    toastMessage = msg;
    setTimeout(() => (toastMessage = ""), 2000);
  };

  // ==========================
  // LIFECYCLE
  // ==========================
  onMount(() => {
    fetchApodWeekly();

    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        terminalRef?.focus();
      }
    };

    if (!isMobile) {
      window.addEventListener("pointermove", handlePointer);
      window.addEventListener("mousedown", handleClick);
    }

    const onVisibilityChange = () => {
      active = !document.hidden;
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  });
</script>

<div
  class="w-screen h-screen bg-[#0b0f14] text-[#e6edf3] font-mono flex overflow-hidden select-none"
>
  {#if !isMobile}
    <div
      class="pointer-events-none fixed z-[999] rounded-full flex items-center justify-center transition-all duration-300 ease-out
      {hovering
        ? 'w-10 h-10 border-[#4da3ff] bg-[#4da3ff]/10 shadow-[0_0_20px_rgba(77,163,255,0.2)]'
        : 'w-6 h-6 border-[#4da3ff]/40'}"
      style="left: {$coords.x}px; top: {$coords.y}px; transform: translate(-50%, -50%); border-width: 1px;"
    >
      <div
        class="w-1 h-1 bg-[#4da3ff] rounded-full {hovering
          ? 'scale-150'
          : 'scale-100'} transition-transform"
      ></div>
    </div>
  {/if}

  {#each ripples as ripple (ripple.id)}
    <div
      class="pointer-events-none fixed z-[998] w-4 h-4 border-2 border-[#4da3ff] rounded-full animate-radio-ping"
      style="left: {ripple.x}px; top: {ripple.y}px; transform: translate(-50%, -50%);"
    ></div>
  {/each}

  <aside
    class="w-20 bg-[#11161c] border-r border-[#2a3138] flex flex-col items-center py-10 gap-8 z-20"
  >
    {#each navItems as item}
      <button
        onclick={() => (activePanel = item.id)}
        onmouseenter={() => (hovering = true)}
        onmouseleave={() => (hovering = false)}
        class="w-10 h-10 border flex items-center justify-center text-[10px] font-bold transition-all hover:scale-110 active:scale-95
        {activePanel === item.id
          ? 'border-[#4da3ff] text-[#4da3ff] bg-[#4da3ff]/5'
          : 'border-[#2a3138] text-[#9da7b3]'}"
      >
        {item.id.slice(0, 2).toUpperCase()}
      </button>
    {/each}
  </aside>

  <main class="flex-1 flex items-center justify-center relative p-8">
    {#if toastMessage}
      <div
        class="fixed top-8 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#161b22] border border-[#4da3ff] text-[#4da3ff] text-[10px] uppercase tracking-widest z-50"
        transition:fade
      >
        {toastMessage}
      </div>
    {/if}

    {#if activePanel === "Home"}
      <div
        class="flex flex-col items-center w-full max-w-3xl h-full overflow-y-auto custom-scrollbar px-6 py-16"
        transition:fade
      >
        <div class="mb-12 text-center">
          <h1
            class="text-6xl font-black italic tracking-tighter text-[#4da3ff] uppercase"
          >
            ASTRONAUT
          </h1>
          <p
            class="text-[9px] mt-2 tracking-[0.5em] text-[#9da7b3] opacity-40 uppercase"
          >
            Satellite Command Hub
          </p>
        </div>

        {#if apod}
          <div class="w-full flex flex-col gap-6">
            <button
              class="rounded-lg overflow-hidden border border-[#2a3138] bg-[#11161c] w-full block text-left"
              onclick={() => (selectedImage = apod?.url || null)}
            >
              <img
                src={apod.url}
                class="w-full object-cover max-h-[50vh] grayscale hover:grayscale-0 transition-all duration-1000 cursor-pointer"
                alt="NASA Astronomy Picture of the Day: {apod.title}"
                crossorigin="anonymous"
                referrerpolicy="no-referrer"
              />
            </button>

            <button
              class="w-full py-2 bg-[#161b22] border border-[#2a3138] rounded-md text-[10px] uppercase tracking-widest hover:border-[#4da3ff] hover:text-[#4da3ff] transition-all {audioEnabled
                ? 'border-emerald-400 text-emerald-400 font-bold'
                : 'text-[#9da7b3]'}"
              onclick={toggleAudio}
            >
              OS AUDIOSCAPE {audioEnabled ? "[ ACTIVE ]" : "[ OFFLINE ]"}
            </button>

            <div
              class="group relative rounded-md {terminalFocus
                ? 'ring-1 ring-[#4da3ff]/50'
                : 'border border-[#2a3138]'}"
            >
              <div
                class="flex items-center justify-between px-4 py-2 bg-[#161b22]/90 border-b border-[#2a3138]"
              >
                <span class="text-[9px] text-[#9da7b3]/40 uppercase italic"
                  >zsh — session_01</span
                >
              </div>

              <div class="relative flex items-center p-4 bg-[#0b0f14]/95">
                <span class="text-[#4da3ff] mr-3">~</span>

                <div class="relative flex-1">
                  {#if suggestion && terminalFocus}
                    <span
                      class="absolute left-0 text-sm text-[#e6edf3]/20 pointer-events-none whitespace-pre"
                    >
                      {terminalInput}{suggestion.slice(terminalInput.length)}
                    </span>
                  {/if}

                  <input
                    bind:this={terminalRef}
                    bind:value={terminalInput}
                    onkeydown={processCommand}
                    onfocus={() => {
                      terminalFocus = true;
                      hovering = true;
                    }}
                    onblur={() => {
                      terminalFocus = false;
                      hovering = false;
                    }}
                    oninput={playKeystroke}
                    spellcheck="false"
                    class="relative z-10 w-full bg-transparent outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-between text-[9px] opacity-40">
              <p>{apod.title}</p>
              <p class="text-[#4da3ff]">LNK_CONNECTED</p>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if activePanel === "Explorer"}
      <div class="w-full h-[90vh]" transition:fade>
        <ExplorerView />
      </div>
    {/if}

    {#if activePanel === "JotDown"}
      <div class="w-full max-w-5xl h-[85vh]" transition:fade>
        <Notes />
      </div>
    {/if}

    {#if activePanel === "QuickBits"}
      <div class="w-full max-w-4xl h-[85vh]" transition:fade>
        <QuickBits />
      </div>
    {/if}

    {#if activePanel === "Eyes"}
      <div class="w-full max-w-6xl h-[85vh]" transition:fade>
        <EyesView />
      </div>
    {/if}

    {#if activePanel === "DSN"}
      <div class="w-full max-w-6xl h-[85vh]" transition:fade>
        <DsnView />
      </div>
    {/if}

    {#if selectedImage}
      <div
        class="fixed inset-0 bg-black/95 flex items-center justify-center z-[100]"
        role="dialog"
        aria-label="Image lightbox"
        tabindex="-1"
        onclick={() => (selectedImage = null)}
        onkeydown={(e) => {
          if (e.key === "Escape") selectedImage = null;
        }}
      >
        <img
          src={selectedImage}
          alt="Enlarged view"
          class="max-w-[90%] max-h-[90%] border border-[#4da3ff]"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
        />
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) {
    cursor: none;
    margin: 0;
  }
  input {
    cursor: text;
  }

  @keyframes radio-ping {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(2.8);
      opacity: 0;
    }
  }

  .animate-radio-ping {
    animation: radio-ping 0.6s forwards;
  }
</style>
