// Using Picsum Photos for reliable placeholder images
// Each keyword gets a unique seed to ensure consistent images
export function getImageUrl(keyword: string): string {
  // Create a unique seed from the keyword for consistent images
  const seed = keyword.split(",")[0].toLowerCase().replace(/\s+/g, "-");
  return `https://picsum.photos/seed/${seed}/1280/720`;
}

