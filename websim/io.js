/*
 * io.js
 *
 * assorted input / output routines
 */
 
// I/O elements 
const dump_core = document.getElementById("button-dump-core");
const mount_ppt = document.getElementById("button-mount-ppt");
const rewind_ppt = document.getElementById("button-rewind-ppt");
const upload_core = document.getElementById("upload-core");
const terminal = document.getElementById("terminal");
const readout = document.getElementById("readout");

const upload_ppt = document.getElementById("upload-ppt");

const play_bell = document.getElementById("play-bell");

/* --- IO COPROCESSOR EMULATION --- */

const PPTR_MODE_ALPHA = 0;
const PPTR_MODE_BINARY = 1;

ppt_state = {
	
	// Paper tape data
	pptr_data: [],
	
	// Paper tape buffer
	r_pptr_buffer: 0,
	
	// Paper tape has data
	r_pptr_flag: 1,
	
	// Paper tape reader mode
	pptr_mode: PPTR_MODE_ALPHA,
	
	// Paper tape reader delay
	pptr_delay: 0,
	
	// Paper tape pointer
	pptr_pointer: 0
	
};

tty_state = {
	
	// Printer ready flag
	r_printer_flag: 1,
	
	// Printer delay constant
	printer_delay: 0
}

device_states = {
	
	// Paper tape state
	ppt: ppt_state,
	
	// Teleprinter state
	tty: tty_state
};

const IOT_ISR_DEVICE_FIELD = 6;
const IOT_ISR_SUBDEVICE_FIELD = 4;
const IOT_ISR_PULSE_FIELD = 0;

const PPTR_DEVICE_ID = 1;
const TTY_PRINT_DEVICE_ID = 4;

/*
 * Latching phase of I/O device update
 * At this point, any signals will be treated as canonical and flags will be updated
 */
function io_latch(cpu, devices) {
	
}

/*
 * Propagation phase of I/O device update
 * After completion, CPU device bus and associated flags are expected to be updated
 */
function io_propagate(cpu, devices) {
	
}


/* --- DEVICE STUFF --- */

/*
 * Device tick, used for timing certain things
 */
function device_tick(devices) {
	
	// Tick the teleprinter subsystem
	tty_tick(devices.tty);
	
	// Tick the paper tape subsystem
	ppt_tick(devices.ppt);
}

function tty_tick(tty) {
	
	// Decrement printer delay value
	if (tty.printer_delay > 0) {
		tty.printer_delay--;
		
		if (tty.printer_delay == 0) {
			tty.printer_flag = 1;
		}
	}
	
}

function ppt_tick(ppt) {
	
	
	// Below this is all stuff that can be delayed
	if (ppt.pptr_delay > 0) {
		ppt.delay--;
		return;
	}
	
	// Try to read in a new value if the flag is low
	if (!ppt.r_pptr_flag) {
		if (ppt.pptr_mode == PPTR_MODE_ALPHA && ppt.pptr_pointer < ppt.pptr_data.length) {
			ppt.r_pptr_buffer = ppt.pptr_data[ppt.pptr_pointer];
			ppt.pptr_pointer++;
			ppt.r_pptr_flag = 1;
			ppt.pptr_delay = 10;
		}
		if (ppt.mode == PPTR_MODE_BINARY && ppt.pptr_pointer < (ppt.pptr_data.length + 2)) {
			let i = ppt.pptr_pointer;
			ppt.buffer = getbit(ppt.pptr_data[i+2], 0, 6) | (getbit(ppt.pptr_data[i+1], 0, 6) << 6) | (getbit(ppt.pptr_data[i], 0, 6) << 12);
			ppt.pptr_pointer += 3;
			ppt.r_pptr_flag = 1;
			ppt.pptr_delay = 30;
		}
	}
}

/* --- TERMINAL STUFF --- */

/*
 * Inputs a value into the UART
 */
uartHasCharacter = false;
uartChar = 0;
uartScratchpad = 0; 
function uart_input(ch) {
	uartHasCharacter = true;
	uartChar = ch;
}

/*
 * Ouputs a value to the UART
 */
function uart_output(ch) {
	
	console.log("Got: " + ch);
	
	switch (ch) {
		
		case 0x07:
			// Bell
			play_bell.play();
			break;
		
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


// Instruction dump function
dump_core.onclick = function() {
	
	let out = "";
	
	let addr = 0;
	let rowlen = 4;
	for (let i = 0; i < 32768 / rowlen; i++) {
		out += addr.toString(8).padStart(5, "0") + ": ";
		for (let o = 0; o < rowlen; o++) {
			out += cpu_state.r_core[addr].toString(8).padStart(6, "0") + " ";
			addr++;
		}
		out += "\n";
	}
	
	readout.value = out;
}


/* --- FILE LOADING STUFF --- */


// Link "LOAD .PPT" button to file input
mount_ppt.onclick = function() {
	upload_ppt.click();
}

// Rewind PPT in reader
rewind_ppt.onclick = function() {
	ppt_state.pointer = 0;
}

// Shove the .PPT into buffer when uploaded
upload_ppt.addEventListener('change', function(e) {
	let pptFile = upload_ppt.files[0];
	

	(async () => {
        let fileContent = new Uint8Array(await pptFile.arrayBuffer());

		// Copy in ppt data and reset pointer
		for (let i = 0; i < fileContent.length; i++) {
			ppt_state.data[i] = fileContent[i];
		}
		ppt_state.pointer = 0;
		alert("Loaded " + ppt_state.data.length + " bytes");
	})();
});

/*

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