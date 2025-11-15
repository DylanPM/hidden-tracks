/**
 * Typography Style Guide for Hidden Tracks
 *
 * Based on Spotify embed styles for consistency and professional appearance.
 *
 * Style Hierarchy:
 * - H1: Main section headings (e.g., "What's on the playlist?")
 * - H2: Subsection headings (e.g., "Danceability")
 * - Subheading: Secondary descriptive text below H1
 * - Paragraph: Primary body text
 * - Small: Minimal UI text (buttons, labels)
 *
 * Typography Rules:
 * - H1: Only capitalize first word (sentence case)
 * - Subheading: Match Spotify embed artist name styling
 * - Paragraph: Match Spotify embed song title styling
 * - Small: Match Spotify embed "Save on Spotify" styling
 */

export const TYPOGRAPHY = {
  // H1: Main section headings
  // Examples: "What's on the playlist?", "Starting track attributes",
  // "Reveal starting track attributes", "Playlist intel", "Bonus challenges"
  h1: {
    fontSize: '1.5rem',        // 24px - Spotify-style prominence
    fontWeight: '700',         // Bold
    lineHeight: '1.2',
    letterSpacing: '-0.01em',
    color: '#ffffff',
    textTransform: 'none',     // Sentence case only
    className: 'text-2xl font-bold text-white tracking-tight'
  },

  // H2: Subsection headings
  // Examples: "Danceability", "Energy", "Popularity"
  h2: {
    fontSize: '1.125rem',      // 18px
    fontWeight: '600',         // Semibold
    lineHeight: '1.3',
    letterSpacing: '0',
    color: '#ffffff',
    className: 'text-lg font-semibold text-white'
  },

  // Subheading: Descriptive text below H1
  // Examples: "What you've discovered", "Pick one of 3 songs..."
  // Mirrors Spotify embed artist name style
  subheading: {
    fontSize: '0.875rem',      // 14px - matches Spotify artist name
    fontWeight: '400',         // Normal
    lineHeight: '1.4',
    letterSpacing: '0',
    color: '#b3b3b3',          // Spotify gray
    className: 'text-sm font-normal text-[#b3b3b3]'
  },

  // Paragraph: Primary body text
  // Examples: Clue text, descriptions
  // Mirrors Spotify embed song title style
  paragraph: {
    fontSize: '1rem',          // 16px - matches Spotify song title
    fontWeight: '400',         // Normal
    lineHeight: '1.5',
    letterSpacing: '0',
    color: '#ffffff',
    className: 'text-base font-normal text-white leading-relaxed'
  },

  // Small: Minimal UI text
  // Examples: "Laid-back", "Danceable", button text, "Save on Spotify"
  // Mirrors Spotify embed small text style
  small: {
    fontSize: '0.75rem',       // 12px - matches Spotify small text
    fontWeight: '400',         // Normal
    lineHeight: '1.4',
    letterSpacing: '0',
    color: '#b3b3b3',
    className: 'text-xs font-normal text-[#b3b3b3]'
  },

  // Number displays (for attribute values)
  number: {
    fontSize: '0.875rem',      // 14px
    fontWeight: '600',         // Semibold
    lineHeight: '1',
    letterSpacing: '0',
    color: '#ffffff',
    className: 'text-sm font-semibold text-white'
  }
};

// Helper function to get typography class
export const getTypographyClass = (variant) => {
  return TYPOGRAPHY[variant]?.className || TYPOGRAPHY.paragraph.className;
};
