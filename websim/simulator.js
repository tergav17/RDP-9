/*
 * simulator.js
 *
 * Handles the user-facing functions of the simulator
 */

const diag_flow = document.getElementById("diagflow");
const button_run = document.getElementById("button-run");

// Attempt to get the context for the diag flow
if (diag_flow.getContext) {
	var flow_ctx = diag_flow.getContext("2d");
} else {
	alert("Canvas not supported!");
}

// Add listeners for events
window.addEventListener('keyup',keyUpListener,false);
window.addEventListener('keydown',keyDownListener,false); 
window.addEventListener('resize', resizeCanvas, false);
diag_flow.addEventListener('mousedown', mouseDown);

// Set up interval that drives the CPU execution
setInterval(updateClock, 20);

// Keep track of scaling for mouse events
var scaleX = 1.0;
var scaleY = 1.0;

// Do initial drawing of canvas
updateFlow(true);

// Simulation control buttons
var runClock = false;
function simRunHalt() {
	runClock = (!runClock ? 1 : 0);
	
	if (runClock) {
		button_run.innerHTML = "HALT";
	} else {
		button_run.innerHTML = "RUN";
	}
}

// Hack function to halt the machine
function simHalt() {
	runClock = true;
	simRunHalt();
}

/*
 * Set PC to 0 and re-propagate
 */
function simReset() {
	cpu_state.r_state = [0, 0, 0, 0, 0];
	propagate(cpu_state);
	
	updateFlow(false);
}

/*
 * Execute a single cycle, update flow
 */
function simStep() {
	simTick();
	updateFlow(false);
}

/*
 * Execute a single clock cycle. Update CPU and IO state but do not redraw
 */ 
function simTick() {
	latch(cpu_state);
	io_latch(cpu_state, device_states);
	propagate(cpu_state);
	io_propagate(cpu_state, device_states);
}

// event farm!!!! :)
var clockCyclesPerTick = 1000;
var last_front_panel_state = 0;
function updateClock() {
	
	// Decrement all front panel bits
	cpu_state.front_panel_state = 0;
	if (cpu_state.front_panel_ctrl.halt_step) {
		if (runClock) {
			cpu_state.front_panel_ctrl.halt_step--;
		}
		cpu_state.front_panel_state = 1;
	}
	if (cpu_state.front_panel_ctrl.cont) {
		cpu_state.front_panel_ctrl.cont--;
		cpu_state.front_panel_state = 2;
	}
	if (cpu_state.front_panel_ctrl.go_to) {
		cpu_state.front_panel_ctrl.go_to--;
		cpu_state.front_panel_state = 3;
	}
	if (cpu_state.front_panel_ctrl.exam) {
		cpu_state.front_panel_ctrl.exam--;
		cpu_state.front_panel_state = 4;
	}
	if (cpu_state.front_panel_ctrl.exam_next) {
		cpu_state.front_panel_ctrl.exam_next--;
		cpu_state.front_panel_state = 5;
	}
	if (cpu_state.front_panel_ctrl.dept) {
		cpu_state.front_panel_ctrl.dept--;
		cpu_state.front_panel_state = 6;
	}
	if (cpu_state.front_panel_ctrl.dept_next) {
		cpu_state.front_panel_ctrl.dept_next--;
		cpu_state.front_panel_state = 7;
	}
	if (cpu_state.front_panel_ctrl.read_in) {
		cpu_state.front_panel_ctrl.read_in--;
		cpu_state.front_panel_state = 8;
	}
	if (cpu_state.front_panel_ctrl.xct) {
		cpu_state.front_panel_ctrl.xct--;
		cpu_state.front_panel_state = 9;
	}
	if (last_front_panel_state != cpu_state.front_panel_state) {
		updateFlow(false);
		last_front_panel_state = cpu_state.front_panel_state;
	}
	
	
	for (let i = 0; i < clockCyclesPerTick; i++) {
		if (runClock) {
			simTick();
		}
	}
	updateFlow(false);
}


