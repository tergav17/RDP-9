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

/* --- IO COPROCESSOR EMULATION --- */

const COPROC_EMU_READY = 0;
const COPROC_EMU_SERVICE_IOT_BEGIN = 1;
const COPROC_EMU_IOT_ACK = 2;

ppt_state = {
	
	// Paper tape data
	data: [],
	
	// Paper tape pointer
	pointer: 0
	
};

coproc_state = {
	// Used to pause the coprocessor simulation for a number of cycles
	delay: 0,
	
	// Latch that is set when an ack is recieved
	ack_latch: 0,
	
	// Write register
	r_write: 0,
	
	// Coprocessor state machine state
	operation: COPROC_EMU_READY
};

/*
 * Clock the coprocessor, should be done before the next set of microcode control signals are sent out
 */
function coproc_clk(cpu, state) {

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
			
			console.log("Doing IOT on device " + addr + " with data " + data); 
			
			// Acknowledge that the IOT has been serviced and the write register is written
			state.operation = COPROC_EMU_IOT_ACK
			status = IO_COPROC_ACK;
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