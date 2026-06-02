/*
 * Translates an instruction into a human readable form
 * This is super lazy
 */
function disassemble(instruction, address) {
	
	// Get instruction opcode
	let opcode = (instruction & 0740000) >> 12;
	let indirect = instruction & 0020000;
	let operand = instruction & 0017777;
	let steps = instruction & 0000077;
	let device = (instruction & 0007700) >> 6;
	let isa_prefix = oct15(address) + " : " + oct18(instruction) + " | ";
	let indir = "";
	if (indirect) {
		indir = "I  ";
	}
	
	switch (opcode) {
		
		// CAL instruction
		case 000:
			return isa_prefix + "CAL    " + indir + oct15(operand);
			
		// DAC instruction
		case 004:
			return isa_prefix + "DAC    " + indir + oct15(operand);
			
		// JMS instruction
		case 010:
			return isa_prefix + "JMS    " + indir + oct15(operand);
		
		// DZM instruction
		case 014:
			return isa_prefix + "DZM    " + indir + oct15(operand);
			
		// LAC instruction
		case 020:
			return isa_prefix + "LAC    " + indir + oct15(operand);
			
		// XOR instruction
		case 024:
			return isa_prefix + "XOR    " + indir + oct15(operand);
			
		// ADD instruction
		case 030:
			return isa_prefix + "ADD    " + indir + oct15(operand);
			
		// TAD instruction
		case 034:
			return isa_prefix + "TAD    " + indir + oct15(operand);
			
		// XCT instruction
		case 040:
			return isa_prefix + "XCT    " + indir + oct15(operand);
			
		// ISZ instruction
		case 044:
			return isa_prefix + "ISZ    " + indir + oct15(operand);
	
		// AND instruction
		case 050:
			return isa_prefix + "AND    " + indir + oct15(operand);
			
		// SAD instruction
		case 054:
			return isa_prefix + "SAD    " + indir + oct15(operand);
			
		// JMP instruction
		case 060:
			return isa_prefix + "JMP    " + indir + oct15(operand);
			
		// EAE instruction
		case 064:
			
			switch (instruction & 0777700) {
				
				case 0640500:
					// LRS instruction
					return isa_prefix + "LRS    " + oct6(steps);
					
				case 0660500:
					// LRSS instruction
					return isa_prefix + "LRSS   " + oct6(steps);
					
				case 0640600:
					// LLS instruction
					return isa_prefix + "LLS    " + oct6(steps);
					
				case 0660600:
					// LLSS instruction
					return isa_prefix + "LLSS   " + oct6(steps);
					
				case 0640700:
					// ALS instruction
					return isa_prefix + "ALS    " + oct6(steps);
					
				case 0660700:
					// ALSS instruction
					return isa_prefix + "ALSS   " + oct6(steps);
					
				case 0640400:
					// NORM instruction
					return isa_prefix + "NORM   " + oct6(steps);
					
				case 0660400:
					// NORMS instruction
					return isa_prefix + "NORMS  " + oct6(steps);
					
				case 0653100:
					// MUL instruction
					return isa_prefix + "MUL    " + oct6(steps);
					
				case 0657100:
					// MULS instruction
					return isa_prefix + "MULS   " + oct6(steps);
					
				case 0640300:
					// DIV instruction
					return isa_prefix + "DIV    " + oct6(steps);
					
				case 0644300:
					// DIVS instruction
					return isa_prefix + "DIVS   " + oct6(steps);
					
				case 0653300:
					// IDIV instruction
					return isa_prefix + "IDIV   " + oct6(steps);
					
				case 0657300:
					// IDIVS instruction
					return isa_prefix + "IDIVS  " + oct6(steps);
					
				case 0650300:
					// FRDIV instruction
					return isa_prefix + "FRDIV  " + oct6(steps);
					
				case 0654300:
					// FRDIVS instruction
					return isa_prefix + "FRDIVS " + oct6(steps);
					
				default:
					break;
			}
			
			switch (instruction) {
					
				case 0641002:
					// LACQ instruction
					return isa_prefix + "LACQ   ";
					
				case 0641001:
					// LACS instruction
					return isa_prefix + "LACS   ";
					
				case 0650000:
					// CLQ instruction
					return isa_prefix + "LACS   ";
					
				case 0644000:
					// ABS instruction
					return isa_prefix + "ABS    ";
					
				case 0644000:
					// GSM instruction
					return isa_prefix + "GSM    ";
					
				case 0640001:
					// OSC instruction
					return isa_prefix + "OSC    ";
					
				case 0640002:
					// OMQ instruction
					return isa_prefix + "OMQ    ";
			
				case 0640004:
					// CMQ instruction
					return isa_prefix + "CMQ    ";
					
				case 0652000:
					// LMQ instruction
					return isa_prefix + "LMQ    ";
				
				default:
					break;
			}
			return isa_prefix + "EAE    ";
			
		// IOT instruction
		case 070:
			
			switch (instruction) {
				
				case 0703302:
					// CAF instruction
					return isa_prefix + "CAF    ";
				
				default:
					break;
				
			}
			return isa_prefix + "IOT    " + oct6(device);
			
		// OPR instruction
		case 074:
			
			switch (instruction) {
				
				case 0740000:
					// NOP instruction
					return isa_prefix + "NOP    ";
					
				case 0740001:
					// CMA instruction
					return isa_prefix + "CMA    ";
					
				case 0740002:
					// CML instruction
					return isa_prefix + "CML    ";
					
				case 0740004:
					// OAS instruction
					return isa_prefix + "OAS    ";
					
				case 0740010:
					// RAL instruction
					return isa_prefix + "RAL    ";
					
				case 0740020:
					// RAR instruction
					return isa_prefix + "RAR    ";
					
				case 0740040:
					// HLT instruction
					return isa_prefix + "HLT    ";
					
				case 0740100:
					// SMA instruction
					return isa_prefix + "SMA    ";
					
				case 0740200:
					// SZA instruction
					return isa_prefix + "SZA    ";
					
				case 0740400:
					// SNL instruction
					return isa_prefix + "SNL    ";
					
				case 0741000:
					// SKP instruction
					return isa_prefix + "SKP    ";
					
				case 0741100:
					// SPA instruction
					return isa_prefix + "SPA    ";
					
				case 0741200:
					// SNA instruction
					return isa_prefix + "SNA    ";
					
				case 0741400:
					// SZL instruction
					return isa_prefix + "SZL    ";
					
				case 0742010:
					// RTL instruction
					return isa_prefix + "RTL    ";
					
				case 0742020:
					// RTR instruction
					return isa_prefix + "RTR    ";
					
				case 0744000:
					// CLL instruction
					return isa_prefix + "CLL    ";
					
				case 0744002:
					// STL instruction
					return isa_prefix + "STL    ";
					
				case 0744010:
					// RCL instruction
					return isa_prefix + "RCL    ";
					
				case 0744020:
					// RCR instruction
					return isa_prefix + "RCR    ";
					
				case 0750000:
					// CLA instruction
					return isa_prefix + "CLA    ";
					
				case 0750001:
					// CLC instruction
					return isa_prefix + "CLC    ";
					
				case 0750004:
					// LAS instruction
					return isa_prefix + "LAS    ";
					
				case 0750010:
					// GLK instruction
					return isa_prefix + "GLK    ";
					
				default:
				
					// LAW instruction
					if ((instruction & 0760000) == 0760000) {
						return isa_prefix + "LAW    " + oct18(instruction); 
					}
				
					break;
				
			}
			return isa_prefix + "OPR    ";
	
		default:
			return isa_prefix + "???";
	}
	
}

function put_indir(indir) {
	if (indir) {
		return "I ";
	}
	return "";
}

/*
 * Shortcut to padded octal 18 bit
 */
function oct18(val) {
	return val.toString(8).padStart(6, '0');
}

/*
 * Shortcut to padded octal 15 bit
 */
function oct15(val) {
	return val.toString(8).padStart(5, '0');
}

/*
 * Shortcut to padded octal 6 bit
 */
function oct6(val) {
	return val.toString(8).padStart(2, '0');
}
