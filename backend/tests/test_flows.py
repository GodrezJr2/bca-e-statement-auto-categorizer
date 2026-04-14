def test_flow_schemas_importable():
    from models.schemas import FlowNode, FlowLink, FlowMetadata, FlowsResponse
    node = FlowNode(id="Income", value=1000000, type="source", color="#10B981")
    assert node.id == "Income"
    link = FlowLink(source="Income", target="Food", value=500000, transactions=5)
    assert link.value == 500000
    meta = FlowMetadata(total_transactions=5, total_amount=500000, period="2026-03-01 – 2026-03-31")
    assert meta.total_transactions == 5
    resp = FlowsResponse(nodes=[node], links=[link], metadata=meta)
    assert len(resp.nodes) == 1
