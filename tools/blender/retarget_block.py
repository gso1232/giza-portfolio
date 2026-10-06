# (inserted into figure.py: --retarget <their action>)
# ---- their motion on him: the reference's people (mixamo rigs in their scene.glb, the user's download) ----
# Each of his bones turns as its counterpart in theirs turns, frame by frame: their bone's rotation from its
# rest, applied to his bone once his rest has been turned to point the way theirs points at rest (so a
# T-pose and an A-pose agree); his hips go where theirs go. Baked into one clip as long as theirs, which the
# site scrubs with their timeline's share of it.
RETARGET = arg('--retarget', None)
if RETARGET:
    from mathutils import Matrix, Quaternion
    THEIRS = os.path.abspath(arg('--theirs', 'blender/illoca/scene.glb'))
    MAP = {'Hips': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03', 'Neck': 'neck_01', 'Head': 'head'}
    for side, s in (('Left', 'l'), ('Right', 'r')):
        MAP.update({f'{side}Shoulder': f'clavicle_{s}', f'{side}Arm': f'upperarm_{s}', f'{side}ForeArm': f'lowerarm_{s}', f'{side}Hand': f'hand_{s}',
                    f'{side}UpLeg': f'thigh_{s}', f'{side}Leg': f'calf_{s}', f'{side}Foot': f'foot_{s}', f'{side}ToeBase': f'ball_{s}'})
        for f, g in (('Thumb', 'thumb'), ('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Pinky', 'pinky')):
            for k in (1, 2, 3):
                MAP[f'{side}Hand{f}{k}'] = f'{g}_0{k}_{s}'
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=THEIRS)
    theirs = [o for o in bpy.data.objects if o not in before]
    src_name = RETARGET.split('_action')[0]
    src_name = '_'.join(src_name.split('_')[:2])            # human_01 / human_02 / human_03
    src = next(o for o in theirs if o.type == 'ARMATURE' and o.name.startswith(src_name))
    for o in theirs:                                        # only their rig stays
        if o is not src and o.parent is not src:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in [o for o in bpy.data.objects if o.parent is src and o.type == 'MESH']:
        o.hide_render = True
    act = bpy.data.actions[RETARGET]
    src.animation_data_create()
    src.animation_data.action = act
    try:
        src.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    sp = lambda n: src.pose.bones.get('mixamorig:' + n)
    scn = bpy.context.scene
    scn.render.fps = 24
    NF = int(round((act.frame_range[1] - act.frame_range[0]))) + 1
    F0 = int(act.frame_range[0])
    print('their clip', RETARGET, 'frames', F0, '..', F0 + NF - 1)

    # his rig at the origin, turned to face the way theirs faces at rest
    rig.parent = None
    rig.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    def lateral(arm, l, r):
        return (arm.matrix_world @ arm.data.bones[r].head_local) - (arm.matrix_world @ arm.data.bones[l].head_local)
    a_src = lateral(src, 'mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg'); a_src.z = 0
    a_tgt = lateral(rig, 'thigh_l', 'thigh_r'); a_tgt.z = 0
    yaw = a_tgt.to_2d().angle_signed(a_src.to_2d())
    rig.matrix_world = Matrix.Rotation(-yaw, 4, 'Z')
    bpy.context.view_layer.update()
    print('his rest turned by', round(math.degrees(-yaw), 1))

    RW = rig.matrix_world.copy()
    R3 = RW.to_3x3().normalized()
    # rests: world rotations, and the turn that points his rest bone along theirs
    tgt_bones = rig.data.bones
    rest_src, align, rest_tgt_w = {}, {}, {}
    for sname, tname in MAP.items():
        sb = src.data.bones.get('mixamorig:' + sname); tb = tgt_bones.get(tname)
        if not sb or not tb:
            continue
        sw = src.matrix_world @ sb.matrix_local
        tw = RW @ tb.matrix_local
        rest_src[tname] = sw.to_quaternion()
        rest_tgt_w[tname] = tw.to_quaternion()
        ds = (src.matrix_world @ sb.tail_local) - (src.matrix_world @ sb.head_local)
        dt = (RW @ tb.tail_local) - (RW @ tb.head_local)
        align[tname] = dt.normalized().rotation_difference(ds.normalized())
    mapped = {v: k for k, v in MAP.items() if v in rest_src}
    # his bones in the order a parent comes before its children
    order = []
    def walk(b):
        order.append(b)
        for c in b.children:
            walk(c)
    for b in tgt_bones:
        if b.parent is None:
            walk(b)
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    # his hips: theirs, less the height his legs differ by (their hips' rest height over his)
    hs = (src.matrix_world @ src.data.bones['mixamorig:Hips'].head_local).z
    ht = (RW @ tgt_bones['pelvis'].head_local).z
    drop = ht - hs
    print('hips at rest: theirs', round(hs, 3), 'his', round(ht, 3))
    RWi = RW.inverted()
    for fi in range(NF):
        scn.frame_set(F0 + fi)
        M = {}
        for b in order:
            pb = rig.pose.bones[b.name]
            rest = b.matrix_local
            if b.parent:
                base = M[b.parent.name] @ b.parent.matrix_local.inverted() @ rest
            else:
                base = rest.copy()
            if b.name in mapped:
                spb = sp(mapped[b.name])
                cur = (src.matrix_world @ spb.matrix).to_quaternion()
                delta = cur @ rest_src[b.name].inverted()
                want_w = delta @ align[b.name] @ rest_tgt_w[b.name]
                want = (R3.to_quaternion().inverted() @ want_w).to_matrix().to_4x4()
                if b.parent is None:
                    p = src.matrix_world @ spb.matrix.translation
                    want.translation = RWi @ (p + Vector((0, 0, drop * 0.0)))
                else:
                    want.translation = base.translation
                M[b.name] = want
                basis = base.inverted() @ want
            else:
                M[b.name] = base
                basis = Matrix.Identity(4)
            pb.matrix_basis = basis
            pb.keyframe_insert('rotation_quaternion', frame=fi)
            if b.parent is None:
                pb.keyframe_insert('location', frame=fi)
    rig.animation_data.action.name = src_name
    scn.frame_start, scn.frame_end = 0, NF - 1
    print('retargeted', NF, 'frames')
    # their rig goes; his, skinned, is the export
    bpy.data.objects.remove(src, do_unlink=True)
    for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.data.shape_keys]:
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    PREVIEW = arg('--preview', None)
    if PREVIEW:
        scn.render.engine = 'BLENDER_WORKBENCH'
        scn.render.resolution_x, scn.render.resolution_y = 640, 480
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam)
        cam.data.lens = 35; scn.camera = cam
        for f in (0, NF // 4, NF // 2, 3 * NF // 4):
            scn.frame_set(f)
            pel = rig.matrix_world @ rig.pose.bones['pelvis'].head
            cam.location = pel + Vector((1.6, -1.6, 0.6))
            cam.rotation_mode = 'QUATERNION'
            cam.rotation_quaternion = (pel + Vector((0, 0, 0.2)) - cam.location).to_track_quat('-Z', 'Y')
            scn.render.filepath = f'{PREVIEW}-{f}.png'
            bpy.ops.render.render(write_still=True)
        sys.exit(0)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_materials='EXPORT',
                              export_yup=True, export_skins=True, export_animations=True, export_animation_mode='ACTIONS',
                              export_force_sampling=True, export_morph=False)
    print('wrote', OUT, NF, 'frames')
    sys.exit(0)

