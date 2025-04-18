/*
 * io.js
 *
 * assorted input / output routines
 */
 
// I/O elements 
const dump_core = document.getElementById("button-dump-core");
const upload_core = document.getElementById("upload-core");
const terminal = document.getElementById("terminal");
const readout = document.getElementById("readout");
const dump_bank = document.getElementById("core-dump-bank");



/* --- TERMINAL STUFF --- */

/*
 * Write a byte to the UART
 */
function uartWrite(register, val) {
	switch (register & 0x7) {
		case 0x00:
			// Transmit Holding Register
			uartOutput(val);
			break;
		
		case 0x7:
			// Scratchpad Register
			uartScratchpad = val;
			break;
		
		default:
			break;
	}
}


/*
 * Reads a byte from the UART
 */
function uartRead(register) {
	switch (register & 0x7) {
		case 0x0:
			// Receive Holding Register
			uartHasCharacter = false;
			return uartChar & 0xFF;
			
		case 0x5:
			// Line Status Register
			return 0x20 + (uartHasCharacter ? 1 : 0);
			
		case 0x7:
			// Scratchpad Register
			return uartScratchpad;
		
		default:
			return 0xFF;
	}
}

/*
 * Inputs a value into the UART
 */
uartHasCharacter = false;
uartChar = 0;
uartScratchpad = 0; 
function uartInput(ch) {
	uartHasCharacter = true;
	uartChar = ch;
}

/*
 * Ouputs a value to the UART
 */
function uartOutput(ch) {
	
	switch (ch) {
		case 0x08:
			// Backspace
			terminal.value = terminal.value.substring(0, terminal.value.length-1);
			break;
			
		case 0x09:
			// Tab
			terminal.value += "\t";
			break;
			
		case 0x0A:
			// Line Feed
			terminal.value += "\n";
			terminal.scrollTop = terminal.scrollHeight;
			break;
			
		case 0x0D:
			// Carriage Return
			/*
			let str = terminal.value;
			
			// Janky, but kinda emulates the function of carriage return;
			while (str.length > 0 && str.substr(-1) != '\n')
				str = str.substring(0, str.length - 1);
			terminal.value = str;
			*/
			break;
			
		default: // Normal characters
			if (ch > 31 && ch < 127)
				terminal.value += String.fromCharCode(ch);
			break;
	}
}

// On key down event handler
// only really does special keys
terminal.onkeydown = function(e) {
	let ch = (e.keyCode || e.charCode);
	
	switch (ch) {
		case 8:
			uartInput(8);
			return false;
		
		case 46:
			uartInput(127);
			return false;
			
		default:
			break;
	}
}

// On key press event handler
terminal.onkeypress = function(e) {
	let ch = (e.keyCode || e.charCode);
	
	uartInput(ch);
	
	return false;
}

/* --- DEBUGGING STUFF --- */

/*
// Instruction dump function
dump_isr.onclick = function() {
	// Grab the bank
	let bank = cpu_state.isr_bank;
	let manual = getManualBank();
	if (manual >= 0 && manual <= 255) {
		bank = manual;
	}
	
	// Dump header
	let content = "BANK : 0x" + (bank).toString(16).padStart(2, '0').toUpperCase() + "\n";
	
	// Dump contents
	for (let i = 0x80; i < 0x100; i++) {
		content += "0x" + (i).toString(16).padStart(2, '0').toUpperCase() + " : ";
		
		let isr = cpu_state.imem[128 * bank + (i & 0x7F)];
		content += (isr).toString(16).padStart(4, '0').toUpperCase() + " "
		content += decode([], isr, [0, 0, 0, 0]);
		content += "\n"
	}
	
	
	readout.value = content;
}

// Data dump function
dump_data.onclick = function() {
	// Grab the bank
	let bank = cpu_state.data_bank;
	let manual = getManualBank();
	if (manual >= 0 && manual <= 255) {
		bank = manual;
	}
	
	// Dump header
	let content = "BANK : 0x" + (bank).toString(16).padStart(2, '0').toUpperCase() + "\n";
	
	// Dump contents
	for (let i = 0; i < 0x80; i += 8) {
		content += "0x" + (i).toString(16).padStart(2, '0').toUpperCase() + " : ";
		
		for (let o = 0; o < 8; o++) {
			content += (cpu_state.dmem[bank * 128 + i + o]).toString(16).padStart(2, '0').toUpperCase() + " ";
		}
		
		content += " \"";
		for (let o = 0; o < 8; o++) {
			let b = cpu_state.dmem[bank * 128 + i + o];
			if (b >= 0x20 && b <= 0x7E) {
				content += String.fromCharCode(b);
			} else {
				content += ".";
			}
		}
		
		content += "\"\n"
	}
	
	
	readout.value = content;
}

function getManualBank() {
	let str = dump_bank.value.toLowerCase();
	
	if (str.startsWith("0x")) {
		return parseInt(str, 16);
	} else {
		return parseInt(str, 10);
	}
}
*/

/* --- FILE LOADING STUFF --- */

/*
// Link "LOAD .SAV" button to file input
document.getElementById("button-load-sav").onclick = function() {
	if (runClock) {
		alert("Halt processor before loading .SAV");
	} else {
		upload_sav.click();
	}
}

// Shove the .SAV into memory when uploaded
upload_sav.addEventListener('change', function(e) {
	let savFile = upload_sav.files[0];
	

	(async () => {
        let fileContent = new Uint8Array(await savFile.arrayBuffer());

        let block = 0;
		while (block + 512 <= fileContent.length) {
			if (fileContent[block] != 0x02 || fileContent[block + 1] != 0x81) {
				alert("Malformed .SAV File!");
				break;
			}
			
			// Get bank to load into
			bank = fileContent[block + 2];
			
			cpu_state.isr_bank = bank;
			cpu_state.data_bank = bank;
			
			for (let o = 0; o < 128; o++) {
				dataStore(cpu_state, o, fileContent[block + o + 128]);
				isrStore(cpu_state, o + 128, (fileContent[block + (o*2) + 256] << 8) + fileContent[block + (o*2) + 257]);
			}
			
			block += 512;
		}
		
		cpu_state.isr_bank = 1;
		cpu_state.data_bank = 1;
		cpu_state.pc = 0x80;
		
		// Make sure the visual display is updated 
		propagate(cpu_state, isrFetch(cpu_state, cpu_state.pc));
		updateFlow(false);
		upload_sav.value = null;
	})();
});

// Link "MOUNT .IMG" button to file input
document.getElementById("button-mount-img").onclick = function() {
	upload_img.click();
}

// Shove the .IMG into an emulated CF card
upload_img.addEventListener('change', function(e) {
	let imgFile = upload_img.files[0];
	

	(async () => {
        let fileContent = new Uint8Array(await imgFile.arrayBuffer());

		// Load into compact flash image
        let i = 0;
		while (i < fileContent.length && i < (512 * 256 * 256)) {
			cf_state.data[i] = fileContent[i];
			i++;
		}
		
	})();
});
*/