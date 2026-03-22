import * as Cesium from 'cesium';

// ─── Public Types ───────────────────────────────────────────────────

export type ExplorerMode = 'dual' | 'street' | 'stars';
export type FlightMapMode = 'on' | 'off';
export type MapTheme = 'default' | 'CRT' | 'FLIR' | 'NVG';

export interface Coordinates {
  lon: number;
  lat: number;
  height?: number;
}

export interface ExplorerOptions {
  container: HTMLDivElement;
  defaultCoords?: Coordinates;
  mode?: ExplorerMode;
  flightMap?: FlightMapMode;
  theme?: MapTheme;
}

// ─── Theme Presets (data-driven, easy to extend) ────────────────────

interface ThemePreset {
  alpha: number;
  brightness: number;
  contrast: number;
  hue: number;
  saturation: number;
}

const THEME_PRESETS: Record<MapTheme, ThemePreset> = {
  default: { alpha: 1.0, brightness: 1.0, contrast: 1.0, hue: 0.0, saturation: 1.0 },
  CRT: { alpha: 0.8, brightness: 1.2, contrast: 2.0, hue: 0.25, saturation: 0.0 },
  FLIR: { alpha: 0.9, brightness: 1.0, contrast: 2.5, hue: 0.05, saturation: 0.8 },
  NVG: { alpha: 0.9, brightness: 1.8, contrast: 1.2, hue: 0.3, saturation: 0.5 },
};

// ─── Default tile providers ─────────────────────────────────────────
// NOTE: Replace these with your own tile server URLs or API-key-gated
// providers if the defaults are unavailable in your environment.

const TILE_PROVIDERS = {
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maximumLevel: 19,
    credit: '© OpenStreetMap contributors',
  },
  flightMap: {
    // Placeholder — replace with a real aviation overlay source
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maximumLevel: 18,
    credit: 'OpenFlightMap',
  },
  stars: {
    url: 'https://stellarium-web.org/tiles/{z}/{x}/{y}.png',
    maximumLevel: 13,
    credit: 'Stellarium Web',
  },
} as const;

const DEFAULT_COORDS: Required<Coordinates> = { lon: 0, lat: 0, height: 2_000_000 };

// ─── Explorer Class ─────────────────────────────────────────────────

/**
 * Encapsulated 3D globe explorer backed by CesiumJS.
 *
 * Usage:
 *   const explorer = new Explorer();
 *   await explorer.init({ container: myDiv });
 *   explorer.setMode('stars');
 *   explorer.flyTo({ lon: 77.2, lat: 28.6 });
 *   explorer.destroy();
 */
export class Explorer {
  private viewer: Cesium.Viewer | null = null;
  private layers: {
    street?: Cesium.ImageryLayer;
    stars?: Cesium.ImageryLayer;
    flightMap?: Cesium.ImageryLayer;
  } = {};
  private currentTheme: MapTheme = 'default';

  /** Whether the explorer is currently initialised and usable. */
  get isReady(): boolean {
    return this.viewer !== null && !this.viewer.isDestroyed();
  }

  /** Direct access to the underlying Cesium.Viewer (if needed). */
  get cesiumViewer(): Cesium.Viewer | null {
    return this.viewer;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  async init(options: ExplorerOptions): Promise<Cesium.Viewer> {
    const {
      container,
      defaultCoords = DEFAULT_COORDS,
      mode = 'dual',
      flightMap = 'on',
      theme = 'default',
    } = options;

    // Tear down any previous instance first
    this.destroy();

    let terrainProvider: Cesium.TerrainProvider;
    try {
      terrainProvider = await Cesium.createWorldTerrainAsync();
    } catch (err) {
      console.warn('[Explorer] Terrain unavailable, falling back to ellipsoid.', err);
      terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }

    this.viewer = new Cesium.Viewer(container, {
      terrainProvider,
      timeline: false,
      animation: false,
      infoBox: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
    });

    // Imagery layers
    this.layers.street = this.addImageryLayer(TILE_PROVIDERS.street);
    this.layers.flightMap = this.addImageryLayer(TILE_PROVIDERS.flightMap);
    this.layers.stars = this.addImageryLayer({
      ...TILE_PROVIDERS.stars,
      rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
    });

    // Scene enhancements
    const scene = this.viewer.scene;
    scene.globe.enableLighting = true;
    scene.highDynamicRange = true;
    scene.fog.enabled = true;

    // Apply initial state
    this.setMode(mode);
    this.setFlightMap(flightMap);
    this.setTheme(theme);
    this.flyTo(defaultCoords, 0);

    return this.viewer;
  }

  destroy(): void {
    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
    }
    this.viewer = null;
    this.layers = {};
  }

