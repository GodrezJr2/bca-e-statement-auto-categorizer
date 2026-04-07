from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import statements

app = FastAPI(title="BCA e-Statement API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(statements.router, prefix="/api")
