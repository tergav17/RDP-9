all: ppt/ext_memory_test.bin ppt/dksbt.bin

ppt/%.bin: source/%.s
	macro7 $<
	python3 macro7/generate_hri.py source/$*.lst
	mv source/*.lst ppt/listing
	mv source/*.rim source/$*.bin
	mv source/*.bin ppt
