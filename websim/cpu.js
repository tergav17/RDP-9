/*
 * cpu.js
 *
 * RDP-9 emulation backend
 */
 
 
/*
 * Current CPU state
 *
 * Values with the "r_" prefix are latched and should ONLY be updated in the latch() function
 * Values with the "s_" prefix are signals and should be used as temporary signals
 */
cpu_state = {
	r_core: [],				// Core Memory
	
	// Registers
	r_reg_ac: 0,			// Accumulator
	r_reg_mb: 0,			// Memory buffer
	r_reg_mq: 0,			// Multipler Quotient
	r_reg_pc: 0,			// Program Counter
	r_reg_ma: 0,			// Memory Address
	r_reg_ir: 0,			// Instruction Register
	r_reg_ob: 0,			// Operator Buffer
	
	// ALU stuff
	s_next_link: 0,

	// Flags
	r_flag_ex: 0,			// Extended memory flag register
	r_reg_link: 0,			// Link flag register
	r_reg_zero: 0,			// OB = Zero flag
	r_reg_sign: 0,			// OB = Sign flag
	r_reg_skip: 0,			// OPR skip condition on last OB
	r_reg_maai: 0,			// MA auto index
	
	// Coprocessor status
	s_coproc_status: 0,
	
	// Switch Registers
	s_switch_data: 0,
	s_switch_addr: 0,
	
	// System buses
	s_data_bus: 0,
	s_addr_bus: 0,
	s_ucode_input: 0,
	
	// Microcode
	r_state: [0, 0, 0, 0, 0],
	s_ctrl: [0, 0, 0, 0, 0],
	
	// Front panel stuff
	r_front_panel: 0,
	front_panel_state: 0,
	front_panel_ctrl: {
		halt_step: 0,
		cont: 0,
		go_to: 0,
		exam: 0,
		exam_next: 0,
		dept: 0,
		dept_next: 0,
		read_in: 0,
		xct: 0
	}
};
 
// CPU memory init
cpu_state.r_core = new Array(4 * 8192).fill(0); // Allocate space for core memory

cpu_state.r_core[0] = 0200040;  // LAC 040
cpu_state.r_core[1] = 0740010;	// RAL
cpu_state.r_core[2] = 0740100;  // SMA
cpu_state.r_core[3] = 0600001;	// JMP 001
cpu_state.r_core[4] = 0600000;	// JMP 000

cpu_state.r_core[040] = 0000001;


/*
cpu_state.r_core[0] = 0200040;	// LAC 040
cpu_state.r_core[1] = 0220040;	// LAC I 040
cpu_state.r_core[2] = 0220010;	// LAC I 010
cpu_state.r_core[3] = 0220010;	// LAC I 010
cpu_state.r_core[4] = 0100030;	// JMS 030
cpu_state.r_core[030] = 0111111;
cpu_state.r_core[031] = 0200030;	// LAC 030

cpu_state.r_core[010] = 040;
cpu_state.r_core[040] = 0123;
cpu_state.r_core[041] = 0124;
cpu_state.r_core[042] = 0125;
cpu_state.r_core[0123] = 0321;

*/

//cpu_state.r_core[0] = 0340002;
//cpu_state.r_core[1] = 0600000;
//cpu_state.r_core[2] = 0000001;

/*
 * Takes the currently propagated micro-instruction and updates all registers
 * 
 * Final part of micro-instruction execution
 */
function latch(cpu) {
	
	// Set the front panel register
	// On the real system, this will be done 60 times a second
	cpu.r_front_panel = cpu.front_panel_state & 0x0F;
	
	// Update main registers
	let latch_select = cpu.r_state[1];
	let extended_addressing_latch = getbit(cpu.r_state[2], 5, 1);
	
	// IR register
	if (getbit(latch_select, BUS_LATCH_IR, 1)) {
		cpu.r_reg_ir = bus(cpu.s_data_bus)
	}
	
	// MA register
	if (getbit(latch_select, BUS_LATCH_MA, 1)) {
		if (extended_addressing_latch) {
			cpu.r_reg_ma = getbit(bus(cpu.s_data_bus), 0, 15);
		} else {
			cpu.r_reg_ma = cpu.r_reg_pc & 060000;
			cpu.r_reg_ma |= getbit(bus(cpu.s_data_bus), 0, 13);
		}
		cpu.r_reg_maai = (
			(getbit(cpu.r_reg_ma, 0, 13) & ~07) == 010
		) ? 1 : 0;
	}
	
	// PC register
	if (getbit(latch_select, BUS_LATCH_PC, 1)) {
		if (extended_addressing_latch) {
			cpu.r_reg_pc = getbit(bus(cpu.s_data_bus), 0, 15);
		} else {
			cpu.r_reg_pc &= 060000;
			cpu.r_reg_pc |= getbit(bus(cpu.s_data_bus), 0, 13);
		}
	}
	
	// AC register
	if (getbit(latch_select, BUS_LATCH_AC, 1)) {
		cpu.r_reg_ac = bus(cpu.s_data_bus)
	}
	
	// STEP register
	if (getbit(latch_select, BUS_LATCH_STEP, 1)) {
		cpu.r_reg_step = bus(cpu.s_data_bus) & 0377;
	}
	
	// MQ register
	if (getbit(latch_select, BUS_LATCH_MQ, 1)) {
		cpu.r_reg_mq = bus(cpu.s_data_bus);
	}
	
	// MB register
	if (getbit(latch_select, BUS_LATCH_MB, 1)) {
		cpu.r_reg_mb = bus(cpu.s_data_bus);
	}
	
	// Write to core
	if (getbit(latch_select, BUS_LATCH_CORE, 1)) {
		cpu.r_core[bus(cpu.s_addr_bus)] = bus(cpu.s_data_bus);
	}
	
	// ALU registers
	let alu_ctrl = cpu.r_state[4];
	cpu.r_reg_skip = (
		((cpu.r_reg_zero && getbit(cpu.r_reg_ir, 7, 1)) ||
		(cpu.r_reg_sign && getbit(cpu.r_reg_ir, 6, 1)) || 
		(cpu.r_reg_link && getbit(cpu.r_reg_ir, 8, 1))) 
		!= getbit(cpu.r_reg_ir, 9, 1)
	) ? 1 : 0;
	//console.log("Update skip to " + cpu.r_reg_skip + ", Zero: " + cpu.r_reg_zero + ", Sign: " + cpu.r_reg_sign + ", Link: " + cpu.r_reg_link);
	if (getbit(alu_ctrl, ALU_LATCH_OB, 1)) {
		cpu.r_reg_ob = bus(cpu.s_data_bus);
		cpu.r_reg_zero = cpu.r_reg_ob ? 0 : 1;
		cpu.r_reg_sign = getbit(cpu.r_reg_ob, 17, 1);
		cpu.r_reg_link = bus(cpu.s_next_link);
	}
	
	// We have successfully completed execution, latch in the next state
	cpu.r_state = cpu.s_ctrl;
	
}

/*
 * Propagates a new micro-instruction into the processor
 * All transient values will be updated, but no registers will change
 *
 * Nothing in this function should change the "true" state of the processor
 */
