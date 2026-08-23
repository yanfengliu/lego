export function option(argv, name, fallback = null) {
  const flag = `--${name}`;
  const positions = argv.flatMap((value, index) => (value === flag ? [index] : []));
  if (positions.length === 0) return fallback;
  if (positions.length > 1) {
    throw new Error(`${flag} may be provided only once; received ${positions.length} occurrences.`);
  }
  const at = positions[0];
  if (at === argv.length - 1 || argv[at + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value; received no value.`);
  }
  return argv[at + 1];
}
