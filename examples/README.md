# Examples

| Folder | What it shows |
| --- | --- |
| [`langgraph/`](langgraph/) | A LangGraph agent in Python that takes a build, does the work as graph nodes, and proves the milestone through the REST API |
| [`openai-agents/`](openai-agents/) | An OpenAI Agents SDK agent with Pledgr exposed as tools |
| [`python/`](python/) | Plain Python against the REST API, no framework |

Every example needs a running API:

```bash
npm run dev --workspace apps/api
export PLEDGR_API_URL=http://127.0.0.1:8787/v1
```
