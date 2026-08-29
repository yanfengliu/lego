export function parseJsonRejectingDuplicateKeys(text, label = "JSON") {
  const duplicates = collectDuplicateKeys(text);
  if (duplicates.length > 0) {
    const detail = duplicates.map(({ key, id }) => `${id ?? "<unnamed object>"}.${key}`);
    throw new Error(
      `${label} declares ${duplicates.length} duplicate key(s): ${detail.join(", ")}. ` +
        `JSON.parse keeps the last value, so an earlier field was silently overwritten - usually a ` +
        `record that lost its opening brace and merged into the one above it. Restore the object ` +
        `boundary; do not delete the duplicated keys.`,
    );
  }
  return JSON.parse(text);
}

export function parseBomJsonRejectingDuplicateKeys(text) {
  return parseJsonRejectingDuplicateKeys(text, "the BOM data block");
}

function collectDuplicateKeys(text) {
  const duplicates = [];
  const stack = [];
  let current = null;
  const readString = (start) => {
    let index = start + 1;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === '"') {
        const end = index + 1;
        try {
          return { end, value: JSON.parse(text.slice(start, end)) };
        } catch {
          return { end, value: undefined };
        }
      }
      index += 1;
    }
    return { end: text.length, value: undefined };
  };
  let index = 0;
  while (index < text.length) {
    const token = text[index];
    if (token === '"') {
      const parsed = readString(index);
      let after = parsed.end;
      while (/\s/u.test(text[after] ?? "")) after += 1;
      if (text[after] === ":" && current?.kind === "object" && parsed.value !== undefined) {
        const key = parsed.value;
        if (current.keys.has(key)) duplicates.push({ key, id: current.id });
        current.keys.add(key);
        if (key === "id") {
          let valueStart = after + 1;
          while (/\s/u.test(text[valueStart] ?? "")) valueStart += 1;
          if (text[valueStart] === '"') current.id = readString(valueStart).value ?? null;
        }
      }
      index = parsed.end;
      continue;
    }
    if (token === "{") {
      stack.push(current);
      current = { kind: "object", keys: new Set(), id: null };
      index += 1;
      continue;
    }
    if (token === "[") {
      stack.push(current);
      current = { kind: "array" };
      index += 1;
      continue;
    }
    if (token === "}" || token === "]") {
      current = stack.pop() ?? null;
      index += 1;
      continue;
    }
    index += 1;
  }
  return duplicates;
}
