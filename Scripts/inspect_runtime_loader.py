import unreal

path = "/Game/JLE/BP_JLE_RuntimeLoader.BP_JLE_RuntimeLoader"
bp = unreal.load_asset(path)
if bp is None:
    raise RuntimeError(f"Could not load {path}")

unreal.log(f"[JLE Inspect] Blueprint: {bp.get_path_name()}")
unreal.log(f"[JLE Inspect] Blueprint attrs: {[name for name in dir(bp) if 'graph' in name.lower()]}")
graphs = []
for property_name in ("ubergraph_pages", "function_graphs", "macro_graphs", "delegate_signature_graphs"):
    try:
        graphs.extend(bp.get_editor_property(property_name) or [])
    except Exception as error:
        unreal.log_warning(f"[JLE Inspect] Cannot read {property_name}: {error}")
for graph in graphs:
    unreal.log(f"[JLE Inspect] Graph: {graph.get_name()}")
    for node in graph.get_nodes():
        unreal.log(
            f"[JLE Inspect] Node: {node.get_class().get_name()} | "
            f"name={node.get_name()} | title={node.get_node_title(unreal.NodeTitleType.FULL_TITLE)}"
        )
        for pin in node.pins:
            default_object = pin.default_object.get_path_name() if pin.default_object else ""
            unreal.log(
                f"[JLE Inspect]   Pin: {pin.get_name()} | default={pin.default_value} | "
                f"object={default_object} | linked={len(pin.linked_to)}"
            )