function mouseDown(e) {
	e.preventDefault();
	
	canvasRect = diag_flow.getBoundingClientRect()
	let mx = (e.clientX - canvasRect.left) / scaleX;
	let my = (e.clientY - canvasRect.top) / scaleY;
	
	
	// I really should have some proper button handling code
	// but I don't wanna so we are going to hardcode one instead
	//
	// cry about it
	let x = 10; let y = 240;
	let sw_num = 18;
	for (let i = 0; i < 6; i++) {
		
		for (let o = 0; o < 3; o++) {
			let bx = x + (i * 64) + (20 * o);
			let by = y + 5;
			sw_num--;
			
			if (mx >= bx && mx <= bx + 15 && my >= by && my <= by + 30) {
				cpu_state.s_switch_data ^= (1 << sw_num);
			}
		}
	}
	
	let bx = 7;
	let press_time = 5;
	x = 430 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.halt_step = press_time;
	}
	x = 465 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.cont = press_time;
	}
	x = 500 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.go_to = press_time;
	}
	x = 535 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.exam = press_time;
	}
	x = 570 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.exam_next = press_time;
	}
	x = 605 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.dept = press_time;
	}
	x = 640 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.dept_next = press_time;
	}
	x = 675 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.read_in = press_time;
	}
	x = 710 + bx; y = 240;
	if (mx >= x && mx <= x + 15 && my >= y && my <= y + 30) {
		cpu_state.front_panel_ctrl.xct = press_time;
	}
	
	
	/*
	x = 430; y = 240;
	sw_num = 15;
	for (let i = 0; i < 5; i++) {
		
		for (let o = 0; o < 3; o++) {
			let bx = x + (i * 64) + (20 * o);
			let by = y + 5;
			sw_num--;
			
			if (mx >= bx && mx <= bx + 15 && my >= by && my <= by + 30) {
				cpu_state.s_switch_addr ^= (1 << sw_num);
			}
		}
	}
	*/
	
	propagate(cpu_state);
	updateFlow(false);
	
}

function keyUpListener(e) {
	
	let k = e.key.toLowerCase();
	
	if (k == "a") {
		// Do something
	}
}

function keyDownListener(e) {
	let k = e.key.toLowerCase();
	
	if (k == "a") {
		// Do something
	}
}

function resizeCanvas() {
	updateFlow(true);
}

/*
 * Redraws the CPU flow chart to the current state
 */
