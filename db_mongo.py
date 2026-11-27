import os
from pymongo import MongoClient

# En Render configuraremos la variable de entorno MONGO_URI con tu cadena de MongoDB Atlas.
# En tu computadora local, si no existe la variable, usará localhost por defecto.
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')

client = MongoClient(MONGO_URI, connect=False, serverSelectionTimeoutMS=5000)
db = client['mi_tienda_db']