  // ── Mode & Theme ────────────────────────────────────────────────

  setMode(mode: ExplorerMode): void {
    const { street, stars } = this.layers;
    if (!street || !stars) return;

    street.show = mode !== 'stars';
    stars.show = mode !== 'street';
    stars.alpha = mode === 'dual' ? 0.5 : 1.0;

    // Re-apply theme since layer visibility changed
    this.applyThemeToLayer();
  }

  setFlightMap(state: FlightMapMode): void {
    if (this.layers.flightMap) {
      this.layers.flightMap.show = state === 'on';
    }
  }

  setTheme(theme: MapTheme): void {
    this.currentTheme = theme;
    this.applyThemeToLayer();
  }

  // ── Camera ──────────────────────────────────────────────────────

  flyTo(coords: Coordinates, duration: number = 3): void {
    if (!this.viewer) return;

    const height = coords.height ?? DEFAULT_COORDS.height;

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(coords.lon, coords.lat, height),
      duration,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  }

  // ── Entities ────────────────────────────────────────────────────

  addMarker(coords: Coordinates, label?: string): Cesium.Entity | undefined {
    if (!this.viewer) return undefined;

    return this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(coords.lon, coords.lat, coords.height ?? 0),
      billboard: {
        image: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg',
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: label
        ? {
          text: label,
          font: '12px monospace',
          fillColor: Cesium.Color.fromCssColorString('#4da3ff'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
        }
        : undefined,
    });
  }

  removeAllMarkers(): void {
    this.viewer?.entities.removeAll();
  }

  // ── Private helpers ─────────────────────────────────────────────

  private addImageryLayer(
    provider: { url: string; maximumLevel: number; credit: string; rectangle?: Cesium.Rectangle }
  ): Cesium.ImageryLayer {
    return this.viewer!.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: provider.url,
        maximumLevel: provider.maximumLevel,
        credit: provider.credit,
        rectangle: provider.rectangle,
      })
    );
  }

  private applyThemeToLayer(): void {
    const street = this.layers.street;
    if (!this.viewer || !street) return;

    const preset = THEME_PRESETS[this.currentTheme];
    street.alpha = preset.alpha;
    street.brightness = preset.brightness;
    street.contrast = preset.contrast;
    street.hue = preset.hue;
    street.saturation = preset.saturation;
  }
}

// ─── Convenience singleton (backward-compatible) ────────────────────
// If you only ever need one Explorer, you can use these module-level
// functions exactly like the old API.

const defaultExplorer = new Explorer();

export const initExplorer = (opts: ExplorerOptions) => defaultExplorer.init(opts);
export const setExplorerMode = (mode: ExplorerMode) => defaultExplorer.setMode(mode);
export const setFlightMap = (state: FlightMapMode) => defaultExplorer.setFlightMap(state);
export const setMapTheme = (theme: MapTheme) => defaultExplorer.setTheme(theme);
export const flyTo = (coords: Coordinates, duration?: number) => defaultExplorer.flyTo(coords, duration);
export const addMarker = (coords: Coordinates, label?: string) => defaultExplorer.addMarker(coords, label);
export const destroyExplorer = () => defaultExplorer.destroy();