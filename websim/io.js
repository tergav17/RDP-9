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

const COPROC_EMU_READY = 0;
const COPROC_EMU_SERVICE_IOT_BEGIN = 1;
const COPROC_EMU_IOT_ACK = 2;

const PPTR_MODE_ALPHA = 0;
const PPTR_MODE_BINARY = 1;

ppt_state = {
	
	// Paper tape data
	data: [],
	
	// Paper tape buffer
	buffer: 0,
	
	// Paper tape has data
	flag: 1,
	
	// Paper tape reader mode
	mode: PPTR_MODE_ALPHA,
	
	// Paper tape delay
	delay: 0,
	
	// Paper tape pointer
	pointer: 0
	
};

tty_state = {
	
	// Printer ready flag
	printer_flag: 1,
	
	// Printer delay constant
	printer_delay: 0
}

device_states = {
	
	// Paper tape state
	ppt: ppt_state,
	
	// Teleprinter state
	tty: tty_state
};

coproc_state = {
	// Used to pause the coprocessor simulation for a number of cycles
	delay: 0,
	
	// Latch that is set when an ack is recieved
	ack_latch: 0,

	
	// Coprocessor state machine state
	operation: COPROC_EMU_READY
};


const IOT_ISR_DEVICE_FIELD = 6;
const IOT_ISR_SUBDEVICE_FIELD = 4;
const IOT_ISR_PULSE_FIELD = 0;

const PPTR_DEVICE_ID = 1;
const TTY_PRINT_DEVICE_ID = 4;


/*
 * Clock the coprocessor, should be done before the next set of microcode control signals are sent out
 */
function coproc_clk(cpu, state, devices) {
	
	// Update all device logic
	device_tick(devices);

	// Coprocessor status to return to CPU
	status = cpu.s_coproc_status;

	// Read in the status lines associated with the COPROC control
	let iocp_req = getbit(cpu.r_state[3], IOCP_REQ, 1);
	let iocp_ack = getbit(cpu.r_state[3], IOCP_ACK, 1);
	
	// Set the ack_latch if needed
	if (iocp_ack)
		state.ack_latch = 1;
	
	
	// Check if the coprocessor is delaying
	if (state.delay > 0) {
		state.delay--;
		return;
	}
	
	switch (state.operation) {
		
		case COPROC_EMU_READY:
			// Coprocessor ready loop
			// Await request from main processor
			if (iocp_req) {
				state.delay = 4;
				state.operation = COPROC_EMU_SERVICE_IOT_BEGIN;
			}
			state = IO_COPROC_REQ_NULL;
			break;
			
		case COPROC_EMU_SERVICE_IOT_BEGIN:
			// Start processing an IOT here
			
			let data = cpu.s_data_bus;
			let addr = cpu.s_addr_bus;
			let device = getbit(addr, IOT_ISR_DEVICE_FIELD, 6);
			let subdevice = getbit(addr, IOT_ISR_SUBDEVICE_FIELD, 2);
			let pulse = getbit(addr, IOT_ISR_PULSE_FIELD, 3);
			
			status = IO_COPROC_ACK;
			let doskip = false;
			console.log("IOT on device " + device + "." + subdevice + "." + pulse + " with data " + data); 
			switch (device) {
				
				case PPTR_DEVICE_ID:
					// Paper tape reader
					let ppt = devices.ppt;
					
					// Check ready flag
					if (pulse & 01) {
						if (ppt.flag) {
							doskip = true;
						}
					}
					
					// Read from buffer
					if (pulse & 02) {
						cpu.s_coproc_write = ppt.buffer;
						status = IO_COPROC_ACK_WRITE;
					}
					
					// Update PPTR mode
					if (pulse & 04) {
						if (subdevice & 02) {
							ppt.mode = PPTR_MODE_BINARY;
						} else {
							ppt.mode = PPTR_MODE_ALPHA;
						}
						ppt.flag = 0;
					}
					
					// Append the skip
					status = append_skip(status, doskip);
					break;
					
				case TTY_PRINT_DEVICE_ID:
					// Teletype printer
					let tty = devices.tty;
					
					// Check printer ready flag
					if (pulse & 01) {
						if (tty.printer_flag) {
							doskip = true;
						}
					}
					
					// Reset teleprinter flag
					if (pulse & 02) {
						tty.printer_flag = 0;
					}
					
					// Print something to the terminal
					if (pulse & 04) {
						tty.printer_delay = 300;
						uart_output(data & 0177);
						
					}
				
					// Append the skip
					status = append_skip(status, doskip);
					break;
				
				default:
					// Acknowledge and do nothing
					console.log("Unknown IOT on device " + device + "." + subdevice + "." + pulse + " with data " + data); 
					break;
				
			}
			
			
			
			// Acknowledge that the IOT has been serviced and the write register is written
			state.operation = COPROC_EMU_IOT_ACK;
			break;
			
			
		case COPROC_EMU_IOT_ACK:
			// Wait for the main processor to acknowledge that it has read the data
			if (state.ack_latch) {
				state.ack_latch = 0;
				state.operation = COPROC_EMU_READY;
				status = IO_COPROC_REQ_NULL;
			}
			break;
		
		default:
			break;
	}
	
	// Set coproc status
	cpu.s_coproc_status = status;
}

/*
 * Append a skip onto an existing base acknowledgement value
 */
function append_skip(base, skip) {
	if (!skip)
		return base;
	
	switch (parseInt(base)) {
		case IO_COPROC_ACK:
			return IO_COPROC_ACK_SKIP;
			
		case IO_COPROC_ACK_WRITE:
			return IO_COPROC_ACK_WSKIP;
			
		case IO_COPROC_ACK_FLAGS:
			return IO_COPROC_ACK_FSKIP;
			
		default:
			return base;
	}
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
	if (ppt.delay > 0) {
		ppt.delay--;
		return;
	}
	
	// Try to read in a new value if the flag is low
	if (!ppt.flag) {
		if (ppt.mode == PPTR_MODE_ALPHA && ppt.pointer < ppt.data.length) {
			ppt.buffer = ppt.data[ppt.pointer];
			ppt.pointer++;
			ppt.flag = 1;
			ppt.delay = 10;
		}
		if (ppt.mode == PPTR_MODE_BINARY && ppt.pointer < (ppt.data.length + 2)) {
			let i = ppt.pointer;
			ppt.buffer = getbit(ppt.data[i+2], 0, 6) | (getbit(ppt.data[i+1], 0, 6) << 6) | (getbit(ppt.data[i], 0, 6) << 12);
			ppt.pointer += 3;
			ppt.flag = 1;
			ppt.delay = 30;
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