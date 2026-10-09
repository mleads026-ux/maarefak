#!/usr/bin/env python3
"""Validate generated GLB characters and their customization metadata.

Only uses Python standard library, so it runs on GitHub Actions without bpy.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys

EXPECTED = {
    "scout": {"skin_tone": "tan", "hair_style": "spiky",
              "hair_color": "brown", "body_build": "athletic", "height": 1.0},
    "guardian": {"skin_tone": "dark", "hair_style": "short",
                 "hair_color": "black", "body_build": "regular", "height": 1.08},
    "mage": {"skin_tone": "light", "hair_style": "long",
             "hair_color": "red", "body_build": "slim", "height": 0.94},
}


def validate_one(name, expected):
    path = Path("artifacts") / (name + ".glb")
    manifest_path = path.with_suffix(".json")
    if not path.is_file() or not manifest_path.is_file():
        raise AssertionError("Missing GLB or manifest for " + name)
    data = path.read_bytes()
    assert len(data) > 1024, name + " GLB file unexpectedly small"
    assert data[:4] == b"glTF", name + " missing GLB magic"
    version, declared_size = struct.unpack_from("<II", data, 4)
    assert version == 2 and declared_size == len(data)
    json_size, json_type = struct.unpack_from("<II", data, 12)
    assert json_type == 0x4E4F534A
    doc = json.loads(data[20:20+json_size].decode("utf-8"))
    assert doc["asset"]["version"] == "2.0"
    meshes = doc.get("meshes", [])
    materials = doc.get("materials", [])
    assert len(meshes) >= 25, (name, len(meshes))
    assert len(materials) >= 7, (name, len(materials))
    names = {m.get("name") for m in meshes}
    assert "Face.Head" in names, name + " missing head"
    assert any(n and n.startswith("Body.") for n in names)
    assert any(n and n.startswith("Hair.") for n in names)
    assert any(n and n.startswith("Outfit.") for n in names)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["character"]["preset"] == name
    for k, v in expected.items():
        assert manifest["character"][k] == v, (name, k)
    assert manifest["bytes"] == len(data)
    assert manifest["meshes"] == len(meshes)
    assert manifest["materials"] == len(materials)
    assert manifest["animated"] is False and manifest["rigged"] is False
    digest = hashlib.sha256(data).hexdigest()
    print("VALID_CARTOON_GLB name=%s meshes=%d materials=%d bytes=%d sha256=%s" %
          (name, len(meshes), len(materials), len(data), digest), flush=True)
    return digest


def main():
    digests = [validate_one(n, config) for n, config in EXPECTED.items()]
    assert len(set(digests)) == len(digests), "Character variants are identical"
    print("ALL_CARTOON_CHARACTERS_PASSED: 3 different customized GLBs", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("CHARACTER_VERIFICATION_FAILED: " + repr(exc), file=sys.stderr)
        raise
