// src/lib/types.ts

/** * Astronomy Picture of the Day (APOD) response from NASA API 
 */
export interface ApodData {
  readonly date: string;
  readonly explanation: string;
  readonly hdurl?: string;
  readonly media_type: 'image' | 'video';
  readonly title: string;
  readonly url: string;
  readonly copyright?: string;
  /** Helper to quickly toggle between <img> and <iframe> in Svelte templates */
  readonly isVideo: boolean; 
}

/** * Formatted Mars Image data parsed from the NASA RSS feed 
 */
export interface MarsItem {
  readonly title: string;
  readonly imgUrl: string;
  readonly description?: string;
  readonly pubDate?: string;
  readonly roverName?: string;
  readonly cameraName?: string;
}

/** * The main Navigation IDs used to switch between active UI panels 
 */
export type PanelID = 'Explorer' | 'JotDown' | 'QuickBits' | 'Eyes';

/** * Definition for Sidebar buttons 
 */
export interface NavItem {
  readonly id: PanelID;
  readonly icon: string;
  readonly label: string;
}

/** * Individual note structure for the 'Jot Down' module 
 */
export interface Note {
  readonly id: string;
  /** Content of the note, allows markdown or plain text */
  content: string; 
  readonly createdAt: number;
  updatedAt: number;
  tags: string[];
}

/** * Scientific or Graphing calculation entry 
 */
export interface CalculatorExpression {
  readonly id: string;
  /** The raw input string from the user (e.g., "sin(45) * 2") */
  expression: string; 
  /** Computed result or error message from the math engine */
  result?: number | string; 
  /** Coordinates for rendering SVG graphs if type is 'graph' */
  graphData?: number[]; 
  readonly createdAt: number;
  updatedAt: number;
  type: 'scientific' | 'graph';
}

/** * Internal state for the Jot Down module, used for persistence 
 */
export interface JotDownState {
  notes: Note[];
  calculator: CalculatorExpression[];
}

/** * Chat message structure for the SkyNet/QuickBits AI overlay 
 */
export interface QuickBitsMessage {
  readonly id: string;
  readonly author: 'user' | 'skynet';
  readonly content: string;
  readonly timestamp: number;
}
