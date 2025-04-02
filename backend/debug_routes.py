from main import app
from starlette.routing import Route as StarletteRoute, WebSocketRoute, Mount
from fastapi.routing import APIRoute
import inspect

print("Registered Routes:")
print("-" * 30)

for route in app.routes:
    if isinstance(route, APIRoute):
        endpoint_name = getattr(route.endpoint, '__name__', str(route.endpoint))
        print(f"  Path: {route.path}")
        print(f"    Methods: {sorted(list(route.methods))}")
        print(f"    Endpoint: {endpoint_name}")
        print(f"    Name: {route.name}")
    elif isinstance(route, StarletteRoute):
        endpoint_name = getattr(route.endpoint, '__name__', str(route.endpoint))
        methods = sorted(list(route.methods)) if route.methods else []
        print(f"  Path: {route.path} (Starlette Route)")
        print(f"    Methods: {methods}")
        print(f"    Endpoint: {endpoint_name}")
        print(f"    Name: {route.name}")
    elif isinstance(route, WebSocketRoute):
        endpoint_name = getattr(route.endpoint, '__name__', str(route.endpoint))
        print(f"  Path: {route.path} (WebSocket)")
        print(f"    Endpoint: {endpoint_name}")
        print(f"    Name: {route.name}")
    elif isinstance(route, Mount):
        # For mounted applications (like static files)
        print(f"  Mount Path: {route.path}")
        # You could recursively inspect route.routes if needed
    else:
        # Fallback for any other route types
        path_attr = getattr(route, 'path', None)
        route_repr = path_attr if path_attr else str(route)
        print(f"  Unknown Route Type: {type(route).__name__} at {route_repr}")
    
    print("-" * 30) 