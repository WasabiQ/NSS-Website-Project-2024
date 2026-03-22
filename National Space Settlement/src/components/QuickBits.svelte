<script lang="ts">
    import type { QuickBitsMessage } from "$lib/types";

    const SKYNET_URL = "http://localhost:8000";

    let messages = $state<QuickBitsMessage[]>([
        {
            id: "welcome",
            role: "skynet",
            content:
                "SKYNET v2.0 — Astronomy Intelligence Module\nQuery the cosmos. I can answer questions about planets, stars, black holes, nebulae, space missions, cosmology, and more.",
            timestamp: Date.now(),
        },
    ]);

    let inputText = $state("");
    let loading = $state(false);
    let chatContainer: HTMLDivElement | null = $state(null);

    const scrollToBottom = () => {
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 50);
    };

    const sendMessage = async () => {
        const text = inputText.trim();
        if (!text || loading) return;

        const userMsg: QuickBitsMessage = {
            id: `u-${Date.now()}`,
            role: "user",
            content: text,
            timestamp: Date.now(),
        };

        messages = [...messages, userMsg];
        inputText = "";
        loading = true;
        scrollToBottom();

        try {
            const res = await fetch(`${SKYNET_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            const skynetMsg: QuickBitsMessage = {
                id: `s-${Date.now()}`,
                role: "skynet",
                content: data.reply,
                timestamp: Date.now(),
            };

            messages = [...messages, skynetMsg];
        } catch (err: any) {
            const errorMsg: QuickBitsMessage = {
                id: `e-${Date.now()}`,
                role: "skynet",
                content: `CONNECTION_ERR: Unable to reach Skynet backend.\nMake sure the server is running: python src/Skynet.py\n\n${err.message}`,
                timestamp: Date.now(),
            };
            messages = [...messages, errorMsg];
        } finally {
            loading = false;
            scrollToBottom();
        }
    };

    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    };

    const clearChat = () => {
        messages = [messages[0]]; // Keep welcome message
    };
</script>

<div
    class="flex flex-col w-full h-full bg-[#11161c] border border-[#2a3138] rounded-xl overflow-hidden shadow-2xl font-mono"
>
    <!-- Header -->
    <div
        class="flex items-center justify-between px-6 py-4 border-b border-[#2a3138] bg-[#161b22]"
    >
        <div class="flex items-center gap-3">
            <div
                class="w-2 h-2 rounded-full {loading
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400'} shadow-[0_0_6px_rgba(52,211,153,0.5)]"
            ></div>
            <span
                class="text-xs uppercase tracking-widest font-bold text-[#4da3ff]"
                >Skynet</span
            >
            <span class="text-[9px] text-[#9da7b3]/40 uppercase"
                >v2.0 — Astronomy Module</span
            >
        </div>
        <button
            class="text-[9px] uppercase tracking-widest text-[#9da7b3]/40 hover:text-red-400 transition-colors"
            onclick={clearChat}
        >
            Clear
        </button>
    </div>

    <!-- Messages -->
    <div
        bind:this={chatContainer}
        class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-[#0b0f14]"
    >
        {#each messages as msg (msg.id)}
            <div
                class="flex {msg.role === 'user'
                    ? 'justify-end'
                    : 'justify-start'}"
            >
                <div
                    class="max-w-[80%] {msg.role === 'user'
                        ? 'bg-[#4da3ff]/10 border-[#4da3ff]/30'
                        : 'bg-[#161b22] border-[#2a3138]'} border rounded-lg px-5 py-4"
                >
                    <!-- Role tag -->
                    <div class="flex items-center gap-2 mb-2">
                        <span
                            class="text-[9px] uppercase tracking-widest font-bold {msg.role ===
                            'user'
                                ? 'text-[#4da3ff]'
                                : 'text-emerald-400'}"
                        >
                            {msg.role === "user" ? "You" : "Skynet"}
                        </span>
                        <span class="text-[9px] text-[#9da7b3]/30"
                            >{formatTime(msg.timestamp)}</span
                        >
                    </div>

                    <!-- Content -->
                    <div
                        class="text-sm leading-relaxed whitespace-pre-wrap {msg.role ===
                        'skynet'
                            ? 'text-[#e6edf3]/90'
                            : 'text-[#e6edf3]'}"
                    >
                        {msg.content}
                    </div>
                </div>
            </div>
        {/each}

        {#if loading}
            <div class="flex justify-start">
                <div
                    class="bg-[#161b22] border border-[#2a3138] rounded-lg px-5 py-4"
                >
                    <div class="flex items-center gap-2">
                        <span
                            class="text-[9px] uppercase tracking-widest font-bold text-emerald-400"
                            >Skynet</span
                        >
                        <div class="flex gap-1">
                            <div
                                class="w-1.5 h-1.5 bg-[#4da3ff] rounded-full animate-bounce"
                                style="animation-delay: 0ms"
                            ></div>
                            <div
                                class="w-1.5 h-1.5 bg-[#4da3ff] rounded-full animate-bounce"
                                style="animation-delay: 150ms"
                            ></div>
                            <div
                                class="w-1.5 h-1.5 bg-[#4da3ff] rounded-full animate-bounce"
                                style="animation-delay: 300ms"
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Input -->
    <div class="border-t border-[#2a3138] bg-[#161b22]">
        <form
            class="flex items-center"
            onsubmit={(e) => {
                e.preventDefault();
                sendMessage();
            }}
        >
            <span class="px-5 text-emerald-400 text-xs font-bold select-none"
                >SKY ></span
            >
            <input
                type="text"
                bind:value={inputText}
                onkeydown={handleKeydown}
                placeholder="Ask about the cosmos..."
                disabled={loading}
                spellcheck="false"
                class="flex-1 bg-transparent outline-none py-5 text-sm text-[#e6edf3] placeholder-[#9da7b3]/30 disabled:opacity-50"
            />
            <button
                type="submit"
                disabled={loading || !inputText.trim()}
                class="px-6 py-5 text-xs uppercase tracking-widest font-bold text-[#4da3ff] hover:bg-[#4da3ff] hover:text-[#0b0f14] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#4da3ff] border-l border-[#2a3138]"
            >
                Send
            </button>
        </form>
    </div>
</div>
