// src/lib/types.ts

/** 
 * Astronomy Picture of the Day (APOD) response from NASA API 
 */
export interface ApodData {
  readonly date: string;
  readonly explanation: string;
  readonly hdurl?: string;
  readonly media_type: 'image' | 'video';
  readonly title: string;
  readonly url: string;
  readonly copyright?: string;
}

/**
 * UI-enhanced APOD model (derived, NOT from API)
 */
export interface ApodViewModel extends ApodData {
  readonly isVideo: boolean;
}

/** 
 * Formatted Mars Image data parsed from NASA sources 
 */
export interface MarsItem {
  readonly title: string;
  readonly imgUrl: string;
  readonly description?: string;
  readonly pubDate?: string;
  readonly roverName?: string;
  readonly cameraName?: string;
}

/** 
 * Navigation panel identifiers 
 */
export type PanelID =
  | 'Home'
  | 'Explorer'
  | 'JotDown'
  | 'QuickBits'
  | 'Eyes'
  | 'DSN';

/** 
 * Sidebar navigation item 
 */
export interface NavItem {
  readonly id: PanelID;
  readonly label: string;
  // optional future extension
  // readonly icon?: string;
}

/** 
 * Note structure for Jot Down module 
 */
export interface Note {
  readonly id: string;
  content: string;
  readonly createdAt: number;
  updatedAt: number;
  tags: string[];
}

/** 
 * Scientific or graphing calculation entry 
 */
export interface CalculatorExpression {
  readonly id: string;
  expression: string;
  result?: number | string;

  // Proper graph structure instead of useless number[]
  graphData?: { x: number; y: number }[];

  readonly createdAt: number;
  updatedAt: number;

  type: 'scientific' | 'graph';
}

/** 
 * Jot Down persistence state 
 */
export interface JotDownState {
  notes: Note[];
  calculator: CalculatorExpression[];
}

/** 
 * Chat message for SkyNet / QuickBits 
 */
export interface QuickBitsMessage {
  readonly id: string;
  readonly role: 'user' | 'skynet';
  readonly content: string;
  readonly timestamp: number;
}
