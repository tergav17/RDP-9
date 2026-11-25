        .TITLE .DKSBT
/COPYRIGHT 1970, DIGITAL EQUIPMENT CORP., MAYNARD, MASS.
/5-29-70        EDIT #1 MODIFIED FOR KM V5A
/M. SIFNAS 6-21-68
/PDP-9 ADVANCED SOFTWARE DISK BOOTSTRAP
/SPECIAL VERSION TO CONVERT DECTAPE
/UNITS 0-2 AND 4-6 TO TRACK AND SECTOR ADDRESSES
/DTA0 = TK0, SECT. 0 (SIDE 1)
/DTA1 = TK30, SECT. 0 (SIDE 1)
/DTA2 = TK60, SECT. 0 (SIDE 1)
/DTA3 IS MAPPED INTO DTA1
/DTA4 = TK0, SECT 0 (SIDE 2)
/DTA5 = TK30, SECT 0 (SIDE 2)
/DTA6 = TK60, SECT 0 (SIDE 2)
/DTA7 IS MAPPED INTO DTA5
/
/IF ENTERED VIA .DTBEG OR .DTOUT, 5 CELLS MUST BE SET:
        /.DTBLK = LOGICAL DISK BL# (0-1077) WHERE 1 BL. = 256 WDS
        /.DTCA = CORE ADDRESS -1
        /.DTWC = -WC (2'S COMP) TO BE TRANSFERED
        /.SCOM+5 = START ADDR. WHEN LOAD COMPLETE
        /.DTSRC = UNIT #(0-2)
/
.SCOM=100
DSLW=707124
DSLM=707142
DSLD=707104
DSCS=707141
DSLS=707144
DSSF=707121
DSRS=707132
EEM=707702
/
        .EJECT
        .FULL
        .LOC 17637
/
/NON RESIDENT CELLS
/
.DTBLK  0               /LOGICAL BL# (0-3777)
.DTCA   0               /CORE ADDR -1
.DTWC   0               /2'S COMP WC
OCTN    0               /TEMP.
HOD     0               /TEMP
.DTSRC  0               /VESTGIAL REG. (FROM DTA BOOTSTRAP)
.DTTR   0               /READ OR WRITE STATUS BITS
/
/RESIDENT DISK BOOTSTRAP
/FOR KM-9 LOAD, START AT .BOOT
/
.BOOT   LAC .L077       /START TRANSFER AT LOC 100
        DAC .DTCA
        LAW 1000                /WC = 17000
        DAC .DTWC
        DZM .DTBLK      /LOGICAL BL 0 = TRACK 0, SECOTR 0
        DZM .DTSRC      /UNIT 0
        JMP .DTBEG
.L3000  30000
.L002   2000
.L003   3000
.LM24   777754
.L24    24
.L1     1
/
/FOR NON-KM9 LOAD, START AT .DTBEG
.DTBEG  LAC .L002               /(2000 = READ, GO
        SKP!STL         /SET LINK FOR DISK SIDE INIT
/FOR OUTPUT, START AT .DTOUT
.DTOUT  LAC .L003               /(3000 = WRITE, GO
        DAC .DTTR
        STL
        EEM+10          /ENTER EXT. MEM. + CLEAR AC
        RTR             /AC = 0, L = 1
        DAC .DUNIT              /200000
        LAC .DTSRC              /UNIT 3 MAPPED INTO 1,7 INTO 5
        SMA!RTL         /UNIT 4-6
        DZM .DUNIT      /UNIT 0-2
        SNL!RAL         /UNIT 2 OR 6
        SZL!CLA!STL     /UNIT 0 OR 4
        LAC .L3000      /2,6
        SNL             /0,4
        TAD .L3000      /1,5
        JMP .+3
/
        .EJECT
.DSTOP  HLT             /ERR. HLT
        JMP .BOOT               /RESTART
        TAD .DUNIT
        DAC .DUNIT
        LAC .DTWC
        DSLW            /LOAD WC
        LAC .DTCA
        TAD .L1         /LOAD CA
        DSLM
/
/DAVE LENEY 2-17-67
/DISK TRACK AND SECTOR ENCODER
/CONVERTS LOGICAL BLOCK # (OCTAL)
/FROM 0-3777 TO BCD TRACK AND SECTOR ADDRESS
/WHERE 1 BLOCK = 256 WDS OR 4 DISK SECTORS
/
        LAC .DTBLK      /LOGICAL BL#
        DZM TRACK               /COMPUTE BCD TRACK AND SECTOR ADDR.
FINDT   TAD .LM24               /-20 (20 256 WD BLOCK PER TRACK)
        SPA!STL
        JMP FINDS               /TRACK FOUND
        ISZ TRACK
        JMP FINDT               /STILL LOOKING
FINDS   TAD .L24                /20 (GO BACK 1)
        RTL
        JMS .TOBCD      /CONVERT SECTOR TO BCD
        DAC SECTOR      /TEMP
        LAC TRACK
        JMS .TOBCD      /CONVERT TRACK TO BCD
        RTL
        RTL
        RTL
        RTL
        XOR SECTOR
        TAD .DUNIT
        DSLD            /LOAD SECTOR AND TRACK ADDR.
        LAC .DTTR               /LOAD STATUD (READ OR WRITE)
        DSCS!DSLS
        DSSF!DSRS               /SKIP ON FLAGS AND READ STATUS
        JMP .-1
        SPA
        JMP .DSTOP      /ERROR FLAG UP
        LAC* .L105      /DONE EXIT THROUGH BANK0, 105
        DAC .TOBCD
        CAF
        JMS* .TOBCD
/
        .EJECT
/DAVE LENEY 2-17-67
/ROUTINE TO CONVERT OCTAL NUMBER IN
/AC TO A BCD NUMBER IN AC
/OCTAL NUMBER MUST BE LESS THAN 144
/CALLING SEQUENCE
/       JMS .TOBCD
/       (RETURN)
/
.TOBCD  0
/STRAIGHTENED OUT BY C. PROTEAU
        DZM HOD         /HIGH ORDER DIGIT
        SKP
NXT     ISZ HOD
        DAC OCTN                /REMAINDER (+)
        TAD .LM12       /(-12
        SMA!CLL
        JMP NXT
        LAC HOD         /COMBINE DIGITS
        RTL             /4 TIMES
        RTL
        XOR OCTN
        JMP* .TOBCD             /EXIT
TRACK   0               /TEMP
SECTOR  0               /TEMP
.DUNIT  0               /LOGICAL BLK # (0-3777)
.L077   77              /KM-9 CA-1
.LM12   -12
        0
        0
.L105   105
        .END .BOOT
