function generate_ucode() {
    console.log("Generating microcode files...")

    console.log("ROM 0:")
    out = []
    for (i = 0; i < 8192; i++) {
        out.push(call_decode(i)[0] ^ 0b00000000);
    }
    download_blob(new Uint8Array(out), "ROM-0.bin");

    console.log("ROM 1:")
    out = []
    for (i = 0; i < 8192; i++) {
        out.push(call_decode(i)[1] ^ 0b11111111);
    }
    download_blob(new Uint8Array(out), "ROM-1.bin");

    console.log("ROM 2:")
    out = []
    for (i = 0; i < 8192; i++) {
        out.push(call_decode(i)[2] ^ 0b00000000);
    }
    download_blob(new Uint8Array(out), "ROM-2.bin");

    console.log("ROM 3:")
    out = []
    for (i = 0; i < 8192; i++) {
        out.push(call_decode(i)[3] ^ 0b11101101);
    }
    download_blob(new Uint8Array(out), "ROM-3.bin");

    console.log("ROM 4:")
    out = []
    for (i = 0; i < 8192; i++) {
        out.push(call_decode(i)[4] ^ 0b10000000);
    }
    download_blob(new Uint8Array(out), "ROM-4.bin");
}

function call_decode(address) {
    let uc_input = address;

    let decode_mode = getbit(address, 11, 2);
    let step = getbit(address, 0, 6);

    if (decode_mode == DECODE_MODE_SERVICE) {
        // Service mode active-low
        if (step > 32) {
            if (step > 16) {
                // Invert front panel signals
                uc_input ^= 1 << 7;
                uc_input ^= 1 << 8;
                uc_input ^= 1 << 9;
                uc_input ^= 1 << 10;
            } else {
                // Invert DMA req
                uc_input ^= 1 << 7;

                // Invert channel req
                uc_input ^= 1 << 8;

                // Invert IOT skip
                uc_input ^= 1 << 9;
            }
        } else {
            if (step > 48) {
                // Invert device req
                uc_input ^= 1 << 9;
            } else {

            }
        }

    } else if (decode_mode == DECODE_MODE_INSTRUCTION) {
        // Instruction mode active-low

        // Invert rest pending
        uc_input ^= 1 << 9;

    } else if (decode_mode == DECODE_MODE_OPERATE) {
        // Operate mode active-low

    } else if (decode_mode == DECODE_MODE_EAE) {
        // EAE mode active-low

    }

    return decode(uc_input);
}

function download_blob(binaryData, fileName) {
    const mimeType = 'application/octet-stream'
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
