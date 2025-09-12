# RDP-9

## Project Description

This project aims to build an ISA-compatible clone of the DEC PDP-9 system using primarily technology from the late 1970s - early 1980s period. I did this to ensure my design followed the same constraints that later genuine minicomputer systems were built with, while being able to significantly reduce the size and complexity compared to an actual PDP-9. The specifics are as follows

- Use only 74-series logic and other similar TTL logic level parts that would be available around the later 1970s timeframe. The exception to this is RAM, which I plan to use more “modern” SRAM chips instead of torturing myself with dynamic RAM.
- No FPGAs, PALs, GALs, microcontrollers, etc in the main processor path. The only exception to this is using standard 27C style ROM chips to hold the microcode.
- Usage of a period correct microcontroller or microprocessor for the PPT / disk / drum / tape subsystem. Using another simpler processor to control complex devices like disks was done frequently on other minicomputer designs, so I’ll be doing it here too.

My end goal is to build a system that is capable of running most of the interesting software of the period. This includes ADSS, DOS-15, and UNIX V0. To do this, the system will need:

- Full compatibility with the PDP-9 instruction set. This includes EAE instructions and extended memory
- The ability to hook up to a real or emulated paper tape punch / reader.
- The ability to hook up to a real or emulated ASR-33 teletype or similar serial terminal
- Floppy drive and IDE hard drive support using the DECtape and RB09 interface respectively

## Theory of Operation

Due to the complexity involved with the architecture of the DEC PDP-9, the system is split into two subsystems:

The first subsystem is the processor itself. It has a full 18-bit datapath with 15-bit address bus, and is implemented entirely using TTL logic.

The second subsystem is the I/O coprocessor. This is a Zilog Z80 based system which is controlled by the RDP-9 CPU using IOT instructions. It is also responsible
CPU state keeping (extended mode, interrupts, etc...). The primary processor is capable of running without the I/O coprocessor using the front panel only, but
the usage of external devices requires that the I/O coprocessor hardware be installed. This is done because the way the 18-bit DEC machines did I/O is rather esoteric
and does not map well to interfacing with more "modern" hardware. By offloading the translation of I/O responibilities to a simpler system, much of the complexity of an
already very complicated homebrew computing project is avoided. It should be noted that this approach is not uncommon for similar legacy minicomputer products created in the
late 70s and early 80s.

