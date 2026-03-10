// Image generation utilities for custom preset deployments
import figlet from 'figlet';
import standardFont from 'figlet/importable-fonts/Standard.js';

// Parse the Standard font once when the module loads
figlet.parseFont('Standard', standardFont);

/**
 * Generate ASCII Art image from text using figlet library
 * @param text The text to convert to ASCII art
 * @returns Data URL of the generated image
 */
export async function generateASCIIArt(text: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not get canvas context');
  
  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Generate ASCII art using figlet (synchronously since font is preloaded)
  // Force uppercase for consistent appearance
  const asciiArt = figlet.textSync(
    text.toUpperCase().slice(0, 15), // Force uppercase, limit text length
    {
      font: 'Standard',
      horizontalLayout: 'fitted',
      verticalLayout: 'default',
      width: 80,
      whitespaceBreak: true,
    }
  );
  
  // Draw ASCII art centered on canvas with much larger font
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  
  const lines = asciiArt.split('\n');
  
  // Start with a large font size and scale down if needed
  let fontSize = 80;
  let lineHeight = fontSize;
  ctx.font = `${fontSize}px "Courier New", monospace`;
  
  // Find the longest line to calculate scaling
  let maxLineLength = 0;
  for (const line of lines) {
    if (line.length > maxLineLength) maxLineLength = line.length;
  }
  
  // Calculate font size to fit the canvas width
  let maxWidth = ctx.measureText('M'.repeat(maxLineLength)).width;
  const targetWidth = canvas.width * 0.9; // Use 90% of canvas width
  
  // Scale font size to fit width
  if (maxWidth > targetWidth) {
    fontSize = Math.floor((fontSize * targetWidth) / maxWidth);
    lineHeight = fontSize;
    ctx.font = `${fontSize}px "Courier New", monospace`;
  }
  
  // Recalculate with final font size
  const totalHeight = lines.length * lineHeight;
  const targetHeight = canvas.height * 0.9; // Use 90% of canvas height
  
  // Scale font size to fit height if needed
  if (totalHeight > targetHeight) {
    fontSize = Math.floor((fontSize * targetHeight) / totalHeight);
    lineHeight = fontSize;
    ctx.font = `${fontSize}px "Courier New", monospace`;
  }
  
  // Calculate final positioning
  const finalHeight = lines.length * lineHeight;
  const startY = (canvas.height - finalHeight) / 2;
  
  // Find actual max width for centering
  maxWidth = 0;
  for (const line of lines) {
    const width = ctx.measureText(line).width;
    if (width > maxWidth) maxWidth = width;
  }
  
  const startX = (canvas.width - maxWidth) / 2;
  
  // Draw each line with stroke for thicker, more readable text
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(3, fontSize / 12); // Increased stroke width for better readability
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  for (let i = 0; i < lines.length; i++) {
    const y = startY + (i * lineHeight);
    // Draw stroke first (outline)
    ctx.strokeText(lines[i], startX, y);
    // Then fill on top
    ctx.fillText(lines[i], startX, y);
  }
  
  return canvas.toDataURL('image/png');
}

/**
 * Generate Solana branded gradient text image (exact Solana brand colors)
 * @param text The text to display (default: "SOLANA")
 * @returns Data URL of the generated image
 */
export async function generateSolanaGradient(text: string = 'SOLANA'): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not get canvas context');
  
  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Official Solana brand gradient: Purple (#DC1FFF) to Cyan (#00FFA3)
  // Based on https://solana.com/branding
  const gradient = ctx.createLinearGradient(0, canvas.height / 2, canvas.width, canvas.height / 2);
  gradient.addColorStop(0, '#DC1FFF');    // Solana purple
  gradient.addColorStop(0.5, '#00FFA3');  // Solana green/cyan
  gradient.addColorStop(1, '#00FFA3');    // Solana cyan
  
  // Measure text to ensure it fits and is centered
  const upperText = text.toUpperCase();
  let fontSize = 180;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  let textWidth = ctx.measureText(upperText).width;
  
  // Scale font if text is too wide
  while (textWidth > canvas.width * 0.9 && fontSize > 60) {
    fontSize -= 10;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    textWidth = ctx.measureText(upperText).width;
  }
  
  // Draw text perfectly centered
  ctx.fillStyle = gradient;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(upperText, canvas.width / 2, canvas.height / 2);
  
  return canvas.toDataURL('image/png');
}

/**
 * Generate letter image URL from Netlify hosted images
 * @param letter The letter to display
 * @param isPump Whether this is for Pump.fun (green) or other platforms (yellow/gold)
 * @returns URL of the letter image
 */
export async function generateLetterImage(letter: string, isPump: boolean): Promise<string> {
  // Get the first letter
  const char = (letter.toUpperCase()[0] || 'A').toLowerCase();
  
  // Netlify hosted images - circular style
  // Green (1) for Pump.fun, Yellow (2) for Bonk/others
  const baseUrl = 'https://transcendent-genie-3ed71a.netlify.app';
  const number = isPump ? '1' : '2';
  const imageUrl = `${baseUrl}/${char}${number}.png`;
  
  return imageUrl;
}

/**
 * Validate and return custom image URL
 * @param imageUrl The custom image URL
 * @returns The validated image URL
 */
export async function getCustomImage(imageUrl: string): Promise<string> {
  // Simply return the URL - the deployment API will handle validation
  if (!imageUrl || !imageUrl.trim()) {
    throw new Error('Custom image URL is required');
  }
  
  return imageUrl.trim();
}

/**
 * Generate image based on preset configuration
 * @param imageType The type of image to generate
 * @param text The text/ticker to use
 * @param customImageUrl Optional custom image URL
 * @param deployPlatform The deployment platform
 * @returns Data URL or URL of the generated/selected image
 */
export async function generatePresetImage(
  imageType: string,
  text: string,
  customImageUrl?: string,
  deployPlatform?: string
): Promise<string> {
  switch (imageType) {
    case 'ASCII Art':
      return await generateASCIIArt(text);
    
    case 'SOL ASCII (Gradient)':
      return await generateSolanaGradient(text);
    
    case 'Letter Image':
      const firstLetter = text.trim()[0] || 'A';
      const isPump = deployPlatform === 'Pump.fun';
      return await generateLetterImage(firstLetter, isPump);
    
    case 'Custom Image':
      if (!customImageUrl) {
        throw new Error('Custom image URL is required for Custom Image type');
      }
      return await getCustomImage(customImageUrl);
    
    case 'Image in Post':
      // This should be handled separately (uses tweet image)
      throw new Error('Image in Post should be handled by tweet image logic');
    
    default:
      throw new Error(`Unknown image type: ${imageType}`);
  }
}
