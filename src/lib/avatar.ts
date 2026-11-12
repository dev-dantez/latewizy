/**
 * Generate a fun avatar URL using DiceBear
 * https://www.dicebear.com/
 */

// Available fun avatar styles
export type AvatarStyle =
  | "bottts"      // Robots
  | "fun-emoji"   // Fun emoji faces
  | "adventurer"  // Adventure characters
  | "pixel-art"   // Pixel art characters
  | "thumbs"      // Thumbs characters
  | "lorelei"     // Abstract faces
  | "notionists"  // Notion-style characters
  | "big-smile";  // Big smile characters

const DEFAULT_STYLE: AvatarStyle = "bottts";

/**
 * Generate a DiceBear avatar URL
 * @param seed - Unique identifier to generate consistent avatar (e.g., user ID, email, API key)
 * @param style - Avatar style (default: bottts)
 * @param size - Size in pixels (default: 80)
 */
export function getAvatarUrl(
  seed: string,
  style: AvatarStyle = DEFAULT_STYLE,
  size: number = 80
): string {
  // Use a hash of the seed to ensure consistent avatars
  const encodedSeed = encodeURIComponent(seed);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodedSeed}&size=${size}`;
}

/**
 * Get a random avatar style
 */
export function getRandomAvatarStyle(): AvatarStyle {
  const styles: AvatarStyle[] = [
    "bottts",
    "fun-emoji",
    "adventurer",
    "pixel-art",
    "thumbs",
    "lorelei",
    "notionists",
    "big-smile",
  ];
  return styles[Math.floor(Math.random() * styles.length)];
}
