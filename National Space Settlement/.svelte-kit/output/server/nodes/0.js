

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.jRysKgRK.js","_app/immutable/chunks/Gi-3gm9s.js","_app/immutable/chunks/BUnNqFYZ.js","_app/immutable/chunks/okwaaZHn.js"];
export const stylesheets = ["_app/immutable/assets/0.BDOBL3av.css"];
export const fonts = [];
