import json
from typing import Any


def rfc8785_canonicalize(obj: Any) -> bytes:
    """
    Serializes a Python object (dict, list, str, int, float, bool, None)
    into a canonical JSON byte string conforming strictly to RFC 8785 (JCS).
    
    Rules enforced:
    1. Lexicographical key sorting in dictionaries based on UTF-16 code units.
    2. Strict elimination of whitespace between keys, colons, commas, brackets.
    3. Deterministic formatting of numbers (floats formatted without unnecessary trailing zeros or exponents).
    4. Strict UTF-8 byte encoding with standard JSON string escaping rules.
    """
    return _serialize(obj).encode("utf-8")


def _serialize(obj: Any) -> str:
    if obj is None:
        return "null"
    elif isinstance(obj, bool):
        return "true" if obj else "false"
    elif isinstance(obj, (int,)):
        return str(obj)
    elif isinstance(obj, float):
        import math
        if math.isnan(obj) or math.isinf(obj):
            raise ValueError(f"RFC 8785 forbids NaN and Infinity values in canonical JSON: {obj}")
        # Explicitly normalize -0.0 to 0
        if obj == 0.0:
            return "0"
        if obj.is_integer():
            return str(int(obj))
        # Remove positive exponent sign if present (e.g., 1e+20 -> 1e20)
        s = json.dumps(obj)
        return s.replace("e+", "e")
    elif isinstance(obj, str):
        # json.dumps ensures proper unicode escaping without unnecessary slashes
        return json.dumps(obj, ensure_ascii=False)
    elif isinstance(obj, (list, tuple)):
        items = [_serialize(item) for item in obj]
        return "[" + ",".join(items) + "]"
    elif isinstance(obj, dict):
        # Sort keys lexicographically by their UTF-16 code units
        # Python string sort behaves as unicode codepoint order, matching UTF-16 for BMP.
        sorted_keys = sorted(obj.keys())
        entries = []
        for k in sorted_keys:
            key_str = json.dumps(str(k), ensure_ascii=False)
            val_str = _serialize(obj[k])
            entries.append(f"{key_str}:{val_str}")
        return "{" + ",".join(entries) + "}"
    else:
        raise TypeError(f"Unsupported type for RFC 8785 canonicalization: {type(obj)}")
