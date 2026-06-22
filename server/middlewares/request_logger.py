import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# middlewares/request_logger.py

class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        print(f"[Middleware] {request.method} {request.url.path} - Completed in {process_time:.4f}s")
        return response
