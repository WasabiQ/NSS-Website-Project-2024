export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.BNvWsSPI.js",app:"_app/immutable/entry/app.B6iSnhtg.js",imports:["_app/immutable/entry/start.BNvWsSPI.js","_app/immutable/chunks/D26yWcLm.js","_app/immutable/chunks/D6vIqBe6.js","_app/immutable/chunks/BsjLG_pH.js","_app/immutable/entry/app.B6iSnhtg.js","_app/immutable/chunks/D6vIqBe6.js","_app/immutable/chunks/DeHaKjyI.js","_app/immutable/chunks/fbOZAlQU.js","_app/immutable/chunks/BsjLG_pH.js","_app/immutable/chunks/4LtPglub.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
