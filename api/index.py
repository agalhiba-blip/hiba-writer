import sys
import os

# Ajouter le dossier racine du projet au PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mangum import Mangum
from backend.main import app

# Point d'entrée Vercel (ASGI via Mangum)
handler = Mangum(app, lifespan="auto")