function propagate(cpu) {
	
	// Step 0: Set all of the buses to floating
	// We want to make sure that they don't get asserted twice
	cpu.s_data_bus = -1;
	cpu.s_addr_bus = -1;
	cpu.s_alu_arith_out = -1;
	cpu.s_alu_shift_out = -1;
	
	// Step 1: Get the microstate that the CPU will execute in the next cycle
	let decode_mode = getbit(cpu.r_state[0], 6, 2);
	let microcode_input = decode_mode << 11;
	switch (decode_mode) {
		case DECODE_MODE_SERVICE:
			let step = cpu.r_state[0] & 077
			microcode_input |= step;
			microcode_input |= 0 << 6; // TODO: Interrupt pending?
			if (step >= 32) {
				// Put flags
				microcode_input |= cpu.r_reg_zero << 7;
				microcode_input |= cpu.r_reg_skip << 8;
			} else {
				if (step < 16) {
					microcode_input |= cpu.r_front_panel << 7;
				} else {
					microcode_input |= cpu.s_coproc_status << 7;
				}
			}
			break;
		
		case DECODE_MODE_INSTRUCTION:
			microcode_input |= (cpu.r_state[0] & 007) | (getbit(cpu.r_reg_ir, 12, 6) << 3);
			microcode_input |= 0 << 9; // TODO: Extend mode
			microcode_input |= cpu.r_reg_maai << 10;
			break;
			
		case DECODE_MODE_OPERATE:
			microcode_input |= getbit(cpu.r_state[0], 0, 1);
			microcode_input |= getbit(cpu.r_reg_ir, 0, 6) << 1;
			microcode_input |= getbit(cpu.r_reg_ir, 10, 3) << 7;
			microcode_input |= cpu.r_reg_link << 10;
			break;
			
	}
	cpu.s_ucode_input = microcode_input;
	cpu.s_ctrl = decode(microcode_input);
	
	// Step 2: Do ALU related activites
	let alu_ctrl = cpu.r_state[4];
	let alu_op_select = getbit(alu_ctrl, ALU_OP_SELECT, 3);
	let alu_link_select = getbit(alu_ctrl, ALU_LINK_SELECT, 2);
	let alu_select_shifter = getbit(alu_ctrl, ALU_SELECT_SHIFTER, 1);
	let alu_select_ones = getbit(alu_ctrl, ALU_SELECT_ONES, 1);
	
	// ALU inputs
	let shift_input = cpu.r_reg_ob & 0777777;
	let arith_input_a = shift_input | (cpu.r_reg_link << 18);
	let arith_input_b = cpu.r_reg_mb & 0777777;
	
	// Perform arithmatic operations
	let arith_out = 0;
	let arith_link_out = 0;
	let arith_carry_out = 0;
	switch(alu_op_select & 07) {
		case ALU_CLEAR:
			
			// Do CLEAR
			arith_out = 0;
			break;
			
		case ALU_BMA:
		
			// Do B MINUS A
			arith_out = (arith_input_b - arith_input_a) - 1;
			break;
			
		case ALU_AMB:
		
			// Do A MINUS B
			arith_out = (arith_input_a - arith_input_b) - 1;
			break;
			
		case ALU_ADD:
		
			// Do A ADD B
			arith_out = arith_input_a + arith_input_b;
			arith_carry_out = getbit(shift_input + arith_input_b, 18, 1);
			break;
			
		case ALU_XOR:
		
			// Do A XOR B
			arith_out = arith_input_a ^ arith_input_b;
			break;
			
		case ALU_OR:
		
			// Do A OR B
			arith_out = arith_input_a | arith_input_b;
			break;
			
		case ALU_AND:
		
			// Do A AND B
			arith_out = arith_input_a & arith_input_b;
			break;
			
		case ALU_PRESET:
		
			// Do PRESET
			arith_out = 01777777;
			break;
	}
	arith_out &= 0777777;
	
	// 1's mode
	if (alu_select_ones) {
		if (arith_carry_out || getbit(alu_op_select, 2, 1)) {
			arith_out++;
			arith_out &= 0777777;
		}
		
		arith_link_out = (
			(!getbit(arith_out, 17, 1) != getbit(arith_input_b, 17, 1)) &&
			(getbit(arith_out, 17, 1) != getbit(arith_input_a, 17, 1))
		) ? 1 : 0;
		arith_link_out |= cpu.r_reg_link
	} else {
		arith_link_out = getbit(arith_out, 18, 1);
	}
	
	// Perform shift operations
	let shift_out = 0;
	let shift_link_out = 0;
	switch(alu_op_select & 03) {
		case ALU_SHIFT_RAR:
		
			// Do RAR
			shift_link_out = getbit(shift_input, 0, 1);
			shift_out = (shift_input >> 1) | (cpu.r_reg_link << 17);
			
			break;
			
		case ALU_SHIFT_RAL:
		
			// Do RAL
			shift_link_out = getbit(shift_input, 17, 1);
			shift_out = (shift_input << 1) | (cpu.r_reg_link);
			
			break;
			
		case ALU_SHIFT_RTR:
		
			// Do RTR
			shift_link_out = getbit(shift_input, 1, 1);
			shift_out = (shift_input >> 2) | (cpu.r_reg_link << 16) | (getbit(shift_input, 0, 1) << 17);
		
			break;
		
		case ALU_SHIFT_RTL:
		
			// Do RTL
			shift_link_out = getbit(shift_input, 16, 1);
			shift_out = (shift_input << 2) | (cpu.r_reg_link << 1) | getbit(shift_input, 17, 1);
			
			break;
	}
	shift_out &= 0777777;
	
	// Get next link
	switch(alu_link_select) {
		case ALU_LINK_KEEP:
			cpu.s_next_link = cpu.r_reg_link;
			break;
			
		case ALU_LINK_COMP:
			cpu.s_next_link = !cpu.r_reg_link ? 1 : 0;
			break;
			
		case ALU_LINK_ARITH:
			cpu.s_next_link = arith_link_out;
			break;
			
		case ALU_LINK_SHIFT:
			cpu.s_next_link = shift_link_out;
			break;
	}

	
	// Step 3: Propagate registers onto their proper buses
	
	let page_zero_addressing = getbit(cpu.r_state[2], 6, 1);
	
	// Get the address bus
	if (getbit(cpu.r_state[2], 4, 1)) {
		let pc_ma_switch = getbit(cpu.r_state[2], 3, 1);
		if (pc_ma_switch == ADDR_SELECT_PC) {
			cpu.s_addr_bus = assert(cpu.s_addr_bus, cpu.r_reg_pc);
		} else {
			cpu.s_addr_bus = assert(cpu.s_addr_bus, cpu.r_reg_ma);
		}
		if (page_zero_addressing) {
			// When we are in page zero addressing, the top 2 bits of the address should be zeroed
			cpu.s_addr_bus &= 017777;
		}
	}
	
	// Get the data bus
	let data_bus_select = getbit(cpu.r_state[2], 0, 3)
	let constant_value = getbit(cpu.r_state[2], 7, 1);
	switch (data_bus_select) {
	
		case BUS_SELECT_EMPTY:
		
			// Put the contents of the switch register on the bus if constant == 0
			if (!constant_value) {
				cpu.s_data_bus = assert(cpu.s_data_bus, cpu.s_switch_data);
			}
			break;
			
		case BUS_SELECT_AC:
			cpu.s_data_bus = assert(cpu.s_data_bus, cpu.r_reg_ac);
			break;
			
		case BUS_SELECT_STEP:
			cpu.s_data_bus = assert(cpu.s_data_bus, cpu.r_reg_step);
			break;
			
		case BUS_SELECT_MQ:
			cpu.s_data_bus = assert(cpu.s_data_bus, cpu.r_reg_mq);
			break;
			
		case BUS_SELECT_CROSS:
			// TODO add status bits
			cpu.s_data_bus = assert(cpu.s_data_bus, ((bus(cpu.s_addr_bus) + constant_value) & 017777));
			cpu.s_data_bus |= bus(cpu.s_addr_bus) & 060000;
			break;
			
		case BUS_SELECT_ALU:
			if (alu_select_shifter) {
				cpu.s_data_bus = assert(cpu.s_data_bus, shift_out);
			} else {
				cpu.s_data_bus = assert(cpu.s_data_bus, arith_out);
			}
			break;
			
		case BUS_SELECT_CORE:
			cpu.s_data_bus = assert(cpu.s_data_bus, cpu.r_core[bus(cpu.s_addr_bus)]);
			break;
			
		case BUS_SELECT_CONST:
			cpu.s_data_bus = assert(cpu.s_data_bus, 0);
 			if (!constant_value) {
				cpu.s_data_bus |= 007;
			} else {
				cpu.s_data_bus |= 020;
			}
			break;
	
		default:
			console.log("WARNING: Bad data bus select");
			break;
	}
	
	// Get the ALU operation bus
	cpu.s_alu_ctrl_word = cpu.r_state[4];
	
}

// Decode modes
const DECODE_MODE_SERVICE = 0;
const DECODE_MODE_INSTRUCTION = 1;
const DECODE_MODE_OPERATE = 2;
const DECODE_MODE_MISC = 3;

// Bus selection modes
const BUS_SELECT_EMPTY = 0;
const BUS_SELECT_AC = 1;
const BUS_SELECT_STEP = 2;
const BUS_SELECT_MQ = 3;
const BUS_SELECT_CROSS = 4;
const BUS_SELECT_ALU = 5;
const BUS_SELECT_CORE = 6;
const BUS_SELECT_CONST = 7;

const BUS_LATCH_IR = 0;
const BUS_LATCH_MA = 1;
const BUS_LATCH_PC = 2;
const BUS_LATCH_AC = 3;
const BUS_LATCH_STEP = 4;
const BUS_LATCH_MQ = 5;
const BUS_LATCH_MB = 6;
const BUS_LATCH_CORE = 7;

// PC / MA select
const ADDR_SELECT_PC = 0;
const ADDR_SELECT_MA = 1;

// ALU Stuff
const ALU_OP_SELECT = 0;
const ALU_LINK_SELECT = 3;
const ALU_SELECT_SHIFTER = 5;
const ALU_SELECT_ONES = 6;
const ALU_LATCH_OB = 7;

const ALU_CLEAR = 0;
const ALU_BMA = 1;
const ALU_AMB = 2;
const ALU_ADD = 3;
const ALU_XOR = 4;
const ALU_OR = 5;
const ALU_AND = 6;
const ALU_PRESET = 7;

