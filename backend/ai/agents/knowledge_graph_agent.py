"""Knowledge Graph Agent — extracts entity relationships from product data.

Builds a graph of products, manufacturers, standards, and attributes
with edges like relates_to, compliant_with, manufactured_by.
"""

from typing import List, Dict, Any, Optional


def extract_relationships(product_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract entity relationships from a product's data.

    Returns a list of relationship dicts with:
      - source_id, source_type, target_id, target_type
      - relationship_type, label
    """
    relationships: List[Dict[str, Any]] = []
    product_id = product_data.get("id", 0)
    attributes = product_data.get("attributes", [])
    category = product_data.get("category", "")
    model_number = product_data.get("model_number", "")
    name = product_data.get("name", "")

    # Manufacturer extraction from product name or model number
    manufacturer = _extract_manufacturer(name, model_number, attributes)
    if manufacturer:
        relationships.append({
            "source_id": product_id,
            "source_type": "product",
            "target_id": hash(manufacturer) % 100000,
            "target_type": "manufacturer",
            "relationship_type": "manufactured_by",
            "label": f"Manufactured by {manufacturer}",
        })

    # Standard compliance extraction
    standards = _extract_standards(attributes)
    for std in standards:
        relationships.append({
            "source_id": product_id,
            "source_type": "product",
            "target_id": hash(std) % 100000,
            "target_type": "standard",
            "relationship_type": "compliant_with",
            "label": f"Compliant with {std}",
        })

    # Cross-product relationships (same category)
    # These would be enriched when multiple products exist
    for attr in attributes:
        if attr.get("key") == "category" or attr.get("label") == "Category":
            cat_val = attr.get("value") or attr.get("normalized_value")
            if cat_val:
                relationships.append({
                    "source_id": product_id,
                    "source_type": "product",
                    "target_id": hash(cat_val) % 100000,
                    "target_type": "attribute",
                    "relationship_type": "relates_to",
                    "label": f"In category: {cat_val}",
                })

    return relationships


def _extract_manufacturer(name: str, model_number: str, attributes: List[Dict]) -> Optional[str]:
    """Try to extract manufacturer name from product data."""
    known_manufacturers = [
        "Siemens", "ABB", "Schneider", "Eaton", "Rockwell", "Allen-Bradley",
        "Bosch", "Mitsubishi", "Honeywell", "Emerson", "Yokogawa",
        "General Electric", "GE", "Danfoss", "Legrand", "Phoenix Contact",
    ]
    combined = f"{name} {model_number}".lower()
    for mfr in known_manufacturers:
        if mfr.lower() in combined:
            return mfr

    # Check attributes for manufacturer
    for attr in attributes:
        key = (attr.get("key") or "").lower()
        label = (attr.get("label") or "").lower()
        if "manufacturer" in key or "manufacturer" in label:
            return attr.get("value") or attr.get("normalized_value")

    return None


def _extract_standards(attributes: List[Dict]) -> List[str]:
    """Extract standards references from attribute values and evidence."""
    import re
    standards = set()
    standard_pattern = re.compile(r'(IEC\s*\d+[-\d]*(?:-\d+)*|ISO\s*\d+|EN\s*\d+|NEMA\s*\w+|UL\s*\d+|CE\b|IP\d{2}|IE3|IE2|IE4|IE5)', re.IGNORECASE)

    for attr in attributes:
        for field in ["value", "raw_value", "normalized_value", "evidence", "evidence_quote"]:
            text = attr.get(field, "") or ""
            matches = standard_pattern.findall(str(text))
            for m in matches:
                standards.add(m.strip())

    return list(standards)


def build_graph_nodes_edges(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build a complete graph with nodes and edges from all products.

    Returns dict with 'nodes' and 'edges' lists suitable for visualization.
    """
    nodes = []
    edges = []
    node_map = {}  # (type, id) -> node

    for product in products:
        pid = product.get("id", 0)
        # Add product node
        key = ("product", pid)
        if key not in node_map:
            node = {
                "id": f"product-{pid}",
                "type": "product",
                "label": product.get("name", f"Product {pid}"),
                "model": product.get("model_number", ""),
                "category": product.get("category", ""),
                "health_score": product.get("health_score", 0),
            }
            node_map[key] = node
            nodes.append(node)

        # Extract relationships
        rels = extract_relationships(product)
        for rel in rels:
            # Source node
            src_key = (rel["source_type"], rel["source_id"])
            if src_key not in node_map:
                src_node = {
                    "id": f"{rel['source_type']}-{rel['source_id']}",
                    "type": rel["source_type"],
                    "label": product.get("name", f"Product {rel['source_id']}"),
                }
                node_map[src_key] = src_node
                nodes.append(src_node)

            # Target node
            tgt_key = (rel["target_type"], rel["target_id"])
            if tgt_key not in node_map:
                tgt_node = {
                    "id": f"{rel['target_type']}-{rel['target_id']}",
                    "type": rel["target_type"],
                    "label": rel["label"].replace("Manufactured by ", "").replace("Compliant with ", "").replace("In category: ", ""),
                }
                node_map[tgt_key] = tgt_node
                nodes.append(tgt_node)

            # Edge
            edges.append({
                "source": f"{rel['source_type']}-{rel['source_id']}",
                "target": f"{rel['target_type']}-{rel['target_id']}",
                "type": rel["relationship_type"],
                "label": rel["label"],
            })

    return {"nodes": nodes, "edges": edges}


def query_graph(
    graph_data: Dict[str, Any],
    query_type: str = "related",
    entity_id: Optional[str] = None,
    entity_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Query the knowledge graph for related entities.

    query_type: "related", "by_type", "shortest_path"
    """
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])

    if query_type == "by_type" and entity_type:
        filtered = [n for n in nodes if n.get("type") == entity_type]
        return {"nodes": filtered, "edges": [e for e in edges if any(n["id"] == e["source"] for n in filtered) or any(n["id"] == e["target"] for n in filtered)]}

    if query_type == "related" and entity_id:
        connected_ids = set()
        connected_ids.add(entity_id)
        for e in edges:
            if e["source"] == entity_id:
                connected_ids.add(e["target"])
            if e["target"] == entity_id:
                connected_ids.add(e["source"])
        return {
            "nodes": [n for n in nodes if n["id"] in connected_ids],
            "edges": [e for e in edges if e["source"] in connected_ids and e["target"] in connected_ids],
        }

    return {"nodes": nodes, "edges": edges}
