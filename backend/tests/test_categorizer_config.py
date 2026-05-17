import asyncio
import importlib
import sys
import types


def _reload_categorizer(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://100.112.64.99:20128/v1")
    monkeypatch.setenv("LLM_API_KEY", "sk_9router")
    monkeypatch.setenv("LLM_MODEL", "UnliCombo")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    import services.categorizer as categorizer
    return importlib.reload(categorizer)


def test_llm_client_uses_generic_env_config(monkeypatch):
    calls = []

    class FakeAsyncOpenAI:
        def __init__(self, **kwargs):
            calls.append(kwargs)

    monkeypatch.setitem(sys.modules, "openai", types.SimpleNamespace(AsyncOpenAI=FakeAsyncOpenAI))
    categorizer = _reload_categorizer(monkeypatch)

    categorizer._make_llm_client()

    assert calls == [
        {
            "base_url": "http://100.112.64.99:20128/v1",
            "api_key": "sk_9router",
        }
    ]


def test_call_with_fallback_uses_configured_model_once(monkeypatch):
    categorizer = _reload_categorizer(monkeypatch)
    seen_models = []

    async def fake_call_model(descriptions, model):
        seen_models.append(model)
        return ["Other"] * len(descriptions)

    monkeypatch.setattr(categorizer, "_call_model", fake_call_model)

    result = asyncio.run(categorizer._call_with_fallback(["UNKNOWN MERCHANT"]))

    assert result == ["Other"]
    assert seen_models == ["UnliCombo"]
