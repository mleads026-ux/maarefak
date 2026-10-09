#!/usr/bin/env python3
"""Create a simple game-ready GLB mannequin, using Blender's Python API.
Usage: blender --background --factory-startup --python tools/blender/generate_character.py -- --output artifacts/demo_character.glb
No GPU, AI subscription or external model required.
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

def material(name, color, metallic=0, roughness=0.75):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m

def uv_sphere(name, loc, scale, mat, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj

def limb(name, start, end, radius, mat, vertices=12):
    start, end = Vector(start), Vector(end)
    direction = end - start
    midpoint = (start + end) / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj

def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    skin = material('Skin', (0.68, 0.39, 0.25))
    shirt = material('Shirt Blue', (0.11, 0.28, 0.72))
    trousers = material('Trousers Navy', (0.09, 0.13, 0.27))
    shoes = material('Shoes', (0.07, 0.08, 0.10))
    hair = material('Hair', (0.08, 0.045, 0.03))
    eyes = material('Eyes', (0.02, 0.025, 0.04))
    uv_sphere('Torso', (0, 0, 1.48), (.39, .22, .52), shirt)
    uv_sphere('Hips', (0, 0, 1.00), (.32, .21, .19), trousers)
    limb('Neck', (0, 0, 1.89), (0, 0, 2.03), .095, skin)
    uv_sphere('Head', (0, 0, 2.20), (.24, .22, .28), skin)
    uv_sphere('HairCap', (0, 0.02, 2.40), (.245, .22, .115), hair)
    for side in (-1, 1):
        s = str(side)
        limb('UpperArm'+s, (side*.39, 0, 1.81), (side*.62, 0, 1.46), .12, shirt)
        limb('Forearm'+s, (side*.62, 0, 1.46), (side*.69, -.02, 1.08), .092, skin)
        uv_sphere('Hand'+s, (side*.69, -.02, 1.00), (.105, .09, .14), skin)
        limb('Leg'+s, (side*.16, 0, .92), (side*.19, 0, .34), .17, trousers)
        uv_sphere('Foot'+s, (side*.19, -.13, .135), (.17, .30, .12), shoes)
        uv_sphere('Eye'+s, (side*.093, -.198, 2.24), (.035, .023, .037), eyes, 12, 8)
    # Export only character geometry; no cameras, lights or external dependencies.
    bpy.ops.object.select_all(action='SELECT')
    return len(bpy.context.selected_objects)

def main():
    args_in = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--output', default='artifacts/demo_character.glb')
    args = p.parse_args(args_in)
    out = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    count = build()
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
    if not os.path.isfile(out) or os.path.getsize(out) < 1024:
        raise RuntimeError('GLB export failed')
    print(f'BLENDER_CHARACTER_OK objects={count} output={out} bytes={os.path.getsize(out)}')

if __name__ == '__main__':
    main()
