/**
 * The posters' sizes, in CSS pixels, and the scale they are rendered at.
 * posters.js lays each one out; render.mjs --posters renders them. Kept apart
 * from posters.js so Node can read it without a browser.
 */
export const POSTERS = {
  hero: { w: 1920, h: 1080, scale: 2 }, // 3840 x 2160, 16:9: X, YouTube, LinkedIn, a slide
  teleprompter: { w: 1080, h: 1350, scale: 2 }, // 4:5, Instagram feed
  malaysia: { w: 1080, h: 1350, scale: 2 },
  students: { w: 1080, h: 1350, scale: 2 },
  story: { w: 1080, h: 1920, scale: 2 }, // 9:16, Stories, TikTok cover
  banner: { w: 1280, h: 560, scale: 2 }, // the README banner
};
