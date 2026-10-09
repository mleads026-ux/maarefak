#!/usr/bin/env python3
"""Generate customizable low-poly/stylized humanoid characters as glTF 2.0 GLB.

Run with Blender 3.x:
  blender --background --factory-startup --python-exit-code 1 \
    --python tools/blender/generate_character.py -- \
    --preset scout --skin-tone tan --hair-style spiky \
    --body-build athletic --height 1.0 --output artifacts/scout.glb

Requires Blender and its standard glTF exporter; no GPU, RunPod or AI service.
These are static game props, not rigged/animated avatars yet.
"""
import argparse
import json
import math
import os
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


PALETTES = {
    "scout": {
        "shirt": (0.09, 0.51, 0.45),
        "accent": (0.97, 0.69, 0.23),
        "pants": (0.17, 0.22, 0.33),
        "boots": (0.20, 0.13, 0.11),
    },
    "guardian": {
        "shirt": (0.20, 0.34, 0.68),
        "accent": (0.96, 0.73, 0.28),
        "pants": (0.22, 0.27, 0.41),
        "boots": (0.14, 0.15, 0.24),
    },
    "mage": {
        "shirt": (0.40, 0.20, 0.63),
        "accent": (0.36, 0.82, 0.89),
        "pants": (0.19, 0.14, 0.34),
        "boots": (0.13, 0.09, 0.19),
    },
}
SKIN_TONES = {
    "light": (0.92, 0.67, 0.49),
    "tan": (0.70, 0.41, 0.27),
    "dark": (0.35, 0.19, 0.13),
}
HAIR_COLORS = {
    "black": (0.045, 0.045, 0.06),
    "brown": (0.19, 0.09, 0.052),
    "blonde": (0.75, 0.54, 0.21),
    "red": (0.55, 0.16, 0.09),
}
BUILD_SCALES = {"slim": 0.86, "regular": 1.0, "athletic": 1.17}


