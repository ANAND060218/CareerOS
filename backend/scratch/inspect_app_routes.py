import sys
import os

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

print("REGISTERED ROUTE PATHS:")
for route in app.routes:
    # Print the route path and methods
    methods = getattr(route, "methods", None)
    print(f"- {route.path} (Methods: {methods})")