function drawFlow(cpu) {
	
	// Clear
	flow_ctx.reset();
	flow_ctx.setTransform(1, 0, 0, 1, 0, 0);
	flow_ctx.scale(scaleX, scaleY);
	flow_ctx.clearRect(0, 0, diag_flow.width, diag_flow.height);
	
	
	// Set up style commons
	flow_ctx.font = "10px courier";
	flow_ctx.lineCap = "round";
	flow_ctx.lineWidth = 1;
	let x, y;
	
	// Draw debug information
	x = 10; y = 10;
	let ucode = "["
	for (let i = 0; i < cpu.s_ctrl.length; i++) {
		ucode += toByte(cpu.s_ctrl[i]);
		if (i != cpu.s_ctrl.length - 1) {
			ucode += ", "
		} else {
			ucode += "]"
		}
	}
	let ustate = "["
	for (let i = 0; i < cpu.r_state.length; i++) {
		ustate += toByte(cpu.r_state[i]);
		if (i != cpu.r_state.length - 1) {
			ustate += ", "
		} else {
			ustate += "]"
		}
	}
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("uCode Input: " + toWord(cpu.s_ucode_input, 13), x, y);
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("uCode Output: " + ucode, x, y+15);
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("Current State: " + ustate, x, y+30);
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("Data Bus: " + toWord(cpu.s_data_bus, 18), x + 400, y);
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("Addr Bus: " + toWord(cpu.s_addr_bus, 18), x + 400, y+15);
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("OB: " + toWord(cpu.r_reg_ob, 18), x + 400, y+30);
	
	// Draw front panel box
	x = 10; y = 90;
	flow_ctx.beginPath();
	flow_ctx.strokeStyle = "black";
	flow_ctx.roundRect(x - 7, y - 25, 744, 235, 5);
	flow_ctx.stroke();
	
	// Memory Buffer Register
	x = 10; y = 90;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("MEMORY BUFFER", x + 148, y - 10);
	drawRegisterSegmented(x, y, cpu.r_reg_mb, 6);
	
	// Accumulator Register
	x = 10; y = 140;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("ACCUMULATOR", x + 154, y - 10);
	drawRegisterSegmented(x, y, cpu.r_reg_ac, 6);
	
	// Multipler Quotient Register
	x = 10; y = 190;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("MULTIPLER QUOTIENT", x + 137, y - 10);
	drawRegisterSegmented(x, y, cpu.r_reg_mq, 6);
	
	// Program Counter
	x = 430; y = 140;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("PROGRAM COUNTER", x + 110, y - 10);
	drawRegisterSegmented(x, y, cpu.r_reg_pc, 5);
	
	// Memory Address
	x = 430; y = 190;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("MEMORY ADDRESS", x + 113, y - 10);
	drawRegisterSegmented(x, y, cpu.r_reg_ma, 5);
	
	// Instruction Register
	x = 646; y = 90;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("INSTRUCTION", x + 15, y - 10);
	drawRegister(x, y, getbit(cpu.r_reg_ir, 13, 5), 5);
	
	// Link register
	x = 430; y = 90;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("LNK", x - 2, y - 10);
	drawRegister(x, y, cpu.r_reg_link, 1);
	
	// PIE signal
	x = 454; y = 90;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("PIE", x - 2 , y - 10);
	drawRegister(x, y, 0, 1);
	
	// Run signal
	x = 478; y = 90;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("RUN", x - 2 , y - 10);
	drawRegister(x, y, !cpu.s_halt_indicator, 1);
	
	// Draw 18-Bank Switches
	x = 10; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("SWITCH REGISTER", x + 145, y - 5);
	let val = cpu_state.s_switch_data;
	for (let i = 0; i < 6; i++) {
		
		for (let o = 0; o < 3; o++) {
			drawSwitch(x + (i * 64) + (20 * o), y + 5, (val & (1 << 17)) ? true : false);
			val = val << 1;
		}
	}
	
	// Draw HALT / STEP switch
	let bx = 7;
	x = 430 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("HALT", x - 4, y - 10);
	flow_ctx.fillText("STEP", x - 4, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.halt_step > 0);
	
	// Draw CONTinue switch
	x = 465 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("CONT", x - 4, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.cont > 0);
	
	// Draw GOTO switch
	x = 500 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("GOTO", x - 4, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.go_to > 0);
	
	// Draw EXAMine switch
	x = 535 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("EXAM", x - 4, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.exam > 0);
	
	// Draw EXAMine NEXT switch
	x = 570 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("EXAM", x - 4, y - 10);
	flow_ctx.fillText("NEXT", x - 4, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.exam_next > 0);
	
	// Draw DEPosiT switch
	x = 605 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("DEPT", x - 4, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.dept > 0);
	
	// Draw DEPosiT NEXT switch
	x = 640 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("DEPT", x - 4, y - 10);
	flow_ctx.fillText("NEXT", x - 4, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.dept_next > 0);
	
	// Draw READ IN switch
	x = 675 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("READ", x - 4, y - 10);
	flow_ctx.fillText(" IN ", x - 4, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.read_in > 0);
	
	// Draw XCT switch
	x = 710 + bx; y = 240;
	flow_ctx.fillStyle = "black";
	flow_ctx.fillText("XCT", x - 2, y - 0);
	drawSwitch(x, y + 5, cpu.front_panel_ctrl.xct > 0);
	
	/*
	// Draw 15-Bank Switches
	x = 430; y = 240;
	val = cpu_state.s_switch_addr;
	for (let i = 0; i < 5; i++) {
		
		for (let o = 0; o < 3; o++) {
			drawSwitch(x + (i * 64) + (20 * o), y + 5, (val & (1 << 14)) ? true : false);
			val = val << 1;
		}
	}
	*/
}

/*
 * Convert a number to an 8-bit byte
 */