def make_material(name, color, metallic=0.0, roughness=0.8):
    mat = bpy.data.materials.new(name=name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def sphere(name, location, scale, mat, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, location=location
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def link(name, start, end, radius, mat, vertices=12):
    direction = Vector(end) - Vector(start)
    middle = (Vector(start) + Vector(end)) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=direction.length,
        location=middle
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def box(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Soft game edges", "BEVEL")
    bevel.width = 0.045
    bevel.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj


def face(skin, dark_eyes, white, smile, hair, style):
    sphere("Face.Head", (0, 0, 2.21), (0.29, 0.255, 0.315), skin, 24, 14)
    for side in (-1, 1):
        s = "L" if side < 0 else "R"
        sphere("Face.EyeWhite." + s, (side * 0.113, -0.234, 2.245),
               (0.069, 0.045, 0.076), white)
        sphere("Face.Pupil." + s, (side * 0.113, -0.275, 2.248),
               (0.031, 0.026, 0.045), dark_eyes)
        sphere("Face.Eyebrow." + s, (side * 0.115, -0.255, 2.36),
               (0.075, 0.018, 0.018), hair, 12, 8)
        sphere("Face.Ear." + s, (side * 0.286, 0, 2.19),
               (0.06, 0.075, 0.105), skin, 12, 8)
    sphere("Face.Nose", (0, -0.273, 2.17), (0.047, 0.045, 0.056), skin)
    for i in range(6):
        x1 = (i - 3) * 0.035
        x2 = (i - 2) * 0.035
        z1 = 2.095 - 0.025 * (1 - (x1 / 0.15) ** 2)
        z2 = 2.095 - 0.025 * (1 - (x2 / 0.15) ** 2)
        link("Face.Smile.%d" % i, (x1, -0.265, z1),
             (x2, -0.265, z2), 0.009, smile, 8)
    sphere("Hair.Cap", (0, 0.045, 2.445), (0.30, 0.256, 0.135), hair)
    if style == "spiky":
        for i, (x, y, height) in enumerate([
            (-0.19, -0.065, 0.16), (-0.08, -0.085, 0.22),
            (0.06, -0.08, 0.20), (0.18, -0.03, 0.14)
        ]):
            sphere("Hair.Spike.%d" % i, (x, y, 2.52 + height * 0.28),
                   (0.085, 0.10, height), hair, 12, 8)
    elif style == "long":
        for side in (-1, 1):
            sphere("Hair.Side.%s" % side, (side * 0.24, 0.085, 2.17),
                   (0.10, 0.17, 0.32), hair)
        sphere("Hair.Back", (0, 0.19, 2.23), (0.22, 0.08, 0.35), hair)
    else:  # short
        for i in range(5):
            sphere("Hair.Fringe.%d" % i, ((i - 2) * 0.10, -0.148, 2.45),
                   (0.075, 0.095, 0.07), hair, 12, 8)


def build_character(args):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    p = PALETTES[args.preset]
    bulk = BUILD_SCALES[args.body_build]

    skin = make_material("Skin." + args.skin_tone, SKIN_TONES[args.skin_tone])
    shirt = make_material("Outfit." + args.preset, p["shirt"])
    accent = make_material("Outfit.Accent", p["accent"], metallic=0.2)
    pants = make_material("Pants", p["pants"])
    boots = make_material("Boots", p["boots"])
    hair = make_material("Hair." + args.hair_color, HAIR_COLORS[args.hair_color])
    white = make_material("Eyes.White", (0.98, 0.98, 0.94))
    eyes = make_material("Eyes.Pupils", (0.035, 0.04, 0.06))
    smile = make_material("Face.Smile", (0.24, 0.095, 0.09))

    sphere("Body.Chest", (0, 0, 1.51), (0.385 * bulk, 0.24, 0.45), shirt)
    sphere("Body.Belly", (0, 0, 1.16), (0.335 * bulk, 0.235, 0.27), shirt)
    sphere("Body.Hips", (0, 0, 0.99), (0.315 * bulk, 0.22, 0.15), pants)
    link("Outfit.Belt", (-0.325 * bulk, -0.04, 1.015),
         (0.325 * bulk, -0.04, 1.015), 0.055, boots)
    box("Outfit.Buckle", (0, -0.253, 1.017), (0.13, 0.05, 0.095), accent)
    link("Body.Neck", (0, 0, 1.88), (0, 0, 2.0), 0.098, skin)
    face(skin, eyes, white, smile, hair, args.hair_style)

    for side in (-1, 1):
        s = "L" if side < 0 else "R"
        shoulder_x = side * 0.39 * bulk
        elbow_x = side * 0.62 * bulk
        wrist_x = side * 0.71 * bulk
        sphere("Body.Shoulder." + s, (shoulder_x, 0, 1.78),
               (0.18, 0.20, 0.18), shirt)
        link("Body.UpperArm." + s, (shoulder_x, 0, 1.77),
             (elbow_x, 0, 1.47), 0.124, shirt)
        sphere("Body.Elbow." + s, (elbow_x, 0, 1.47),
               (0.115, 0.117, 0.11), skin)
        link("Body.Forearm." + s, (elbow_x, 0, 1.47),
             (wrist_x, -0.04, 1.13), 0.094, skin)
        sphere("Body.Hand." + s, (wrist_x, -0.04, 1.055),
               (0.105, 0.085, 0.135), skin)
        sphere("Body.Thigh." + s, (side * 0.165 * bulk, 0, 0.77),
               (0.175 * bulk, 0.17, 0.32), pants)
        link("Body.Shin." + s, (side * 0.17 * bulk, 0, 0.63),
             (side * 0.19 * bulk, 0, 0.25), 0.135 * bulk, pants)
        sphere("Outfit.Boot." + s, (side * 0.19 * bulk, -0.11, 0.15),
               (0.16 * bulk, 0.27, 0.145), boots)

        if args.preset == "guardian":
            sphere("Outfit.ShoulderArmor." + s, (shoulder_x, 0, 1.85),
                   (0.215, 0.23, 0.13), accent)
        elif args.preset == "mage":
            link("Outfit.SleeveTrim." + s, (elbow_x, 0, 1.48),
                 (elbow_x + side * 0.03, 0, 1.40), 0.135, accent)
        else:
            box("Outfit.Cuff." + s, (wrist_x, 0, 1.20),
                (0.20, 0.19, 0.09), accent)

    if args.preset == "scout":
        box("Outfit.Backpack", (0, 0.275, 1.47),
            (0.48 * bulk, 0.21, 0.61), boots)
        box("Outfit.BackpackFlap", (0, 0.39, 1.66),
            (0.43 * bulk, 0.055, 0.15), accent)
    elif args.preset == "guardian":
        box("Outfit.ChestEmblem", (0, -0.24, 1.60),
            (0.16, 0.062, 0.19), accent)
    else:
        sphere("Outfit.MageGem", (0, -0.24, 1.68),
               (0.105, 0.055, 0.145), accent)

    # One named hierarchy node for clean glTF importing.
    root = bpy.data.objects.new("Character." + args.preset, None)
    bpy.context.collection.objects.link(root)
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for obj in objects:
        obj.parent = root
    root.scale = (args.height, args.height, args.height)
    root["preset"] = args.preset
    root["skin_tone"] = args.skin_tone
    root["hair_style"] = args.hair_style
    root["hair_color"] = args.hair_color
    root["body_build"] = args.body_build
    root["height_scale"] = args.height
    return objects


def validate_glb(path):
    data = Path(path).read_bytes()
    if len(data) < 1024 or data[:4] != b"glTF":
        raise RuntimeError("GLB header missing")
    version, length = struct.unpack_from("<II", data, 4)
    if version != 2 or length != len(data):
        raise RuntimeError("GLB version or length invalid")
    json_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise RuntimeError("Missing GLB JSON chunk")
    gltf = json.loads(data[20:20 + json_length].decode("utf-8"))
    meshes = gltf.get("meshes", [])
    materials = gltf.get("materials", [])
    if len(meshes) < 25 or len(materials) < 7:
        raise RuntimeError("Incomplete GLB: %d meshes, %d materials" %
                           (len(meshes), len(materials)))
    return len(meshes), len(materials), len(data)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Create a stylized 3D game avatar")
    parser.add_argument("--output", default="artifacts/scout.glb")
    parser.add_argument("--preset", choices=PALETTES, default="scout")
    parser.add_argument("--skin-tone", choices=SKIN_TONES, default="tan")
    parser.add_argument("--hair-style", choices=["short", "spiky", "long"],
                        default="spiky")
    parser.add_argument("--hair-color", choices=HAIR_COLORS, default="brown")
    parser.add_argument("--body-build", choices=BUILD_SCALES, default="regular")
    parser.add_argument("--height", type=float, default=1.0)
    args = parser.parse_args(argv)
    if not 0.75 <= args.height <= 1.25:
        parser.error("--height must be between 0.75 and 1.25")
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    objects = build_character(args)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    # Export hierarchy with its root, including materials and color data.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB",
                              export_apply=True)
    mesh_count, material_count, size = validate_glb(output)
    manifest = {
        "format": "glTF 2.0 GLB",
        "character": {
            "preset": args.preset,
            "skin_tone": args.skin_tone,
            "hair_style": args.hair_style,
            "hair_color": args.hair_color,
            "body_build": args.body_build,
            "height": args.height,
        },
        "meshes": mesh_count,
        "materials": material_count,
        "bytes": size,
        "rigged": False,
        "animated": False,
    }
    output.with_suffix(".json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8")
    print("CARTOON_CHARACTER_OK " + json.dumps(manifest), flush=True)


if __name__ == "__main__":
    main()
