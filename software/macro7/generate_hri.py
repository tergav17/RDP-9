import sys


def main():

    # Check args
    if len(sys.argv) != 2:
        print("usage: generate_hri.py input.lst")
        return

    input_file = sys.argv[1]
    output_file = input_file[:-4] + "_hri.bin"

    binary = []
    with open(input_file, "r", encoding="utf-8") as f:
        for line in f:

            # Check if line is too short
            if len(line) < 16:
                continue

            # Check if line actually has a line #
            if not line[4].isnumeric():
                continue

            # Check if there is an address here
            if not line[10].isnumeric():
                continue

            # Output to binary
            word = int(line[12:18], 8)
            binary.append(((word >> 12) & 0o77) | 0b10000000)
            binary.append(((word >> 6) & 0o77) | 0b10000000)
            binary.append(((word) & 0o77) | 0b10000000)

    # Add ending marker
    binary[-1] = binary[-1] | 0b01000000

    data = bytearray(binary)

    with open(output_file, "wb") as f:
        f.write(data)


if __name__ == "__main__":
    main()
