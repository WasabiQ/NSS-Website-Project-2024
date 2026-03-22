import "clsx";
import { n as noop, a3 as attr_class, a4 as attr_style, a5 as stringify, a6 as store_get, a7 as ensure_array_like, e as escape_html, a8 as unsubscribe_stores } from "../../chunks/index2.js";
import { w as writable } from "../../chunks/index.js";
import "marked";
import "function-plot";
const now = () => Date.now();
const raf = {
  // don't access requestAnimationFrame eagerly outside method
  // this allows basic testing of user code without JSDOM
  // bunder will eval and remove ternary when the user's app is built
  tick: (
    /** @param {any} _ */
    (_) => noop()
  ),
  now: () => now(),
  tasks: /* @__PURE__ */ new Set()
};
function loop(callback) {
  let task;
  if (raf.tasks.size === 0) ;
  return {
    promise: new Promise((fulfill) => {
      raf.tasks.add(task = { c: callback, f: fulfill });
    }),
    abort() {
      raf.tasks.delete(task);
    }
  };
}
function is_date(obj) {
  return Object.prototype.toString.call(obj) === "[object Date]";
}
function tick_spring(ctx, last_value, current_value, target_value) {
  if (typeof current_value === "number" || is_date(current_value)) {
    const delta = target_value - current_value;
    const velocity = (current_value - last_value) / (ctx.dt || 1 / 60);
    const spring2 = ctx.opts.stiffness * delta;
    const damper = ctx.opts.damping * velocity;
    const acceleration = (spring2 - damper) * ctx.inv_mass;
    const d = (velocity + acceleration) * ctx.dt;
    if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
      return target_value;
    } else {
      ctx.settled = false;
      return is_date(current_value) ? new Date(current_value.getTime() + d) : current_value + d;
    }
  } else if (Array.isArray(current_value)) {
    return current_value.map(
      (_, i) => (
        // @ts-ignore
        tick_spring(ctx, last_value[i], current_value[i], target_value[i])
      )
    );
  } else if (typeof current_value === "object") {
    const next_value = {};
    for (const k in current_value) {
      next_value[k] = tick_spring(ctx, last_value[k], current_value[k], target_value[k]);
    }
    return next_value;
  } else {
    throw new Error(`Cannot spring ${typeof current_value} values`);
  }
}
function spring(value, opts = {}) {
  const store = writable(value);
  const { stiffness = 0.15, damping = 0.8, precision = 0.01 } = opts;
  let last_time;
  let task;
  let current_token;
  let last_value = (
    /** @type {T} */
    value
  );
  let target_value = (
    /** @type {T | undefined} */
    value
  );
  let inv_mass = 1;
  let inv_mass_recovery_rate = 0;
  let cancel_task = false;
  function set(new_value, opts2 = {}) {
    target_value = new_value;
    const token = current_token = {};
    if (value == null || opts2.hard || spring2.stiffness >= 1 && spring2.damping >= 1) {
      cancel_task = true;
      last_time = raf.now();
      last_value = new_value;
      store.set(value = target_value);
      return Promise.resolve();
    } else if (opts2.soft) {
      const rate = opts2.soft === true ? 0.5 : +opts2.soft;
      inv_mass_recovery_rate = 1 / (rate * 60);
      inv_mass = 0;
    }
    if (!task) {
      last_time = raf.now();
      cancel_task = false;
      task = loop((now2) => {
        if (cancel_task) {
          cancel_task = false;
          task = null;
          return false;
        }
        inv_mass = Math.min(inv_mass + inv_mass_recovery_rate, 1);
        const elapsed = Math.min(now2 - last_time, 1e3 / 30);
        const ctx = {
          inv_mass,
          opts: spring2,
          settled: true,
          dt: elapsed * 60 / 1e3
        };
        const next_value = tick_spring(ctx, last_value, value, target_value);
        last_time = now2;
        last_value = /** @type {T} */
        value;
        store.set(value = /** @type {T} */
        next_value);
        if (ctx.settled) {
          task = null;
        }
        return !ctx.settled;
      });
    }
    return new Promise((fulfil) => {
      task.promise.then(() => {
        if (token === current_token) fulfil();
      });
    });
  }
  const spring2 = {
    set,
    update: (fn, opts2) => set(fn(
      /** @type {T} */
      target_value,
      /** @type {T} */
      value
    ), opts2),
    subscribe: store.subscribe,
    stiffness,
    damping,
    precision
  };
  return spring2;
}
function AstroNaut($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const isMobile = typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)").matches : false;
    let coords = spring({ x: 0, y: 0 }, { stiffness: 0.15, damping: 0.4 });
    let ripples = [];
    let activePanel = "Home";
    const navItems = [
      { id: "Home", label: "Home" },
      { id: "Explorer", label: "Explorer" },
      { id: "JotDown", label: "Jot Down" },
      { id: "QuickBits", label: "Skynet" },
      { id: "Eyes", label: "Eyes" },
      { id: "DSN", label: "DSN" }
    ];
    $$renderer2.push(`<div class="w-screen h-screen bg-[#0b0f14] text-[#e6edf3] font-mono flex overflow-hidden select-none svelte-1n9x7k9">`);
    if (!isMobile) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class(
        `pointer-events-none fixed z-[999] rounded-full flex items-center justify-center transition-all duration-300 ease-out ${stringify("w-6 h-6 border-[#4da3ff]/40")}`,
        "svelte-1n9x7k9"
      )}${attr_style(`left: ${stringify(store_get($$store_subs ??= {}, "$coords", coords).x)}px; top: ${stringify(store_get($$store_subs ??= {}, "$coords", coords).y)}px; transform: translate(-50%, -50%); border-width: 1px;`)}><div${attr_class(`w-1 h-1 bg-[#4da3ff] rounded-full ${stringify("scale-100")} transition-transform`, "svelte-1n9x7k9")}></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array = ensure_array_like(ripples);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let ripple = each_array[$$index];
      $$renderer2.push(`<div class="pointer-events-none fixed z-[998] w-4 h-4 border-2 border-[#4da3ff] rounded-full animate-radio-ping svelte-1n9x7k9"${attr_style(`left: ${stringify(ripple.x)}px; top: ${stringify(ripple.y)}px; transform: translate(-50%, -50%);`)}></div>`);
    }
    $$renderer2.push(`<!--]--> <aside class="w-20 bg-[#11161c] border-r border-[#2a3138] flex flex-col items-center py-10 gap-8 z-20 svelte-1n9x7k9"><!--[-->`);
    const each_array_1 = ensure_array_like(navItems);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let item = each_array_1[$$index_1];
      $$renderer2.push(`<button${attr_class(
        `w-10 h-10 border flex items-center justify-center text-[10px] font-bold transition-all hover:scale-110 active:scale-95 ${stringify(activePanel === item.id ? "border-[#4da3ff] text-[#4da3ff] bg-[#4da3ff]/5" : "border-[#2a3138] text-[#9da7b3]")}`,
        "svelte-1n9x7k9"
      )}>${escape_html(item.id.slice(0, 2).toUpperCase())}</button>`);
    }
    $$renderer2.push(`<!--]--></aside> <main class="flex-1 flex items-center justify-center relative p-8 svelte-1n9x7k9">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex flex-col items-center w-full max-w-3xl h-full overflow-y-auto custom-scrollbar px-6 py-16 svelte-1n9x7k9"><div class="mb-12 text-center svelte-1n9x7k9"><h1 class="text-6xl font-black italic tracking-tighter text-[#4da3ff] uppercase svelte-1n9x7k9">ASTRONAUT</h1> <p class="text-[9px] mt-2 tracking-[0.5em] text-[#9da7b3] opacity-40 uppercase svelte-1n9x7k9">Satellite Command Hub</p></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></main></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer) {
  AstroNaut($$renderer);
}
export {
  _page as default
};