function toByte(val) {
	if (val > 255 || val < 0) {
		return "????????";
	}
	
	let output = ""
	for (let i = 0; i < 8; i++) {
		output = (val & 01) + output;
		val = val >> 1;
	}
	
	return output;
}

/*
 * Convert a number to an 18-bit word
 */
function toWord(val, count) {
	if (val > ((2**count)-1) || val < 0) {
		return "??????????????????";
	}
	
	let output = ""
	for (let i = 0; i < count; i++) {
		output = (val & 01) + output;
		val = val >> 1;
	}
	
	return output;
}

/*
 * Helper function to draw switches
 */
function drawSwitch(x, y, position) {
	flow_ctx.beginPath();
	flow_ctx.strokeStyle = "grey";
	flow_ctx.fillStyle = "grey";
	flow_ctx.rect(x, y, 15, 30);
	flow_ctx.fill();
	
	flow_ctx.beginPath();
	flow_ctx.strokeStyle = "white";
	flow_ctx.fillStyle = "white";
	flow_ctx.rect(x + 2, y + 2 + (position == 0 ? 15 : 0), 11, 11);
	flow_ctx.fill();
}

/*
 * Draws a register bank
 * 1 Segment = 3 Lights
 */
function drawRegister(x, y, val, count) {
	bit = 1 << count;
	for (let i = 0; i < count; i++) {
		bit = bit >> 1;
		drawIndicator(x + (i * 20), y, (val & bit) != 0);
	}
}

/*
 * Draws a segmented register bank
 * 1 Segment = 3 Lights
 */
function drawRegisterSegmented(x, y, val, segs) {
	bit = 1 << (3 * segs);
	for (let i = 0; i < segs; i++) {
		for (let o = 0; o < 3; o++) {
			bit = bit >> 1;
			drawIndicator(x + (i * 64) + (o * 20), y, (val & bit) != 0);
		}
	}
}

/*
 * Helper function to draw indicator
 */
function drawIndicator(x, y, state) {
	flow_ctx.beginPath();
	flow_ctx.strokeStyle = "black";
	flow_ctx.fillStyle = "black";
	flow_ctx.arc(x+7, y+7, 7, 0, 2 * Math.PI);
	flow_ctx.stroke();
	
	if (state) {
		flow_ctx.beginPath();
		flow_ctx.strokeStyle = "red";
		flow_ctx.fillStyle = "red";
		flow_ctx.arc(x+7, y+7, 5, 0, 2 * Math.PI);
		flow_ctx.fill();
	}
}

/*
 * Handles a resize or redraw operation
 */
function updateFlow(doResize) {
	
	let vWidth = Math.floor(768);
	let vHeight = Math.floor(432);
	
	// Handle resizing
	if (doResize) {
		
		let ratioX = vWidth;			// Keep the same aspect ratio as the virtual screen
		let ratioY = vHeight;
		let offsetX = 20;				// How far should we be from the right side of the screen? 
		let minimumLowerSpace = 400;	// How much horizontal space is NOT canvas
		let minimumWidth = 320;			// Minimum width of the simulator screen
		
		// Initially, try to fill up the entire width of the screen
		let newWidth = window.innerWidth - offsetX;
		let newHeight = ratioY * newWidth / ratioX;
		
		// See if the new height is going to be too tall
		let remaining = window.innerHeight - newHeight;
		if (remaining < minimumLowerSpace) {
			newWidth = ratioX * (window.innerHeight - minimumLowerSpace) / ratioY;
		}
		
		// Ensure that the new width meets the minimum size
		if (newWidth < minimumWidth)
			newWidth = minimumWidth;
		
		// Resize the window to meet standards
		flow_ctx.canvas.width = newWidth;
		flow_ctx.canvas.height = ratioY * flow_ctx.canvas.width / ratioX;
		
		// Set the graphical scale
		scaleX = flow_ctx.canvas.width / vWidth;
		scaleY = flow_ctx.canvas.height / vHeight;
	}
	
	// Redraw the flow
	drawFlow(cpu_state);
}
