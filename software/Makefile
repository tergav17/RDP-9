all: ppt/ext_memory_test.bin

ppt/%.bin: source/%.s
	macro7 $<
	mv source/*.lst ppt/listing
	mv source/*.rim source/$*.bin
	mv source/*.bin ppt