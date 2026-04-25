export interface SubtitleSegment {
  /** Start time in seconds. */
  start: number;
  /** Duration in seconds. */
  duration: number;
  /** End time in seconds (start + duration). */
  end: number;
  /** Original text. */
  text: string;
}

export interface CaptionTrackInfo {
  languageCode: string;
  languageName: string;
  /** "asr" for auto-generated, undefined for manual. */
  kind?: string;
}

export interface TranscriptResponse {
  videoId: string;
  /** The track that was actually used. */
  track: CaptionTrackInfo;
  /** All available tracks. */
  availableTracks: CaptionTrackInfo[];
  segments: SubtitleSegment[];
}
