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

/* --- IO SUBSYSTEM EMULATION --- */

// System flag states
var sysflag_state = {
	
	// Memory management enable
	r_flag_memm: 0,
	
	// Interrupt enable
	r_flag_pi: 0
	
	// Restore pending
	r_flag_rest_pending: 0

// Device request 
var drq_state = {
	
	// Selected device
	r_selected_dev: 0,
	
	// Device request status
	r_drq: 0,
	
	// Selected operation
	r_req_dma: 0,
	r_req_dev_chan: 0,
	
	// Device endpoints
	devices: []
	
};

// Populate available DRQs
for (let i = 0; i < 8; i++) {
	
	// Set default values
	drq_state.devices[i] = {};
	drq_state.devices[i].s_drq_grant = 0;
	drq_state.devices[i].r_drq = 0;
	drq_state.devices[i].r_req_dma = 0;
	drq_state.devices[i].r_req_dev_chan = 0;
	
}

const RTC_DEVICE_ID = 0;
const RTC_DRQ_PRIORITY = 0;
const RTC_TICK_TIME = 1000;

// Real time clock
var rtc_state = {
	
	// RTC timer
	rtc_timer: 0,
	
	// Real time clock enable
	r_rtc_enable: 0,
	
	// Real time clock flag
	r_rtc_flag: 0
	
};

const PPTR_DEVICE_ID = 1;
const PPTR_MODE_ALPHA = 0;
const PPTR_MODE_BINARY = 1;
const PPTR_MODE_NULL = 2;

// Paper tape reader / punch state
var ppt_state = {
	
	// Paper tape data
	pptr_data: [],
	
	// Paper tape buffer
	r_pptr_buffer: 0,
	
	// Paper tape has data
	r_pptr_flag: 1,
	
	// Paper tape reader mode
	pptr_mode: PPTR_MODE_NULL,
	
	// Paper tape reader delay
	pptr_delay: 0,
	
	// Paper tape pointer
	pptr_pointer: 0
	
};

const TTY_PRINT_DEVICE_ID = 4;

// TTY printer / keyboard state
var tty_state = {
	
	// Printer ready flag
	r_printer_flag: 1,
	
	// Printer buffer
	s_printer_buffer: 0,
	
	// Printer delay constant
	printer_delay: 0
}

var device_states = {
	
	// Interrupt signal
	r_interrupt_req: 0,
	
	// System flag states
	sysflag: sysflag_state,
	
	// Device request chain
	drq: drq_state,
	
	// Real time clock
	rtc: rtc_state,
	
	// Paper tape state
	ppt: ppt_state,
	
	// Teleprinter state
	tty: tty_state,
	
	// Last pulse states
	last_iot_pulse_state: 0,
	last_drq_pulse_state: 0
};

const IOT_ISR_DEVICE_FIELD = 6;
const IOT_ISR_SUBDEVICE_FIELD = 4;
const IOT_ISR_PULSE_FIELD = 0;



/*
 * Latching phase of I/O device update
 * At this point, any signals will be treated as canonical and flags will be updated
 */
function io_latch(cpu, devices) {

		// Unpack all IOT related commands
	let iot_cmd = cpu.r_state[3];
	let iot_pulse = getbit(iot_cmd, IOT_PULSE, 1);
	let dev_req_grant = getbit(iot_cmd, DEV_REQ_GRANT, 1);
	let req_addr_phase = getbit(iot_cmd, REQ_ADDR_PHASE, 1);
	let jmp_i_detect = getbit(iot_cmd, JMP_I_DETECT, 1);
	let interrupt_detect = getbit(iot_cmd, INTERRUPT_DETECT, 1);
	
	let data = cpu.r_reg_wrtbk;
	let addr = cpu.s_addr_bus;
	
	let device = getbit(addr, IOT_ISR_DEVICE_FIELD, 6);
	let subdevice = getbit(addr, IOT_ISR_SUBDEVICE_FIELD, 2);
	let pulse = getbit(addr, IOT_ISR_PULSE_FIELD, 3);
	
	switch (device) {
		
		// Paper tape reader
		case PPTR_DEVICE_ID:
			
			break;
			
		// TTY printer
		case TTY_PRINT_DEVICE_ID:
			
			break;
		
		default:
			break;
	}
	
	// Update DRQ priority logic (if allowed)
	let drq_grant = getbit(iot_cmd, DEV_REQ_GRANT, 1);
	let drq = devices.drq;
	if (!drq_grant) {
		// If a DRQ is not happening, update the priorities
		let i = 0;
		for (i = 0; i < 8; i++) {
			if (drq.devices[i].r_drq)
				break;
		}
		
		// Is one of the devices requesting an action?
		if (i < 8) {
			// Set DRQ value
			r_selected_dev = i;
			drq.r_drq = 1;
			drq.r_req_dma = drq.r_req_dma;
			drq.r_req_dev_chan = drq.r_req_dev_chan;
			
		} else {
			// Reset DRQ
			drq.r_drq = 0;
			drq.r_req_dma = 0;
			drq.r_req_dev_chan = 0;
			
		}
	}
	
}

/*
 * Propagation phase of I/O device update
 * After completion, CPU device bus and associated flags are expected to be updated
 */
function io_propagate(cpu, devices) {
	
	// Unpack all IOT related commands
	let iot_cmd = cpu.r_state[3];
	let iot_pulse = getbit(iot_cmd, IOT_PULSE, 1);
	let dev_req_grant = getbit(iot_cmd, DEV_REQ_GRANT, 1);
	let req_addr_phase = getbit(iot_cmd, REQ_ADDR_PHASE, 1);
	let jmp_i_detect = getbit(iot_cmd, JMP_I_DETECT, 1);
	let interrupt_detect = getbit(iot_cmd, INTERRUPT_DETECT, 1);
	let increment_zero_pulse = (getbit(cpu.r_state[2], 7, 1) && cpu.r_reg_zero) ? 1 : 0;
	
	let data_in = cpu.r_reg_wrtbk;
	let addr = cpu.s_addr_bus;
	
	// IOT addressing
	let device = getbit(addr, IOT_ISR_DEVICE_FIELD, 6);
	let subdevice = getbit(addr, IOT_ISR_SUBDEVICE_FIELD, 2);
	let pulse = getbit(addr, IOT_ISR_PULSE_FIELD, 3);
	let zero = cpu.r_reg_zero;
	
	// Writeback external value?
	let extrn = 0;
	
	// Skip?
	let skip = 0;
	
	// Check for rising and falling edge
	let iot_rising = (!devices.last_iot_pulse_state && iot_pulse) ? 1 : 0;
	let iot_falling = (devices.last_iot_pulse_state && !iot_pulse) ? 1 : 0;
	let drq_rising = (!devices.last_drq_pulse_state && dev_req_grant) ? 1 : 0;
	let drq_falling = (devices.last_drq_pulse_state && !dev_req_grant) ? 1 : 0;
	
	// Propagate DRQ signals
	let drq = devices.drq;
	for (let i = 0; i < 8; i++) {
		drq.devices[i].s_drq_grant = (dev_req_grant && r_selected_dev == i) ? 1 : 0;
	}
	
	// RTC DRQ handler
	if (drq.devices[RTC_DRQ_PRIORITY].s_drq_grant) {
		// Async register reset
		drq.devices[RTC_DRQ_PRIORITY].r_drq = 0;
		
		// Set add-to-memory address
		cpu.s_device_bus = assert(cpu.s_device_bus, 00007);
		
		// Set extrn
		extrn = 1;
		
		// Check increment zero pulse
		if (increment_zero_pulse) {
			console.log("Increment zero pulse");
			devices.rtc.r_rtc_flag = 1;
		}
	}
	
	// Handle activites
	switch (device) {
		
		// Real time clock
		// Also include interrupt stuff
		case RTC_DEVICE_ID:
		
			let rtc = devices.rtc;
			let sysflag = devices.sysflag;
			
			// Skip if flag is set
			if (pulse & 001 && iot_pulse) {
				//console.log("Skip? " + rtc.r_rtc_flag);
				if (rtc.r_rtc_flag) {
					skip = 1;
				}
			}
			
			// Set interrupts
			if (pulse & 002 && iot_falling) {
				sysflag.r_flag_pi = subdevice & 002 ? 1 : 0;
				
				console.log("PIE is now " + sysflag.r_flag_pi);
			}
			
			// Set clock enable
			if (pulse & 004 && iot_falling) {
				rtc.r_rtc_enable = subdevice & 002 ? 1 : 0;
				rtc.r_rtc_flag = 0;
				
				console.log("RTC is now " + rtc.r_rtc_enable);
			}
		
			break;
		
		// Paper tape reader
		case PPTR_DEVICE_ID: 

			let ppt = devices.ppt;
		
			// Assert skip flag if needed
			if (pulse & 001 && iot_pulse) {
				if (ppt.r_pptr_flag) {
					skip = 1;
				}
			}
			
			// Reset flag
			if (pulse & 002 && iot_falling) {
				ppt.r_pptr_flag = 0;
			}
			
			// Assert pptr buffer
			if (pulse & 002 && iot_pulse) {
				extrn = 1;
				cpu.s_device_bus = assert(cpu.s_device_bus, ppt.r_pptr_buffer);
			}
			
			// Reset flag and set next write-in mode
			if (pulse & 004 && iot_falling) {
				ppt.r_pptr_flag = 0;
				if (subdevice & 002) {
					ppt.pptr_mode = PPTR_MODE_BINARY;
				} else {
					ppt.pptr_mode = PPTR_MODE_ALPHA;
				}
			}
			break;
			
		// TTY printer
		case TTY_PRINT_DEVICE_ID:
		
			let tty = devices.tty;
			
			// Check printer ready flag
			if (pulse & 001 && iot_pulse) {
				if (tty.r_printer_flag) {
					skip = 1;
				}
			}
			
			if (pulse & 002 && iot_falling) {
				tty.r_printer_flag = 0;
			}
			
			if (pulse & 004 && iot_falling) {
				tty.printer_delay = 300;
				uart_output(data_in & 0177);
			}
			break;
		
		default:
			if (iot_rising)  {
				console.log("Unknown IOT on device " + device + "." + subdevice + "." + pulse + " with data " + data_in); 
			}
			break;
	}
	
	// Do async reset of PIE if an interrupt is detected
	if (interrupt_detect) {
		devices.sysflag.r_flag_pi = 0;
	}
	
	// Create interrupt request signal
	devices.r_interrupt_req = 0;
	if (devices.sysflag.r_flag_pi) {
		devices.r_interrupt_req |= devices.rtc.r_rtc_flag;
	}
	if (devices.r_interrupt_req) {
		console.log("IRQ!");
	}
	
	cpu.s_iot_extrn = extrn;
	cpu.s_iot_skip = skip;
	devices.last_iot_pulse_state = iot_pulse;
	devices.last_drq_pulse_state = dev_req_grant;
}


/* --- DEVICE STUFF --- */

/*
 * Device tick, used for timing certain things
 */
function device_tick(devices) {
	
	// Tick the real time clock
	rtc_tick(devices.rtc, devices.drq);
	
	// Tick the teleprinter subsystem
	tty_tick(devices.tty);
	
	// Tick the paper tape subsystem
	ppt_tick(devices.ppt);
}

function rtc_tick(rtc, drq) {
	
	// Check timer
	if (rtc.rtc_timer > RTC_TICK_TIME) {
		
		// If the RTC is enabled, set the DRQ flag
		if (rtc.r_rtc_enable) {
			drq.devices[RTC_DRQ_PRIORITY].r_drq = 1;
		}
		rtc.rtc_timer = 0;
	
	} else {
		
		rtc.rtc_timer++;
	}
	
}

function tty_tick(tty) {
	
	// Decrement printer delay value
	if (tty.printer_delay > 0) {
		tty.printer_delay--;
		
		if (tty.printer_delay == 0) {
			tty.r_printer_flag = 1;
		}
	}
	
}

function ppt_tick(ppt) {
	
	
	// Below this is all stuff that can be delayed
	if (ppt.pptr_delay > 0) {
		ppt.pptr_delay--;
		return;
	}
	
	// Try to read in a new value if the mode is correct
	if (ppt.pptr_mode == PPTR_MODE_ALPHA && ppt.pptr_pointer < ppt.pptr_data.length) {
		ppt.r_pptr_buffer = ppt.pptr_data[ppt.pptr_pointer];
		ppt.pptr_pointer++;
		ppt.r_pptr_flag = 1;
		ppt.pptr_mode = PPTR_MODE_NULL;
		ppt.pptr_delay = 10;
	}
	if (ppt.pptr_mode == PPTR_MODE_BINARY && ppt.pptr_pointer < (ppt.pptr_data.length + 2)) {
		let i = ppt.pptr_pointer;
		ppt.r_pptr_buffer = getbit(ppt.pptr_data[i+2], 0, 6) | (getbit(ppt.pptr_data[i+1], 0, 6) << 6) | (getbit(ppt.pptr_data[i], 0, 6) << 12);
		ppt.pptr_pointer += 3;
		ppt.r_pptr_flag = 1;
		ppt.pptr_mode = PPTR_MODE_NULL;
		ppt.pptr_delay = 30;
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
	ppt_state.pptr_pointer = 0;
}

// Shove the .PPT into buffer when uploaded
upload_ppt.addEventListener('change', function(e) {
	let pptFile = upload_ppt.files[0];
	

	(async () => {
        let fileContent = new Uint8Array(await pptFile.arrayBuffer());

		// Copy in ppt data and reset pointer
		ppt_state.pptr_data = [];
		for (let i = 0; i < fileContent.length; i++) {
			ppt_state.pptr_data[i] = fileContent[i];
		}
		ppt_state.pptr_pointer = 0;
		alert("Loaded " + ppt_state.pptr_data.length + " bytes");
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