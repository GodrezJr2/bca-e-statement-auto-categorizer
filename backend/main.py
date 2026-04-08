import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import statements

load_dotenv()

app = FastAPI(title="BCA e-Statement API")

# CORS_ORIGINS can be a comma-separated list, e.g.:
# "http://localhost:3000,https://your-app.vercel.app"
_raw = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
origins = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(statements.router, prefix="/api")
