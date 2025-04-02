from main import app

for route in app.routes:
    if hasattr(route, "methods"):
        methods = route.methods
    else:
        methods = ["--"]
    
    if hasattr(route, "path"):
        path = route.path
    else:
        path = str(route)
        
    print(f"{methods} {path}") 