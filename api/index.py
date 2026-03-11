from mangum import Mangum
from backend.main import app

# Point d'entrée Vercel (ASGI via Mangum)
handler = Mangum(app, lifespan="auto")
