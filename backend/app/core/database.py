from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Used to store the database in this path
DATABASE_URL = "sqlite:///./data/app.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Creates the factory sessions with parameters that force changes to happens only when I do db.commit()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    # A request to get a new DB session
    db = SessionLocal()
    try:
        # gives the session
        yield db
    finally:
        # closes the session
        db.close()