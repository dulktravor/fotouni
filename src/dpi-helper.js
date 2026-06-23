// DPI manipulation helper for JPEG/JFIF files in the browser
// Non-destructively updates JFIF header parameters without re-encoding image data

export function changeDpiDataUrl(base64Image, dpi) {
  const parts = base64Image.split(',');
  const mime = parts[0];
  const b64 = parts[1];
  
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  // A standard JPEG starts with SOI (Start of Image) marker: FF D8
  // Followed immediately by APP0 (FF E0) segment in standard web exports
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF && bytes[3] === 0xE0) {
    // Modify density units (byte 13 from SOI start)
    // 1 = dots per inch (DPI), 2 = dots per cm
    bytes[13] = 1;
    
    // Modify X density (bytes 14 and 15)
    bytes[14] = (dpi >> 8) & 0xFF;
    bytes[15] = dpi & 0xFF;
    
    // Modify Y density (bytes 16 and 17)
    bytes[16] = (dpi >> 8) & 0xFF;
    bytes[17] = dpi & 0xFF;
    
    return mime + ',' + uint8ToBase64(bytes);
  } else {
    // If there is no APP0 marker (uncommon for canvas.toDataURL),
    // we insert a new JFIF APP0 block right after the SOI marker (first 2 bytes)
    const jfifApp0 = new Uint8Array([
      0xFF, 0xE0, // APP0 marker
      0x00, 0x10, // Segment length (16 bytes)
      0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0" identifier
      0x01, 0x01, // JFIF version 1.01
      0x01,       // Density units: 1 = dots per inch (DPI)
      (dpi >> 8) & 0xFF, dpi & 0xFF, // Xdensity
      (dpi >> 8) & 0xFF, dpi & 0xFF, // Ydensity
      0x00, 0x00  // Thumbnail width and height
    ]);
    
    const newBytes = new Uint8Array(bytes.length + jfifApp0.length);
    newBytes.set(bytes.subarray(0, 2), 0); // SOI (FF D8)
    newBytes.set(jfifApp0, 2);             // APP0
    newBytes.set(bytes.subarray(2), 2 + jfifApp0.length); // Remaining image payload
    
    return mime + ',' + uint8ToBase64(newBytes);
  }
}

function uint8ToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  const chunk = 0xffff;
  for (let i = 0; i < len; i += chunk) {
    const sub = uint8.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}
