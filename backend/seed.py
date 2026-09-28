import os
from dotenv import load_dotenv
from .database import Base, engine, SessionLocal
from .models import User, Property
from .auth import hash_password
load_dotenv()
Base.metadata.create_all(engine)
db=SessionLocal()
try:
    email=os.getenv("ADMIN_EMAIL","admin@asaba.local")
    if not db.query(User).filter_by(email=email).first():
        db.add(User(email=email,password_hash=hash_password(os.getenv("ADMIN_PASSWORD","ChangeMe123!")),role="admin"))
    if db.query(Property).count()==0:
        db.add_all([
          Property(name="Asaba Garden Suites",kind="Hotel",location="GRA, Asaba",capacity=120,price_per_day=180000,image="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=82"),
          Property(name="Riverfront Shortlet",kind="Shortlet",location="Okpanam Road, Asaba",capacity=8,price_per_day=95000,image="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=82"),
          Property(name="Golden Palm Events",kind="Event Centre",location="Nnebisi Road, Asaba",capacity=450,price_per_day=350000,image="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1400&q=82")
        ])
    db.commit()
finally: db.close()
print("Seed complete")
