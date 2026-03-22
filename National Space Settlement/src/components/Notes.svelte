<script lang="ts">
  import { onMount } from "svelte";
  import * as math from "mathjs";
  import { marked } from "marked";
  import functionPlot from "function-plot";

  const STORAGE_KEY_NOTES = "nss_jotdown_notes";
  const STORAGE_KEY_CALC = "nss_jotdown_calc";

  let notesText = $state(
    "# Module: Jot Down\n\nBegin your notes and analysis here...",
  );
  let calcInput = $state("");
  let calcHistory = $state<
    { type: "calc" | "graph"; expr: string; result: string; id: number }[]
  >([]);
  let activeTab = $state<"notes" | "calculator">("calculator");
  let historyId = 0;
  let mounted = false;

  // ── Restore from localStorage on mount ──
  onMount(() => {
    try {
      const savedNotes = localStorage.getItem(STORAGE_KEY_NOTES);
      if (savedNotes) notesText = savedNotes;

      const savedCalc = localStorage.getItem(STORAGE_KEY_CALC);
      if (savedCalc) {
        const parsed = JSON.parse(savedCalc);
        calcHistory = parsed;
        historyId =
          parsed.length > 0 ? Math.max(...parsed.map((p: any) => p.id)) + 1 : 0;
      }
    } catch {
      /* ignore corrupt data */
    }
    mounted = true;
  });

  // ── Auto-save notes text ──
  $effect(() => {
    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY_NOTES, notesText);
      } catch {
        /* ignore */
      }
    }
  });

  // ── Auto-save calc history ──
  $effect(() => {
    if (mounted && calcHistory.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_CALC, JSON.stringify(calcHistory));
      } catch {
        /* ignore */
      }
    }
  });

  // Render plots when we have them
  $effect(() => {
    const graphs = calcHistory.filter((h) => h.type === "graph");
    if (activeTab === "calculator" && graphs.length > 0) {
      setTimeout(() => renderGraphs(), 50);
    }
  });

  const handleCalc = () => {
    if (!calcInput.trim()) return;

    // Check if it's a graphing command (e.g. plot(sin(x)) or y = sin(x))
    const isPlot =
      calcInput.includes("y=") ||
      calcInput.includes("y =") ||
      calcInput.startsWith("plot(") ||
      calcInput.startsWith("graph(");

    if (isPlot) {
      let funcStr = calcInput;
      if (funcStr.startsWith("plot(") || funcStr.startsWith("graph(")) {
        funcStr = funcStr.substring(
          funcStr.indexOf("(") + 1,
          funcStr.lastIndexOf(")"),
        );
      } else {
        funcStr = funcStr.split("=")[1].trim();
      }

      calcHistory = [
        ...calcHistory,
        { id: historyId++, type: "graph", expr: calcInput, result: funcStr },
      ];
    } else {
      try {
        const res = math.evaluate(calcInput);
        calcHistory = [
          ...calcHistory,
          {
            id: historyId++,
            type: "calc",
            expr: calcInput,
            result: String(res),
          },
        ];
      } catch (err: any) {
        calcHistory = [
          ...calcHistory,
          {
            id: historyId++,
            type: "calc",
            expr: calcInput,
            result: "Error: " + err.message,
          },
        ];
      }
    }
    calcInput = "";
  };

  const renderGraphs = () => {
    calcHistory.forEach((item) => {
      if (item.type === "graph") {
        const el = document.getElementById(`graph-${item.id}`);
        if (el) {
          el.innerHTML = ""; // clear previous
          try {
            functionPlot({
              target: `#graph-${item.id}`,
              width: 500,
              height: 250,
              grid: true,
              data: [{ fn: item.result, color: "#4da3ff" }],
            });
          } catch (e) {
            console.error("Graphing error:", e);
            el.innerHTML = `<span class="text-red-500">Error graphing: ${item.result}</span>`;
          }
        }
      }
    });
  };

  const exportMarkdown = () => {
    let md = notesText + "\n\n---\n\n### Calculator & Graph Data\n\n";
    calcHistory.forEach((item) => {
      if (item.type === "calc") {
        md += `**Input:** \`${item.expr}\`\n**Result:** \`${item.result}\`\n\n`;
      } else {
        md += `**Graph Function:** \`y = ${item.result}\`\n\n`;
      }
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "NSS_Notes_Export.md";
    a.click();
    URL.revokeObjectURL(url);
  };
</script>

<div
  class="flex flex-col w-full h-full bg-[#11161c] border border-[#2a3138] rounded-xl overflow-hidden shadow-2xl font-mono"
>
  <div
    class="flex items-center justify-between border-b border-[#2a3138] bg-[#161b22]"
  >
    <div class="flex">
      <button
        class="px-6 py-4 text-xs uppercase tracking-widest font-bold transition-colors {activeTab ===
        'notes'
          ? 'text-[#4da3ff] bg-[#0b0f14]'
          : 'text-[#9da7b3] hover:text-[#e6edf3]'}"
        onclick={() => (activeTab = "notes")}
      >
        Notes Writer
      </button>
      <button
        class="px-6 py-4 text-xs uppercase tracking-widest font-bold transition-colors {activeTab ===
        'calculator'
          ? 'text-[#4da3ff] bg-[#0b0f14]'
          : 'text-[#9da7b3] hover:text-[#e6edf3]'}"
        onclick={() => (activeTab = "calculator")}
      >
        Desmos Level Calc
      </button>
    </div>
    <button
      class="px-4 py-2 mr-4 border border-[#4da3ff] text-[#4da3ff] text-xs uppercase tracking-widest hover:bg-[#4da3ff] hover:text-[#0b0f14] transition-colors rounded"
      onclick={exportMarkdown}
      aria-label="Export to Markdown"
    >
      Export .md
    </button>
  </div>

  <div class="flex-1 overflow-hidden relative">
    {#if activeTab === "notes"}
      <div class="absolute inset-0 flex h-full">
        <textarea
          class="flex-1 bg-transparent resize-none p-6 outline-none text-sm leading-relaxed custom-scrollbar border-r border-[#2a3138] w-1/2"
          bind:value={notesText}
          spellcheck="false"
        ></textarea>
        <div
          class="flex-1 p-6 overflow-y-auto custom-scrollbar prose prose-invert w-1/2 prose-pre:bg-[#0b0f14] prose-pre:border prose-pre:border-[#2a3138]"
          style="color: #e6edf3; font-family: sans-serif;"
        >
          <!-- Use unmarked container for markdown render -->
          {@html marked(notesText)}
        </div>
      </div>
    {:else}
      <div
        class="absolute inset-0 flex flex-col p-6 overflow-y-auto custom-scrollbar h-full bg-[#0b0f14]"
      >
        <div class="flex-1 space-y-6 mb-6">
          {#if calcHistory.length === 0}
            <div class="text-[#9da7b3]/50 text-center mt-10 text-sm italic">
              Computational interface ready.<br /><br />
              Try standard math: `2 + 2`, `sin(45 deg) ^ 2`<br />
              Or graphing: `y = x^2`, `plot(sin(x))`
            </div>
          {/if}

          {#each calcHistory as item}
            <div
              class="bg-[#11161c] border border-[#2a3138] rounded-lg p-5 font-mono text-sm shadow-sm relative group"
            >
              <div class="text-[#9da7b3] mb-3 text-xs uppercase tracking-wider">
                Input: <span class="text-[#e6edf3] lowercase normal-case"
                  >{item.expr}</span
                >
              </div>

              {#if item.type === "calc"}
                <div class="text-[#4da3ff] text-xl font-bold font-sans">
                  = {item.result}
                </div>
              {:else}
                <div
                  class="w-full flex justify-center bg-white rounded-md overflow-hidden p-2"
                >
                  <div id="graph-{item.id}"></div>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Sticky Input Area -->
        <div class="sticky bottom-0 bg-[#0b0f14] pt-4">
          <form
            class="flex border border-[#4da3ff]/40 rounded-lg overflow-hidden focus-within:border-[#4da3ff] transition-all shadow-[0_0_10px_rgba(77,163,255,0.05)] focus-within:shadow-[0_0_20px_rgba(77,163,255,0.2)]"
            onsubmit={(e) => {
              e.preventDefault();
              handleCalc();
            }}
          >
            <span
              class="bg-[#161b22] px-4 py-4 text-[#4da3ff] font-bold border-r border-[#2a3138] select-none text-xs flex items-center"
              >CALC ></span
            >
            <input
              type="text"
              class="flex-1 bg-transparent outline-none px-4 text-sm font-mono text-[#e6edf3] placeholder-[#9da7b3]/30"
              bind:value={calcInput}
              placeholder="e.g. 5cm to inch, log(10000, 10), y = sin(x)*x..."
            />
            <button
              type="submit"
              class="bg-[#161b22] text-[#4da3ff] px-8 hover:bg-[#4da3ff] hover:text-[#0b0f14] transition-colors font-bold uppercase text-xs tracking-wider border-l border-[#2a3138] group-focus-within:border-[#4da3ff]"
            >
              Evaluate
            </button>
          </form>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.function-plot text) {
    fill: #11161c;
    font-family: monospace;
  }
  :global(.function-plot .domain) {
    stroke: #2a3138;
  }
  :global(.function-plot .origin) {
    stroke: #2a3138;
  }
</style>
