from fastapi import HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

class APIException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(status_code=status_code, detail={"code": code, "message": message})
        self.code = code
        self.message = message

def create_error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message
            }
        }
    )

async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail and "message" in exc.detail:
        code = exc.detail["code"]
        message = exc.detail["message"]
    else:
        # Default mapping based on status code
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            500: "INTERNAL_SERVER_ERROR"
        }
        code = code_map.get(exc.status_code, "HTTP_ERROR")
        message = str(exc.detail) if exc.detail else "An error occurred"

    return create_error_response(exc.status_code, code, message)

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_err = errors[0] if errors else {}
    msg = first_err.get("msg", "Validation error")
    loc = " -> ".join([str(x) for x in first_err.get("loc", [])])
    full_msg = f"{msg} at {loc}" if loc else msg
    return create_error_response(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", full_msg)
