import importlib
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI

from middlewares.request_logger import RequestLoggerMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Automatically load and execute background schedulers
    schedulers_dir = Path(__file__).parent / "schedulers"
    if schedulers_dir.exists():
        for file in schedulers_dir.glob("*.py"):
            if file.name == "__init__.py":
                continue
            module_name = f"schedulers.{file.stem}"
            try:
                module = importlib.import_module(module_name)
                if hasattr(module, "start") and asyncio.iscoroutinefunction(module.start):
                    # Start task in the background asyncio event loop
                    asyncio.create_task(module.start())
                    print(f"[Autoload] Started scheduler task: {module_name}")
            except Exception as e:
                print(f"[Autoload] Failed to start scheduler {module_name}: {e}")

    yield

app = FastAPI(
    title="FastAPI Backend Template",
    description="Clean, modular FastAPI template with autoloader logic",
    version="1.0.0",
    lifespan=lifespan
)

# Register Middleware
app.add_middleware(RequestLoggerMiddleware)

# 2. Automatically discover and register HTTP routers (routes/*/router.py)
routes_dir = Path(__file__).parent / "routes"
if routes_dir.exists():
    for router_file in routes_dir.rglob("router.py"):
        relative_parts = router_file.relative_to(Path(__file__).parent).parts
        module_name = ".".join([p.replace(".py", "") for p in relative_parts])
        try:
            module = importlib.import_module(module_name)
            if hasattr(module, "router"):
                app.include_router(module.router)
                print(f"[Autoload] Registered HTTP router: {module_name}")
        except Exception as e:
            print(f"[Autoload] Failed to register HTTP router {module_name}: {e}")

# 3. Automatically discover and register WebSocket routers (sockets/*.py)
sockets_dir = Path(__file__).parent / "sockets"
if sockets_dir.exists():
    for socket_file in sockets_dir.glob("*.py"):
        if socket_file.name == "__init__.py":
            continue
        module_name = f"sockets.{socket_file.stem}"
        try:
            module = importlib.import_module(module_name)
            if hasattr(module, "router"):
                app.include_router(module.router)
                print(f"[Autoload] Registered WebSocket router: {module_name}")
        except Exception as e:
            print(f"[Autoload] Failed to register WebSocket router {module_name}: {e}")

@app.get("/")
def read_root():
    return {"message": "FastAPI Template API is running successfully"}
