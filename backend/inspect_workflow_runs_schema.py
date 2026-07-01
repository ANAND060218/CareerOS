import requests
import json

r = requests.get("http://127.0.0.1:8711/openapi.json")
data = r.json()
schema = "AgentRuntimeConfig"
if schema in data.get("components", {}).get("schemas", {}):
    print(json.dumps(data["components"]["schemas"][schema], indent=2))
else:
    print(f"Schema {schema} not found")
