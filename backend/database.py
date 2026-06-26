import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI not found in environment variables")

client = AsyncIOMotorClient(MONGO_URI)

# The URI has the db name in it, but motor doesn't automatically select it from URI easily if we want to be explicit.
# Let's parse it or just use the database name "jobagg" or "jobaggregator".
# From the env: mongodb+srv://anandvcsbs2023:YOgLLmYTxHPzDcP5@zorphix.hexeg.mongodb.net/jobagg?retryWrites=true&w=majority&appName=zorphix
# The database is `jobagg`. Let's get the default database.
db = client.get_default_database("jobagg")

def get_db():
    return db
