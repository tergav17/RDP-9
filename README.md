# RDP-9

## Project Description

This project aims to build an ISA-compatible clone of the DEC PDP-9 system using primarily technology from the late 1970s - early 1980s period. I did this to ensure my design followed the same constraints that later genuine minicomputer systems were built with, while being able to significantly reduce the size and complexity compared to an actual PDP-9. The specifics are as follows

- Use only 74-series logic and other similar TTL logic level parts that would be available around the later 1970s timeframe. The exception to this is RAM, which I plan to use more “modern” SRAM chips instead of torturing myself with dynamic RAM.
- No FPGAs, PALs, GALs, microcontrollers, etc in the main processor path. The only exception to this is using standard 27C style ROM chips to hold the microcode.
- Usage of a period correct microcontroller or microprocessor for the PPT / disk / drum / tape subsystem. Using another simpler processor to control complex devices like disks was done frequently on other minicomputer designs, so I’ll be doing it here too.

My end goal is to build a system that is capable of running most of the interesting software of the period. This includes DECsys, ADSS, DOS-15, and UNIX V0. To do this, the system will need:

- Full compatibility with the PDP-9 instruction set. This includes EAE instructions and extended memory
- The ability to hook up to a real or emulated paper tape punch / reader.
- The ability to hook up to a real or emulated ASR-33 teletype or similar serial terminal
- 8" floppy drive interface in place of DECtape. Software will require patching but it's better than trying to emulate DECtape
- IDE hard drive support using RB09/RF09 interface 

## Theory of Operation

Due to the complexity involved with the architecture of the DEC PDP-9, the system is split into two subsystems:

The first subsystem is the processor itself. It has a full 18-bit datapath with 15-bit address bus, and is implemented entirely using TTL logic.

The second subsystem is the I/O bus. This is directly controlled by the processor itself and is capable of servicing the following operations:

- Device interrupts
- IOT transactions
- Add-to-memory operations
- Data channel transfers
- DMA transfers


### Device Interrupts

Device interrupts simply tell the processor to begin an interrupt operation. When an interrupt is accepted, the I/O bus will be notified of the action
and is responsible for turning off the "Program Interrupt" flag. If this does not happen, interrupts will continuously loop. 

### IOT Transactions

IOT transactions allow data to be transferred to or from the accumulator. IOTs also allow for skips to be requested. Every IOT is treated by the CPU
as a Read-Modify-Write operation. By using the "EXTRN" signal, devices can notify the processor to read from the I/O bus instead of the writeback register.
When the I/O bus is being sampled, the "IOT_SKIP" signal can be asserted to tell the processor to perform an addition increment of the program counter.

A wait signal is sampled at the beginning of the IOT as well. This can be used to add cycles to the writeback phase of the IOT if the device needs it.

#### Steps:

1. IOT transaction begins. Device address is placed on the I/O address bus. No IOT signals are asserted

2. AC (or 0 if the flag is set) is written to the WRTBK register.

3. Signal "IOT_PULSE" is asserted.

4. Signal "IOT_PULSE" remains asserted. External input is sampled into MB. Signal "EXTRN" must be asserted to take value from device bus.

5. IF "IOT_WAIT" is asserted, do step 4 in place. No IOT signals are asserted. Interally, the CPU is performing the logical OR and writeback of potential provided data.

6. No IOT signals are asserted. Internally, the CPU will perform the skip here if it has been requested. The next fetch cycle will ignore interrupts and device requests.

### Device Requests

The final three transaction types (Add-to-memory, data-channels, and DMA transfers all share the "device request" pathway.

#### Steps:

1. Signal "REQ_ADDR_PHASE" and "DEV_REQ_PULSE" asserted and held. External value written to MA. If DMA is selected, skip to step 7

2. Core is read at MA and written to MB. "REQ_ADDR_PHASE" held

3. Value in MB incremented and written back to core at MA and OB. "REQ_ADDR_PHASE" held

4. Value in MA incremented. "REQ_ADDR_PHASE" reset. "INCREMENT_ZERO" can be sampled here. If add to memory selected, skip to step 9

5. Core is read at MA and written to MB

6. Value in MB incremented and written back to core at MA and MA

7. Core is read at MA and written to WRTBK

8. External value written to core at MA. "DEV_REQ_PULSE" reset. Jump to fetch without device request logi 

9. Reset "DEV_REQ_PULSE". Jump to fetch without device request logi 