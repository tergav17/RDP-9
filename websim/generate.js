function generate_ucode() {
    console.log("Generating microcode files...")

    console.log("ROM 0:")
}

function call_decode(address) {
    let uc_input = address;

    let decode_mode = getbit(address, 11, 2);
    let step = getbit(input, 0, 6);

    if (decode_mode == DECODE_MODE_SERVICE) {
        // Service mode active-low


    } else if (decode_mode == DECODE_MODE_INSTRUCTION) {
        // Instruction mode active-low

    } else if (decode_mode == DECODE_MODE_OPERATE) {
        // Operate mode active-low

    } else if (decode_mode == DECODE_MODE_EAE) {
        // EAE mode active-low

    }

    return decode(uc_input);
}

function download_blob(binaryData, fileName, mimeType = 'application/octet-stream') {
  const blob = new Blob([binaryData], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(blobUrl);
}