const ALU_SHIFT_RAR = 0;
const ALU_SHIFT_RAL = 1;
const ALU_SHIFT_RTR = 2;
const ALU_SHIFT_RTL = 3;

const ALU_LINK_KEEP = 0;
const ALU_LINK_COMP = 1;
const ALU_LINK_ARITH = 2;
const ALU_LINK_SHIFT = 3;

const FP_NOOP = 0;
const FP_HALT_STEP = 1;
const FP_CONT = 2;
const FP_GOTO = 3;
const FP_EXAM = 4;
const FP_EXAM_NEXT = 5;
const FP_DEPT = 6;
const FP_DEPT_NEXT = 7;
const FP_READ_IN = 8;
const FP_XCT = 9;

// MISC stuff
const IOCP_REQ = 0;
const IOCP_ACK = 1;
const IOCP_TRANS_CTRL = 2;
const HALT_INDICATE = 3;

// -- SERVICE MODE STEPS --

// Reset steps
const STEP_SRV_RESET_ENTRY = 0;
const STEP_SRV_RESET_AC_CLEAR = 1;

// Instruction management steps
const STEP_SRV_FETCH = 2;			// Fetch the next instruction
const STEP_SRV_PC_NEXT = 3;			// Increment the program counter unconditionally
const STEP_SRV_AWAIT_NOFP = 4;		// Awaits for no no switches to be depressed on the front panel
const STEP_SRV_HALT = 5;			// Halt state, wait for something to happen
const STEP_SRV_REFETCH = 6;			// Perform a refetch and go back to waiting
const STEP_SRV_SHOW_CORE = 7;		// Place CORE[MA] into MB for debugging purposes
const STEP_SRV_MA_NEXT = 8;			// Increment MA and then show it
const STEP_SRV_XCT_NULL = 9;		// Null state to wait for IR to propagate
const STEP_SRV_SKIP_ZERO = 32;		// Increment the program count if OB = 0
const STEP_SRV_SKIP_NOT_ZERO = 33;	// Increment the program count if OB != 0
const STEP_SRV_SKIP_OPR = 34;		// Skip based on operate condition


// --- INSTRUCTION MODE STEPS

// General steps
const STEP_ISR_EXECUTE_BEGIN = 0;	// Beginning point for all instructions to execute
const STEP_ISR_INDEX_INC = 1;		// Optional step to increment the previously fetched MA and store it
const STEP_ISR_INDIR_COMPLETE = 2;	// First step that indirectable instructions take


// --- OPCODES ---

// CAL
const OPCODE_CAL = 0;
const STEP_ISR_CAL_INDIR = 1;		// Perform simple indirection on MA
const STEP_ISR_CAL_PC_MB = 2;		// Stash the program counter in MB, OB so it can be stored later 
const STEP_ISR_CAL_PC_STORE = 3;	// Store the program counter
const STEP_ISR_CAL_MA_PC = 4;		// Store the MA + 1 into PC


// DAC	
const OPCODE_DAC = 1;				// Initial step: Store AC into CORE[MA]

// JMS
const OPCODE_JMS = 2;				// Initial step: Transfer PC to MB, OB
const STEP_ISR_JMS_PC_STORE = 3;	// Store the program counter
const STEP_ISR_JMS_MA_PC = 4;		// Store the MA + 1 into PC

// DZM
const OPCODE_DZM = 3;				// Initial step; Store 0 into CORE[MA]

// LAC		
const OPCODE_LAC = 4;				// Initial step: Store CORE[MA] into AC

// XOR								
const OPCODE_XOR = 5;				// Initial step: Store CORE[MA] into MB
const STEP_ISR_XOR_AC_OB = 3;		// Send the accumulator to the operator buffer
const STEP_ISR_XOR_LATCH = 4;		// Latch the result of the XOR into AC

// ADD
const OPCODE_ADD = 6;				// Initial step: Store CORE[MA] into MB
const STEP_ISR_ADD_AC_OB = 3;		// Send the accumulator to the operator buffer
const STEP_ISR_ADD_LATCH = 4;		// Latch the result of the ADD into AC

// TAD
const OPCODE_TAD = 7;				// Initial step: Store CORE[MA] into MB
const STEP_ISR_TAD_AC_OB = 3;		// Send the accumulator to the operator buffer
const STEP_ISR_TAD_LATCH = 4;		// Latch the result of the TAD into AC

const OPCODE_XCT = 8;				// Initial step: Perform a fetch using MA instead of PC
const STEP_ISR_XCT_NULL = 3;		// Null cycle before returning to instruction execution

const OPCODE_ISZ = 9;				// Initial step: Store CORE[MA] into OB, MB
const STEP_ISR_ISZ_INC = 3;			// Increment value in OB, MB, store in OB and CORE[MA]
const STEP_ISR_ISZ_NULL = 4;		// Null cycle before checking the value

const OPCODE_AND = 10;				// Initial step: Store CORE[MA] into MB
const STEP_ISR_AND_AC_OB = 3;		// Send the accumulator to the operator buffer
const STEP_ISR_AND_LATCH = 4;		// Latch the result of the AND into AC

const OPCODE_SAD = 11;				// Initial step: Store CORE[MA] into MB
const STEP_ISR_SAD_AC_OB = 3;		// Send the accumulator to the operator buffer
const STEP_ISR_SAD_LATCH = 4;		// Latch the result of the XOR into OB
const STEP_ISR_SAD_NULL = 5;

const OPCODE_JMP = 12;				// Initial step: Store MA itno PC

// EAE
const OPCODE_EAE = 13;

// IOT
const OPCODE_IOT = 14;

// OPR
const OPCODE_OPR = 15;				// Initial step: AC -> OB
const STEP_ISR_OPR_PRESET_MB = 1	// Place 0777777 into MB
const STEP_OPR_STAGE_ONE = 0		// First stage of OPR, compliment / clear AC and L
const STEP_ISR_OPR_SWR_MB =  2		// Move the switch register into OB
const STEP_OPR_STAGE_TWO = 1		// Perform shift operations or OR in the switch register

// Instructions defined here will allow for indirect addressing
const INDIRECTABLE = [
	OPCODE_DAC,
	OPCODE_JMS,
	OPCODE_DZM,
	OPCODE_LAC,
	OPCODE_XOR,
	OPCODE_ADD,
	OPCODE_TAD,
	OPCODE_XCT,
	OPCODE_ISZ,
	OPCODE_AND,
	OPCODE_SAD,
	OPCODE_JMP
];

// I/O coprocessor status constants
const IO_COPROC_REQ_NULL = 0;			// The I/O coprocessor is idle and not requesting any operation
const IO_COPROC_REQ_INT = 1;			// The I/O coprocessor is requesting an interrupt
const IO_COPROC_REQ_INC = 2;			// The I/O coprocessor is requesting a memory increment operation
const IO_COPROC_REQ_CH_READ = 3;		// The I/O coprocessor is requesting to read from a channel
const IO_COPROC_REQ_CH_WRITE = 4;		// The I/O coprocessor is requesting to write to a channel
const IO_COPROC_REQ_DMA_READ = 5;		// The I/O coprocessor is requesting to do a DMA read operation
const IO_COPROC_REQ_DMA_WRITE = 6;		// The I/O coprocessor is requesting to do a DMA write operation
const IO_COPROC_ACK = 8;				// Acknowledge the completion of an IOT
const IO_COPROC_ACK_WRITE = 9;			// Acknowledge IOT completion and provide a return word
const IO_COPROC_ACK_SKIP = 10;			// Acknowledge IOT completion and tell the processor to skip
const IO_COPROC_ACK_WSKIP = 11;			// Acknowledge IOT completion, write a word, and skip
const IO_COPROC_NOT_PRESENT = 15;		// The I/O coprocessor is not installed in the machine

/*
 * Part of the propagation process
 *
 * Figures out what the next micro-state of the processor should be. Nothing should actually get latched here
 /* Think of this as a lookup table with a single output for every unique input
 */
