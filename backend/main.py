import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import statements

load_dotenv()

app = FastAPI(title="BCA e-Statement API")

# For self-hosted / home-server deployments behind Tailscale or a private network,
# we allow all origins. Auth is enforced by Supabase JWT on every request.
# To restrict origins, set CORS_ORIGINS=comma,separated,list in your .env.
_raw = os.environ.get("CORS_ORIGINS", "*")
if _raw.strip() == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],  # credentials not allowed with wildcard
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(statements.router, prefix="/api")