function decode(input) {
		
	// --- INPUTS ---
	//
	// I[11:12] = Decode Mode
	// If Decode Mode == 0 (Service Mode)
	// 	I[0:5] = Current step
	//	I[6] = I/O subsystem request
	//	If Step < 32:
	//		If Step < 16:
	//			I[7:10] = Front panel status
	//		Else:
	//			I[7:10] = I/O request status
	//	If Step >= 32:
	//		I[7] = Zero flag
	//		I[8] = OPR skip flag
	//		I[9] = 
	//		I[10] = 
	// If Decode Mode == 1 (Instruction Mode)
	//	I[0:2] = Current step
	//	I[3] = IR[5]
	//	I[4] = Indirection
	//	I[5:8] = Instruction
	//	I[9] = Extended mode
	//	I[10] =  MA auto index
	// If Decode Mode == 2 (Operate Mode)
	//	I[0] = Current step
	//	I[1] = CMA
	//	I[2] = CML
	//	I[3] = OAS
	//	I[4] = RAL
	//	I[5] = RAR
	//	I[6] = HLT
	//	I[7] = AROT (Additional Rotate)
	//	I[8] = CLL
	//	I[9] = CLA
	//	I[10] = Link Flag
	// If Decode Mode == 3 (Misc Mode)
	//	If Step[5] == 0:
	//		I[0:4] = Current step
	//		I[5:7] = EAE opcode (IR[6:8])
	//		I[8] = EAE AC sign
	
	// --- OUTPUTS
	//
	// O[0][0:5] = Next step
	// O[0][6:7] = Next decode mode
	//
	// O[1][0] = Latch IR
	// O[1][1] = Latch MA
	// O[1][2] = Latch PC
	// O[1][3] = Latch AC
	// O[1][4] = Latch STEP
	// O[1][5] = Latch MQ
	// O[1][6] = Latch MB
	// O[1][7] = Write Core
	//
	// O[2][0:2] = Define bus select
	//	0: Bus empty
	//	1: AC register
	//	2: STEP register
	//	3: MQ register
	//	4: PC crossbar
	//	5: ALU result
	// 	6: Core
	//	7: Constant
	// O[2][3] = Select PC / MA address
	// O[2][4] = Enable address to core
	// O[2][5] = Enable extended address latching
	// O[2][6] = Force page zero address
	// O[2][7] = Constant generation
	//	0: 007 / ADDR + 0
	//	1: 020 / ADDR + 1
	//
	// O[3][0] = IOT coprocessor attention request
	// O[3][1] = Coprocessor operation acknowledge
	// O[3][2] = Coprocessor transfer control
	// O[4][3] = Halt indicator
	//
	// O[4][0:2] = ALU operation select
	// O[4][3:4] = Link operation select
	//	0: Keep Link
	//	1: Compliment Link
	//	2: Arith -> Link
	//	3: Shifter -> Link
	// O[4][5] = Select shifter
	// O[4][6] = Set 1-s compliment mode
	// O[4][7] = Latch OB
	
	let latch_ir = 0;
	let latch_ma = 0;
	let latch_pc = 0;
	let latch_ac = 0;
	let latch_step = 0;
	let latch_mq = 0;
	let latch_mb = 0;
	let write_core = 0;
	
	let alu_op_select = 0;
	let alu_link_select = 0;
	let alu_select_shifter = 0;
	let alu_select_ones = 0;
	let latch_ob = 0;
	
	let bus_output_select = BUS_SELECT_EMPTY;
	
	let select_pc_ma = ADDR_SELECT_PC;
	let enable_addr_to_core = 0;
	let constant_value = 0;
	
	let extended_addressing_enable = 0;
	let bank_zero_enable = 0;
	
	// IOT stuff
	let coproc_req = 0;
	let coproc_ack = 0;
	let coproc_trans_ctrl = 0;
	let halt_indicator = 0;
	
	// Get the decode mode
	// The next decode mode will default to the current
	let decode_mode = getbit(input, 11, 2);
	let next_decode_mode = decode_mode;
	
	let next_step = STEP_SRV_RESET_ENTRY;
	let next_state = 0;
	if (decode_mode == DECODE_MODE_SERVICE) {
		// Misc step decoding
		let step = getbit(input, 0, 6);
		let irq_pending = getbit(input, 6, 1);
		let front_panel_state = getbit(input, 7, 4);
		let flag_zero = getbit(input, 7, 1);
		let flag_skip = getbit(input, 8, 1);
		
		
		switch (step) {
			// --- SYSTEM RESET BLOCK ---
			
			// Reset condition
			// (This is the hardcoded entry point)
			// NO-OP
			case STEP_SRV_RESET_ENTRY:
				next_step = STEP_SRV_RESET_AC_CLEAR;
				break;
				
			// Clear out the all of the registers
			// 1 -> EXTEND_ENABLE
			// 0 -> PC, AC, MQ, STEP
			// STEP_SRV_REFETCH -> NEXT
			case STEP_SRV_RESET_AC_CLEAR:
				
				// Set the bus to 0
				bus_output_select = BUS_SELECT_ALU;
				alu_op_select = ALU_CLEAR;
				
				// We enable extension so the entire PC / MA gets reset
				extended_addressing_enable = 1;
				
				// Perform a write on AC, PC, MQ, STEP
				latch_pc = 1;
				latch_ac = 1;
				latch_mq = 1;
				latch_step = 1;
				
				// TODO: Reset all of the flags
				next_step = STEP_SRV_REFETCH;
				break;
				
			// --- INSTRUCTION MANAGEMENT BLOCK ---
			
			// Start an instruction execution cycle
			// The instruction should be fetched from memory
			// We should also check for interrupts and panel operations here
			// 0 -> EXTEND_ENABLE
			// CORE[PC] -> IR, MA, OB, MB
			// IF FP_HALT_STEP OR FP_XCT:
			//  STEP_SRV_AWAIT_NOFP -> NEXT
			// ELSE:
			//  STEP_SRV_PC_NEXT -> NEXT
			case STEP_SRV_FETCH:
				
				// Fetch the instruction from memory				// Read from core, put it in IR, MA, and MB
				extended_addressing_enable = 0;
				bus_output_select = BUS_SELECT_CORE;
				select_pc_ma = ADDR_SELECT_PC;
				enable_addr_to_core = 1;
				
				// Latch IR, MA, OB, MB
				latch_ir = 1;
				latch_ma = 1;
				latch_ob = 1;
				latch_mb = 1;
				
				if (front_panel_state == FP_HALT_STEP || front_panel_state == FP_XCT) {
					// Do nothing and start waiting for the front panel to be neutral
					next_step = STEP_SRV_AWAIT_NOFP;
					break;
				} else {
					// TODO: Check in on the interrupts
					next_step = STEP_SRV_PC_NEXT;
					break;
				}
			
			// Increment the program counter before instruction execution
			// This after to fetch so that the previously read instruction has
			// time to be decoded
			// PC + 1 -> PC
			// STEP_ISR_EXECUTE_BEGIN -> NEXT
			case STEP_SRV_PC_NEXT:
				
				// Increment the PC
				bus_output_select = BUS_SELECT_CROSS;
				select_pc_ma = ADDR_SELECT_PC;
				enable_addr_to_core = 1;
				latch_pc = 1;
				constant_value = 1;

				next_step = STEP_ISR_EXECUTE_BEGIN;
				next_decode_mode = DECODE_MODE_INSTRUCTION;
				break;
				
			// Await for no switches to be depressed on the front panel
			// When that happens, go to the halt loop
			// IF FP_NOOP:
			//  STEP_SRV_HALT -> NEXT
			// ELSE:
			//  STEP_SRV_FETCH_SKIP_FP -> NEXT
			case STEP_SRV_AWAIT_NOFP:
				
				if (front_panel_state == FP_NOOP) {
					// Go to the halt loop and await a command
					next_step = STEP_SRV_HALT;
					break;
				} else {
					// Keep waiting for a neutral front panel
					next_step = STEP_SRV_AWAIT_NOFP;
					break;
				}
				
			// The halt state, await for a front panel switch to be depressed
			// IF FP_HALT_STEP:
			//  0 -> EXTEND_ENABLE
			//  CORE[PC] -> IR, MA, OB, MB
			//  STEP_SRV_PC_NEXT -> NEXT
			// ELSE IF FP_CONT:
			//  STEP_SRV_FETCH -> NEXT
			// ELSE IF FP_GOTO:
			//  1 -> EXTEND_ENABLE
			//  SW -> PC
			//  STEP_SRV_REFETCH -> NEXT
			// ELSE IF FP_EXAM:
			//  1 -> EXTEND_ENABLE
			//  SW -> MA
			//  STEP_SRV_SHOW_CORE -> NEXT
			// ELSE IF FP_EXAM_NEXT:
			//  MA + 1 -> MA
			//  STEP_SRV_MA_NEXT -> NEXT
			// ELSE IF FP_DEPT:
			//  SW -> CORE[MA]
			//  STEP_SRV_SHOW_CORE -> NEXT
			// ELSE IF FP_DEPT_NEXT
			//  SW -> CORE[MA]
			//  STEP_SRV_MA_NEXT -> NEXT
			// ELSE IF FP_XCT:
			//  SW -> IR, MA, OB, MB
			//  STEP_ISR_EXECUTE_BEGIN -> NEXT
			//  
			// ELSE:
			//  STEP_SRV_HALT -> NEXT
			case STEP_SRV_HALT:
			
				switch (front_panel_state) {
					
					case FP_HALT_STEP:
						// We are doing a single step, re-read in the instruction
						// Read from core, put it in IR, MA, and MB
						extended_addressing_enable = 0;
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_PC;
						enable_addr_to_core = 1;
						
						// Latch IR, MA, OB, MB
						latch_ir = 1;
						latch_ma = 1;
						latch_ob = 1;
						latch_mb = 1;
						
						next_step = STEP_SRV_PC_NEXT;
						break;
						
					case FP_CONT:
						// We are going back to normal operation
						next_step = STEP_SRV_FETCH;
						break;
					
					case FP_GOTO:
						// Update the program counter using the switch register
						extended_addressing_enable = 1;
						bus_output_select = BUS_SELECT_EMPTY;
						constant_value = 0;
						
						// Latch PC
						latch_pc = 1;
						
						// Refetch
						next_step = STEP_SRV_REFETCH;
						break;
						
					case FP_EXAM:
						// Update the memory address using the switch register
						extended_addressing_enable = 1;
						bus_output_select = BUS_SELECT_EMPTY;
						constant_value = 0;
						
						// Latch MA
						latch_ma = 1;
						
						// Show on MB
						next_step = STEP_SRV_SHOW_CORE;
						break;
						
					case FP_EXAM_NEXT:
						// Increment MA
						next_step = STEP_SRV_MA_NEXT;
						break;
						
					case FP_DEPT:
						// Place the switch register on the bus
						bus_output_select = BUS_SELECT_EMPTY;
						constant_value = 0;
						
						// Get ready to put the value into core
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;
						write_core = 1;
						
						// Show on MB
						next_step = STEP_SRV_SHOW_CORE;
						break;
						
					case FP_DEPT_NEXT:
						// Place the switch register on the bus
						bus_output_select = BUS_SELECT_EMPTY;
						constant_value = 0;
						
						// Get ready to put the value into core
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;
						write_core = 1;
						
						// Show on MB
						next_step = STEP_SRV_MA_NEXT;
						break;
						
					case FP_XCT:
						// Place the switch register on the bus
						bus_output_select = BUS_SELECT_EMPTY;
						constant_value = 0;
						
						// Do normal fetch stuff
						// Latch IR, MA, OB, MB
						latch_ir = 1;
						latch_ma = 1;
						latch_ob = 1;
						latch_mb = 1;
						
						console.log("XCT");
						
						// Execute the instruction
						next_step = STEP_SRV_XCT_NULL;
						break;
					
					default:
						// Keep on waiting for something to happen
						next_step = STEP_SRV_HALT;
						break;
				}
				break;
				
			// Perform a refetch to update register values
			// When completed, return to the halt loop
			// 0 -> EXTEND_ENABLE
			// CORE[PC] -> IR, MA, OB, MB
			// STEP_SRV_AWAIT_NOFP -> NEXT
			case STEP_SRV_REFETCH:
			
				// Fetch the instruction from memory				// Read from core, put it in IR, MA, and MB
				extended_addressing_enable = 0;
				bus_output_select = BUS_SELECT_CORE;
				select_pc_ma = ADDR_SELECT_PC;
				enable_addr_to_core = 1;
				
				// Latch IR, MA, OB, MB
				latch_ir = 1;
				latch_ma = 1;
				latch_ob = 1;
				latch_mb = 1;
				
				// Go back to waiting for the NOFP state
				next_step = STEP_SRV_AWAIT_NOFP;
				break;
				
			// Use MA to fetch from core and put it in MB
			// CORE[MA] -> MB
			// STEP_SRV_AWAIT_NOFP -> NEXT
			case STEP_SRV_SHOW_CORE:
			
				// Put CORE[MA] on the bus
				bus_output_select = BUS_SELECT_CORE;
				select_pc_ma = ADDR_SELECT_MA;
				enable_addr_to_core = 1;
				
				// Latch MB
				latch_mb = 1;
				
				// Go back to waiting for the NOFP state
				next_step = STEP_SRV_AWAIT_NOFP;
				break;
				
			// Increment MA
			// MA + 1 -> MA
			// STEP_SRV_SHOW_CORE -> NEXT
			case STEP_SRV_MA_NEXT:
				// Increment MA
				bus_output_select = BUS_SELECT_CROSS;
				select_pc_ma = ADDR_SELECT_MA;
				enable_addr_to_core = 1;
				constant_value = 1;
				
				// Latch MA
				latch_ma = 1;
				
				// Show on MB
				next_step = STEP_SRV_SHOW_CORE;
				break;
				
			// Start executing an arbitrary instruction in IR
			case STEP_SRV_XCT_NULL:
				// Begin instruction execution
				next_decode_mode = DECODE_MODE_INSTRUCTION;
				next_step = STEP_ISR_EXECUTE_BEGIN;
				break;
			
				
			// Increment the program counter if OB = 0
			// IF FLAG_ZERO:
			//  PC + 1 -> PC
			// STEP_SRV_FETCH -> NEXT
			case STEP_SRV_SKIP_ZERO:
				if (flag_zero) {
					bus_output_select = BUS_SELECT_CROSS;
					select_pc_ma = ADDR_SELECT_PC;
					enable_addr_to_core = 1;
					latch_pc = 1;
					constant_value = 1;
				}
				
				next_step = STEP_SRV_FETCH;
				break;
				
			// Increment the program counter if OB != 0
			// IF !FLAG_ZERO:
			//  PC + 1 -> PC
			// STEP_SRV_FETCH -> NEXT
			case STEP_SRV_SKIP_NOT_ZERO:
				if (!flag_zero) {
					bus_output_select = BUS_SELECT_CROSS;
					select_pc_ma = ADDR_SELECT_PC;
					enable_addr_to_core = 1;
					latch_pc = 1;
					constant_value = 1;
				}
				
				next_step = STEP_SRV_FETCH;
				break;
				
			// Increment the program counter based on the skip flag
			// If the skip flag is not set, set MB to the switch register
			// IF FLAG_SKIP:
			//  PC + 1 -> PC
			//  STEP_ISR_OPR_SWR_MB -> NEXT
			// ELSE:
			//  SW -> MB
			//  STEP_OPR_STAGE_TWO -> NEXT
			case STEP_SRV_SKIP_OPR:
				if (flag_skip) {
					bus_output_select = BUS_SELECT_CROSS;
					select_pc_ma = ADDR_SELECT_PC;
					enable_addr_to_core = 1;
					latch_pc = 1;
					constant_value = 1;
					
					next_decode_mode = DECODE_MODE_INSTRUCTION;
					next_step = STEP_ISR_OPR_SWR_MB;
				} else {
					// Put the switch register on the bus
					bus_output_select = BUS_SELECT_EMPTY;
					constant_value = 0;
					
					// Latch MB
					latch_mb = 1;
					
					// Do the second stage of the OPeRate
					next_decode_mode = DECODE_MODE_OPERATE;
					next_step = STEP_OPR_STAGE_TWO;
				}
				break;
				
			default:
				break;
				
		}
		
		// Build the next state
		next_state = next_step & 077;
	} else if (decode_mode == DECODE_MODE_INSTRUCTION) {
		// Decode an instruction
		let step = getbit(input, 0, 3);
		let ir_5 = getbit(input, 3, 1);
		let indirect = getbit(input, 4, 1);
		let opcode = getbit(input, 5, 4);
		let extend_mode = getbit(input, 9, 1);
		let flag_maai = getbit(input, 10, 1);
		
		console.log("Opcode: " + opcode + ", Step: " + step);
		
		// Execute instructions here
		
		// Many instructions allow for "indirect addressing"
		// We will process that here
		if (INDIRECTABLE.includes(opcode)) {
			switch (step) {
				// Step 1: Check indirection. If not, skip this step and fall to the next step
				// If it is indirect, fetch the new MA from core
				// If it's indexed it goes in MA
				// Otherwise it goes into OB, MB
				// IF INDIR:
				//  IF FLAG_MAAI:
				//   1 -> ZERO_PAGE
				//	 CORE[MA] -> OB, MB
				//	 STEP_ISR_INDEX_INC -> NEXT
				//  ELSE:
				//   EXTEND_MODE -> EXTEND_ENABLE
				//   CORE[MA] -> MA, MB
				//	 STEP_ISR_INDIR_COMPLETE -> NEXT
				// ELSE:
				//  GOTO STEP_ISR_INDEX_INC
				case STEP_ISR_EXECUTE_BEGIN:
					if (indirect) {
						if (flag_maai) {
							
							// Fetch contents of memory from indirect indirect
							// Make sure we get it from the zero page
							bus_output_select = BUS_SELECT_CORE;
							enable_addr_to_core = 1;
							bank_zero_enable = 1;
							select_pc_ma = ADDR_SELECT_MA;
							
							// Place it in OB and MB
							latch_ob = 1;
							latch_mb = 1;
							
							// Increment the address next cycle
							next_step = STEP_ISR_INDEX_INC;
							break;
						} else {
							
							// Fetch contents of memory from indirect address
							bus_output_select = BUS_SELECT_CORE;
							enable_addr_to_core = 1;
							select_pc_ma = ADDR_SELECT_MA;
							
							// If we are in extend mode, use the full address of what we just incremented
							extended_addressing_enable = extend_mode;
							
							// Place it in MA and MB
							latch_ma = 1;
							latch_mb = 1;
							
							// We have completed the indirection
							next_step = STEP_ISR_INDIR_COMPLETE;
							break;
						}
					} else {
						// Fall to STEP_ISR_INDIR_COMPLETE
						step = STEP_ISR_INDIR_COMPLETE;
					}
					
				// Step 2: Increment the value fetched in step 1, and store it in CORE[MA] / MA
				// Only do something if we are using the autoincrement functionality
				// IF INDIR AND FLAG_MAAI:
				//  EXTEND_MODE -> EXTEND_ENABLE
				//  (OB OR MB) + 1 -> CORE[MA], MA
				//  NEXT -> STEP_ISR_INDIR_FETCH
				// ELSE:
				//  GOTO STEP_ISR_INDIR_FETCH
				case STEP_ISR_INDEX_INC:
					if (indirect && flag_maai) {
						// Increment the contents of MB
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_OR;
						alu_select_ones = 1;
						
						// If we are in extend mode, use the full address of what we just incremented
						extended_addressing_enable = extend_mode;
						
						// Place the result of the ALU in core and MA
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;
						write_core = 1;
						latch_ma = 1;
						
						// We are done, execute the instruction in the next step
						next_step = STEP_ISR_INDIR_COMPLETE;
						break;
					} else {
						// Fall to STEP_ISR_INDIR_COMPLETE
						step = STEP_ISR_INDIR_COMPLETE;
					}
			
					
				default:
					break;
			}
		}
		
		switch (opcode)  {
			case OPCODE_CAL:
				// Call subroutine
				switch (step) {
					
					// Load in 020 to MA and prepare to save PC
					// EXTEND_MODE -> EXTEND_ENABLE
					// 020 -> MA
					// IF INDIRECT:
					//  STEP_ISR_CAL_INDIR -> NEXT
					// ELSE:
					//  STEP_ISR_CAL_PC_MB
					case STEP_ISR_EXECUTE_BEGIN:
						// Put 020 on the bus
						bus_output_select = BUS_SELECT_CONST;
						constant_value = 1;
						
						// Are we extended?
						extended_addressing_enable = extend_mode;
						
						// Store MA
						latch_ma = 1;
						
						// Do we need to indirect?
						if (indirect) {
							next_step = STEP_ISR_CAL_INDIR;
						} else {
							next_step = STEP_ISR_CAL_PC_MB;
						}
						
						break;
						
					// Perform indirection on MA
					// EXTEND_MODE -> EXTEND_ENABLE
					// CORE[MA] -> MA, MB
					// STEP_ISR_CAL_PC_MB -> NEXT
					case STEP_ISR_CAL_INDIR:
						// Fetch contents of memory from indirect address
						bus_output_select = BUS_SELECT_CORE;
						enable_addr_to_core = 1;
						select_pc_ma = ADDR_SELECT_MA;
						
						// If we are in extend mode, use the full address of what we just incremented
						extended_addressing_enable = extend_mode;
						
						// Place it in MA and MB
						latch_ma = 1;
						latch_mb = 1;
						
						// We have completed the indirection
						next_step = STEP_ISR_CAL_PC_MB;
						break;
						
					// Store to program counter in MB, OB
					// PC -> MB, OB
					// STEP_ISR_CAL_PC_STORE -> NEXT
					case STEP_ISR_CAL_PC_MB:
						// Put the contents of PC onto the bus
						bus_output_select = BUS_SELECT_CROSS;
						enable_addr_to_core = 1;
						select_pc_ma = ADDR_SELECT_PC;
						
						// Store on MB, OB
						latch_mb = 1;
						latch_ob = 1;
						
						// We can now store the PC
						next_step = STEP_ISR_CAL_PC_STORE;
						break;
						
					// Store the contents of MB, OB into core
					// (OB OR MB) -> CORE[MA]
					// STEP_ISR_CAL_MA_PC -> NEXT
					case STEP_ISR_CAL_PC_STORE:
						// Put the ALU onto the bus
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_OR;
						
						// Write to core
						enable_addr_to_core = 1;
						select_pc_ma = ADDR_SELECT_MA;
						write_core = 1;
						latch_mb = 1;
						
						// Finally, put MA + 1 into PC
						next_step = STEP_ISR_CAL_MA_PC;
						break;
						
					// Put MA + 1 into PC
					// 1 -> EXTEND_ENABLE
					// MA + 1 -> PC
					// STEP_SRV_FETCH -> NEXT 
					case STEP_ISR_CAL_MA_PC:
						// Put MA + 1 onto the bus
						bus_output_select = BUS_SELECT_CROSS;
						enable_addr_to_core = 1;
						select_pc_ma = ADDR_SELECT_MA;
						constant_value = 1;
						
						// Latch into PC
						extended_addressing_enable = 1;
						latch_pc = 1;
						
						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;
						
					
				}
				break;
				
			case OPCODE_DZM:
				// Deposit Zero
				switch (step) {
					
					// Place 0 into the memory location pointed to by MA
					// 0 -> CORE[MA]
					// STEP_SRV_FETCH -> NEXT
					case STEP_ISR_INDIR_COMPLETE:
						
						// Put 0 onto the bus
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_CLEAR;
						
						// Setup core write
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;
						write_core = 1;
						latch_mb = 1;

						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;

				}
				break;
				
			case OPCODE_DAC:
				// Deposit AC
				switch (step) {
					
					// Place AC into the memory location pointed to by MA
					// AC -> CORE[MA]
					// STEP_SRV_FETCH -> NEXT
					case STEP_ISR_INDIR_COMPLETE:
						
						// Put AC onto the bus
						bus_output_select = BUS_SELECT_AC;
						
						// Setup core write
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;
						write_core = 1;
						latch_mb = 1;

						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;

				}
				break;
				
			case OPCODE_JMS:
				// Jump subroutine
				switch (step) {
					
					// Store to program counter in MB, OB
					// PC -> MB, OB
					// STEP_ISR_JMS_PC_STORE -> NEXT
					case STEP_ISR_INDIR_COMPLETE:
						// Put the contents of PC onto the bus
						bus_output_select = BUS_SELECT_CROSS;
						enable_addr_to_core = 1;
						select_pc_ma = ADDR_SELECT_PC;
						
						// Store on MB, OB
						latch_mb = 1;
						latch_ob = 1;
						
						// We can now store the PC
						next_step = STEP_ISR_JMS_PC_STORE;
						break;
						
					// Store the contents of MB, OB into core
					// (OB OR MB) -> CORE[MA]
					// STEP_ISR_JMS_MA_PC -> NEXT
					case STEP_ISR_JMS_PC_STORE:
						// Put the ALU onto the bus
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_OR;
						
						// Write to core
						enable_addr_to_core = 1;
						select_pc_ma = ADDR_SELECT_MA;
						write_core = 1;
						latch_mb = 1;
						
						// Finally, put MA + 1 into PC
						next_step = STEP_ISR_JMS_MA_PC
						break;
						
					// Put MA + 1 into PC
					// 1 -> EXTEND_ENABLE
					// MA + 1 -> PC
					// STEP_SRV_FETCH -> NEXT 
					case STEP_ISR_JMS_MA_PC:
						// Put MA + 1 onto the bus
						bus_output_select = BUS_SELECT_CROSS;
						enable_addr_to_core = 1;
						select_pc_ma = ADDR_SELECT_MA;
						constant_value = 1;
						
						// Latch into PC
						extended_addressing_enable = 1;
						latch_pc = 1;
						
						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;
				}
				break;
				
			case OPCODE_LAC:
				// Load AC
				switch (step) {
					
					// Place memory location pointed to by MA into AC
					// CORE[MA] -> AC
					// STEP_SRV_FETCH -> NEXT 
					case STEP_ISR_INDIR_COMPLETE:
					
						// Put the contents of core onto the bus
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;

						// Latch AC
						latch_ac = 1;
						latch_mb = 1;
						
						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;
				}
				break;
				
			case OPCODE_XOR:
				// XOR
				switch (step) {
				
					// Place CORE[MA] into MB
					// CORE[MA] -> MB
					// STEP_ISR_XOR_AC_OB -> NEXT 
					case STEP_ISR_INDIR_COMPLETE:
					
						// Put the contents of core onto the bus
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;

						// Latch MB
						latch_mb = 1;
						
						next_step = STEP_ISR_XOR_AC_OB;
						break;
						
					// Place AC into OB
					// AC -> OB
					// STEP_ISR_XOR_LATCH -> NEXT
					case STEP_ISR_XOR_AC_OB:
						
						// Put AC onto the bus
						bus_output_select = BUS_SELECT_AC;
						
						// Latch OB
						latch_ob = 1;
						
						next_step = STEP_ISR_XOR_LATCH;
						break;
						
					// Perform the ALU operation and store in AC
					// (MB XOR OB) -> AC
					// STEP_SRV_FETCH -> NEXT
					case STEP_ISR_XOR_LATCH:
					
						// Perform the ALU operation
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_XOR;
						
						// Latch AC
						latch_ac = 1;
						
						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;
				}
				break;
				
			case OPCODE_ADD:
				// ADD (One's Compement)
				switch (step) {
				
					// Place CORE[MA] into MB
					// CORE[MA] -> MB
					// STEP_ISR_ADD_AC_OB -> NEXT 
					case STEP_ISR_INDIR_COMPLETE:
					
						// Put the contents of core onto the bus
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;

						// Latch MB
						latch_mb = 1;
						
						next_step = STEP_ISR_ADD_AC_OB;
						break;
						
					// Place AC into OB
					// AC -> OB
					// STEP_ISR_ADD_LATCH -> NEXT
					case STEP_ISR_ADD_AC_OB:
						
						// Put AC onto the bus
						bus_output_select = BUS_SELECT_AC;
						
						// Latch OB
						latch_ob = 1;
						
						next_step = STEP_ISR_ADD_LATCH;
						break;
						
					// Perform the ALU operation and store in AC
					// (MB ADD OB) -> AC, OB
					// LINK_ARITH -> L
					// STEP_SRV_FETCH -> NEXT
					case STEP_ISR_ADD_LATCH:
					
						// Perform the ALU operation
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_ADD;
						alu_select_ones = 1;
						alu_link_select = ALU_LINK_ARITH;
						
						// Latch AC
						latch_ac = 1;
						latch_ob = 1;
						
						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;
				}
				break;
				
			case OPCODE_TAD:
				// ADD (Twos's Compement)
				switch (step) {
				
					// Place CORE[MA] into MB
					// CORE[MA] -> MB
					// STEP_ISR_TAD_AC_OB -> NEXT 
					case STEP_ISR_INDIR_COMPLETE:
					
						// Put the contents of core onto the bus
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;

						// Latch MB
						latch_mb = 1;
						
						next_step = STEP_ISR_TAD_AC_OB;
						break;
						
					// Place AC into OB
					// AC -> OB
					// STEP_ISR_TAD_LATCH -> NEXT
					case STEP_ISR_TAD_AC_OB:
						
						// Put AC onto the bus
						bus_output_select = BUS_SELECT_AC;
						
						// Latch OB
						latch_ob = 1;
						
						next_step = STEP_ISR_TAD_LATCH;
						break;
						
					// Perform the ALU operation and store in AC
					// (MB ADD OB) -> AC, OB
					// LINK_ARITH -> L
					// STEP_SRV_FETCH -> NEXT
					case STEP_ISR_TAD_LATCH:
					
						// Perform the ALU operation
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_ADD;
						alu_link_select = ALU_LINK_ARITH;
						
						// Latch AC and OB
						latch_ac = 1;
						latch_ob = 1;
						
						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;
				}
				break;
				
			case OPCODE_XCT:
				// Execute instruction
				switch (step) {
					
					// Fetch using MA instead of PC
					// 0 -> EXTEND_ENABLE
					// CORE[PC] -> IR, MA
					// STEP_ISR_XCT_NULL -> NEXT
					case STEP_SRV_FETCH:
						
						// Read from core, put it in IR, MA, and MB
						extended_addressing_enable = 0;
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;
						
						// Latch IR and MA
						latch_ir = 1;
						latch_ma = 1;
						
						next_step = STEP_ISR_XCT_NULL;
						break;
						
					// Do nothing to let the fetched instruction propagate
					case STEP_ISR_XCT_NULL:
						next_step = STEP_ISR_EXECUTE_BEGIN;
						break;
				}
				break;
				
			case OPCODE_ISZ:
				// Increment and skip if zero
				switch (step) {
					
					// Store CORE[MA] into OB, MB
					// CORE[MA] -> OB, MB
					// STEP_ISR_ISZ_INC -> NEXT
					case STEP_ISR_INDIR_COMPLETE:
					
						// Put the contents of core onto the bus
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;

						// Latch OB, MB
						latch_ob = 1;
						latch_mb = 1;
						
						next_step = STEP_ISR_ISZ_INC;
						break;
						
					// Increment OB, MB and store
					// (OB OR MB) + 1 -> CORE[MA], OB
					// STEP_ISR_ISZ_NULL -> NEXT
					case STEP_ISR_ISZ_INC:
					
						// Setup ALU to increment
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_OR;
						alu_select_ones = 1;
						
						// Setup core write and OB
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;
						write_core = 1;
						latch_mb = 1;
						latch_ob = 1;
						
						next_step = STEP_ISR_ISZ_NULL;
						break;
						
					// Do nothing
					// STEP_SRV_SKIP_ZERO -> NEXT
					case STEP_ISR_ISZ_NULL:
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_SKIP_ZERO
						break;
						
				}
				break;
				
			case OPCODE_AND:
				// AND
				switch (step) {
				
					// Place CORE[MA] into MB
					// CORE[MA] -> MB
					// STEP_ISR_AND_AC_OB -> NEXT 
					case STEP_ISR_INDIR_COMPLETE:
					
						// Put the contents of core onto the bus
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;

						// Latch MB
						latch_mb = 1;
						
						next_step = STEP_ISR_AND_AC_OB;
						break;
						
					// Place AC into OB
					// AC -> OB
					// STEP_ISR_AND_LATCH -> NEXT
					case STEP_ISR_AND_AC_OB:
						
						// Put AC onto the bus
						bus_output_select = BUS_SELECT_AC;
						
						// Latch OB
						latch_ob = 1;
						
						next_step = STEP_ISR_AND_LATCH;
						break;
						
					// Perform the ALU operation and store in AC
					// (MB AND OB) -> AC
					// STEP_SRV_FETCH -> NEXT
					case STEP_ISR_AND_LATCH:
					
						// Perform the ALU operation
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_AND;
						
						// Latch AC
						latch_ac = 1;
						
						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;
				}
				break;
				
			case OPCODE_SAD:
				// Skip if AC different
				switch (step) {
				
					// Place CORE[MA] into MB
					// CORE[MA] -> MB
					// STEP_ISR_SAD_AC_OB -> NEXT 
					case STEP_ISR_INDIR_COMPLETE:
					
						// Put the contents of core onto the bus
						bus_output_select = BUS_SELECT_CORE;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;

						// Latch MB
						latch_mb = 1;
						
						next_step = STEP_ISR_SAD_AC_OB;
						break;
						
					// Place AC into OB
					// AC -> OB
					// STEP_ISR_SAD_LATCH -> NEXT
					case STEP_ISR_SAD_AC_OB:
						
						// Put AC onto the bus
						bus_output_select = BUS_SELECT_AC;
						
						// Latch OB
						latch_ob = 1;
						
						next_step = STEP_ISR_SAD_LATCH;
						break;
						
					// Perform the ALU operation and store in OB
					// (MB XOR OB) -> OB
					// STEP_ISR_SAD_NULL -> NEXT
					case STEP_ISR_SAD_LATCH:
					
						// Perform the ALU operation
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_XOR;
						
						// Latch OB
						latch_ob = 1;
						
						next_step = STEP_ISR_SAD_NULL;
						break;
						
					// Do nothing
					// STEP_SRV_SKIP_NOT_ZERO -> NEXT
					case STEP_ISR_SAD_NULL:
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_SKIP_NOT_ZERO
						break;
				}
				break;
				
			case OPCODE_JMP:
				// Skip if AC different
				switch (step) {
					// Store MA into PC
					// 1 -> EXTEND_ENABLE
					// MA -> PC
					// STEP_SRV_FETCH -> NEXT
					case STEP_ISR_INDIR_COMPLETE:
					
						// Get MA on the bus
						bus_output_select = BUS_SELECT_CROSS;
						select_pc_ma = ADDR_SELECT_MA;
						enable_addr_to_core = 1;
						
						// Latch PC
						extended_addressing_enable = 1;
						latch_pc = 1;
						
						// We are done
						next_decode_mode = DECODE_MODE_SERVICE;
						next_step = STEP_SRV_FETCH;
						break;
				}
				break;
				
			case OPCODE_OPR:
				// Operate instruction
				switch (step) {
					// Either transfer AC into OB, or perform LAW
					// IF INDIR:
					//  (OB OR MB) -> AC
					//  STEP_SRV_FETCH -> NEXT
					// ELSE:
					//  AC -> OB
					//  STEP_ISR_OPR_PRESET_MB -> NEXT
					case STEP_ISR_EXECUTE_BEGIN:
					
						if (indirect) {
							// Do LAW
							bus_output_select = BUS_SELECT_ALU;
							alu_op_select = ALU_OR;
							
							// Latch AC
							latch_ac = 1;
							
							// We are done
							next_decode_mode = DECODE_MODE_SERVICE;
							next_step = STEP_SRV_FETCH;
							break;
						} else {
							// Normal OPR
							bus_output_select = BUS_SELECT_AC;
							
							// Latch OB
							latch_ob = 1;
							
							next_step = STEP_ISR_OPR_PRESET_MB;
							break;
						}
						
					// Preset and MB register incase we want to invert AC
					// 0777777 -> MB
					// STEP_ISR_OPR_STAGE_ONE -> NEXT
					case STEP_ISR_OPR_PRESET_MB:
						// Put 0777777 on the bus
						bus_output_select = BUS_SELECT_ALU;
						alu_op_select = ALU_PRESET;
						
						// Latch MB
						latch_mb = 1;
						
						// Do the first stage of the OPeRate
						next_decode_mode = DECODE_MODE_OPERATE;
						next_step = STEP_OPR_STAGE_ONE;
						break;
						
					// Put the switch register into MB
					// SW -> MB
					// STEP_OPR_STAGE_TWO -> NEXT
					case STEP_ISR_OPR_SWR_MB:
						// Put the switch register on the bus
						bus_output_select = BUS_SELECT_EMPTY;
						constant_value = 0;
						
						// Latch MB
						latch_mb = 1;
						
						// Do the second stage of the OPeRate
						next_decode_mode = DECODE_MODE_OPERATE;
						next_step = STEP_OPR_STAGE_TWO;
						break;
				}
				break;

			case OPCODE_IOT:
				// IO transfer instruction
				switch (step) {
					case STEP_ISR_EXECUTE_BEGIN:
						break;
				}
				
			default:
				// Instruction not implemented, go fetch another one
				next_decode_mode = DECODE_MODE_SERVICE;
				next_step = STEP_SRV_FETCH;
				break;
						
		}
		
		// Build the next state
		next_state = next_step & 077;
	} else if (decode_mode == DECODE_MODE_OPERATE) {
		// Operate step decoding
		let step = getbit(input, 0, 1);
		let cma = getbit(input, 1, 1);
		let cml = getbit(input, 2, 1);
		let oas = getbit(input, 3, 1);
		let ral = getbit(input, 4, 1);
		let rar = getbit(input, 5, 1);
		let hlt = getbit(input, 6, 1);
		let arot = getbit(input, 7, 1);
		let cll = getbit(input, 8, 1);
		let cla = getbit(input, 9, 1);
		let flag_link = getbit(input, 10, 1);
		
		// There are only 2 actual states, but what the hell I'll use a switch anyways
		switch (step) {
			
			// Perform compliments and clearning on AC / L
			// IF CLA:
			//  IF CMA:
			//   0777777 -> AC, OB
			//  ELSE:
			//   0 -> AC, OB
			// ELSE:
			//  IF CMA:
			//   (OB XOR MB) -> AC, OB
			//  ELSE:
			//   (OB AND MB) -> AC, OB
			// IF CLL:
			//  IF CML:
			//   1 -> FLAG_L
			//  ELSE:
			//   0 -> FLAG_L
			// ELSE:
			//   IF CML:
			//    !FLAG_L -> FLAG_L
			//   ELSE:
			//    FLAG_L -> FLAG_L
			// STEP_ISR_OPR_SWR_MB -> NEXT
			
			case STEP_OPR_STAGE_ONE:
				// Take in the output of the ALU
				bus_output_select = BUS_SELECT_ALU;
				
				// Put it into the AC and OB
				latch_ac = 1;
				latch_ob = 1;

				// Do AC stuff first
				if (cla) {
					// We are clearing the accumulator
					if (cma) {
						alu_op_select = ALU_PRESET;
					} else {
						alu_op_select = ALU_CLEAR;
					}
				} else {
					// Either complimenet or don't
					if (cma) {
						alu_op_select = ALU_XOR;
					} else {
						alu_op_select = ALU_AND;
					}
				}
				
				// Now set the link
				let invert_link = 0;
				if (cll) {
					// We are clearing the link flag
					if (cml) {
						invert_link = flag_link;
					} else {
						invert_link = !flag_link;
					}
				} else {
					invert_link = cml;
				}
				if (invert_link) 
					alu_link_select = ALU_LINK_COMP;
				
				// Execute the skip and switch load steps
				next_decode_mode = DECODE_MODE_SERVICE;
				next_step = STEP_SRV_SKIP_OPR;
				
				break;
				
			// Perform shift operations / do switch register OR operation
			// IF OAS:
			//  (OB OR MB) -> AC
			// ELSE:
			//  IF RAL:
			//   IF AROT:
			//    OB << 2 -> AC
			//   ELSE:
			//    OB << 1 -> AC
			//  IF RAR:
			//   IF AROT:
			//    OB >> 2 -> AC
			//   ELSE:
			//    OB >> 1 -> AC
			// IF HALT:
			//  STEP_SRV_REFETCH -> NEXT
			// ELSE:
			//  STEP_SRV_FETCH -> NEXT
			case STEP_OPR_STAGE_TWO:
				// Take in the output of the ALU
				bus_output_select = BUS_SELECT_ALU;
				
				// We can do OAS and rotates, but not both
				if (oas) {
					latch_ac = 1;
					latch_ob = 1;
					alu_op_select = ALU_OR;
				} else {
					if (ral) {
						latch_ac = 1;
						latch_ob = 1;
						alu_select_shifter = 1;
						alu_link_select = ALU_LINK_SHIFT;
						if (arot) {
							alu_op_select = ALU_SHIFT_RTL;
						} else {
							alu_op_select = ALU_SHIFT_RAL;
						}
					}
					if (rar) {
						latch_ac = 1;
						latch_ob = 1;
						alu_select_shifter = 1;
						alu_link_select = ALU_LINK_SHIFT;
						if (arot) {
							alu_op_select = ALU_SHIFT_RTR;
						} else {
							alu_op_select = ALU_SHIFT_RAR;
						}
					}
				}
			
				// We are done
				if (hlt) {
					next_decode_mode = DECODE_MODE_SERVICE;
					next_step = STEP_SRV_REFETCH;
				} else {
					next_decode_mode = DECODE_MODE_SERVICE;
					next_step = STEP_SRV_FETCH;
				}
				break;
		}
		
		// Build the next state
		next_state = next_step & 077;
	}
	
	// Return new control register
	let latch_settings = 	(latch_ir << BUS_LATCH_IR) | 
							(latch_ma << BUS_LATCH_MA) | 
							(latch_pc << BUS_LATCH_PC) | 
							(latch_ac << BUS_LATCH_AC) | 
							(latch_step << BUS_LATCH_STEP) | 
							(latch_mq << BUS_LATCH_MQ) | 
							(latch_mb << BUS_LATCH_MB) | 
							(write_core << BUS_LATCH_CORE);
							
	let alu_control = 	(alu_op_select << ALU_OP_SELECT) | 
							(alu_link_select << ALU_LINK_SELECT) | 
							(alu_select_shifter << ALU_SELECT_SHIFTER) | 
							(alu_select_ones << ALU_SELECT_ONES) | 
							(latch_ob << ALU_LATCH_OB);
	
	let bus_control = bus_output_select | (select_pc_ma << 3) | (enable_addr_to_core << 4) | (extended_addressing_enable << 5) | (bank_zero_enable << 6) | (constant_value << 7);
	
	let misc_config =	(coproc_req << IOCP_REQ) |
						(coproc_ack << IOCP_ACK) |
						(coproc_trans_ctrl << IOCP_TRANS_CTRL) |
						(halt_indicator << HALT_INDICATE);
	
	return [
			(next_state | (next_decode_mode << 6)) & 0377, 	// ROM 0
			latch_settings & 0377, 							// ROM 1
			bus_control & 0377, 								// ROM 2
			misc_config & 0377,								// ROM 3
			alu_control & 0377,								// ROM 4
			];
}

/*
 * Basically just sets the value of a signal and makes sure it isn't already set
 */
function assert(input, val) {
	if (input == -1) {
		return val;
	} else {
		console.log("WARNING: Multiple assert on bus!");
		var err = new Error();
		console.log(err.stack);
		return input;
	}
}

/*
 * Checks to make sure that a bus has a valid signal on it
 * Defaults to 0 and throws and error if not
 */ 
function bus(input) {
	if (input < 0) {
		console.log("WARNING: Nothing on bus!");
		var err = new Error();
		console.log(err.stack);
		return 0;
	}
	return input;
}

/*
 * Gets bits from a an input
 */
function getbit(input, bit, count) {
	return (input >> bit) & ((2**(count))-1);
}

// Initalize CPU
propagate(cpu_state);