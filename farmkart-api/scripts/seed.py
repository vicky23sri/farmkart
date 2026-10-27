import os
import sys

# Add parent directory to path so app modules can be loaded
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.product import Product


def seed_database():
    """Populate database with 1 sample seller, 1 sample buyer, and 10 Tamil Nadu products."""
    print("🌱 Connecting to database and creating tables if not present...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Create or get Sample Seller
        seller = db.query(User).filter(User.mobile == "9842156780").first()
        if not seller:
            seller = User(
                mobile="9842156780",
                role="seller",
                name="Ramasamy Gounder",
                address="Vadipatti Organic Farm, Madurai District, Tamil Nadu",
                lat=10.0528,
                lng=77.9625,
            )
            db.add(seller)
            db.commit()
            db.refresh(seller)
            print(f"✅ Created Seller: {seller.name} (Mobile: {seller.mobile}, ID: {seller.id})")
        else:
            print(f"ℹ️ Seller already exists: {seller.name} (ID: {seller.id})")

        # 2. Create or get Sample Buyer
        buyer = db.query(User).filter(User.mobile == "9876543210").first()
        if not buyer:
            buyer = User(
                mobile="9876543210",
                role="buyer",
                name="Karthik V.",
                address="45 Anna Nagar Main Road, Madurai, Tamil Nadu",
                lat=9.9252,
                lng=78.1198,
            )
            db.add(buyer)
            db.commit()
            db.refresh(buyer)
            print(f"✅ Created Buyer: {buyer.name} (Mobile: {buyer.mobile}, ID: {buyer.id})")
        else:
            print(f"ℹ️ Buyer already exists: {buyer.name} (ID: {buyer.id})")

        # 3. Seed 10 Tamil Nadu Agricultural Products
        existing_products_count = db.query(Product).filter(Product.seller_id == seller.id).count()
        if existing_products_count >= 10:
            print(f"ℹ️ {existing_products_count} products already present in database.")
            return

        sample_products = [
            {
                "name": "Thanjavur Ponni Raw Rice",
                "name_tamil": "தஞ்சாவூர் பொன்னி பச்சரிசி",
                "category": "Grains and Millets",
                "price": 1450.0,
                "unit": "bag (25 kg)",
                "stock": 80.0,
                "min_order": 1.0,
                "is_organic": True,
                "harvest_date": "Oct 2026",
                "images": ["https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Mini Truck",
                "variety": "Deluxe Ponni BPT",
            },
            {
                "name": "Salem Pure Organic Cow Dung Manure",
                "name_tamil": "சேலம் மாட்டுச் சாண இயற்கை எரு",
                "category": "Organic Manure",
                "price": 4200.0,
                "unit": "tractor load",
                "stock": 10.0,
                "min_order": 1.0,
                "is_organic": True,
                "harvest_date": "Sept 2026",
                "images": ["https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Tractor",
                "composting_age": "90 days microbial decomposed",
            },
            {
                "name": "Pollachi Fresh Green Tender Coconuts",
                "name_tamil": "பொள்ளாச்சி இளநீர் கட்டு",
                "category": "Fresh Produce",
                "price": 1100.0,
                "unit": "bundle (25 pcs)",
                "stock": 40.0,
                "min_order": 1.0,
                "is_organic": True,
                "harvest_date": "Daily Fresh Pluck",
                "images": ["https://images.unsplash.com/photo-1525385133512-2f3bdd039054?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Pickup Truck",
                "variety": "West Coast Tall",
            },
            {
                "name": "Madurai Dry Paddy Straw Hay",
                "name_tamil": "மதுரை வைக்கோல் கட்டு",
                "category": "Fodder",
                "price": 180.0,
                "unit": "bundle",
                "stock": 250.0,
                "min_order": 5.0,
                "is_organic": False,
                "harvest_date": "Sept 2026",
                "images": ["https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Tractor / Mini Truck",
                "moisture_content": "< 10% golden sun-dried",
                "variety": "BPT 5204",
            },
            {
                "name": "Erode Farm-Fresh Golden Turmeric",
                "name_tamil": "ஈரோடு நாட்டு விரலி மஞ்சள்",
                "category": "Spices",
                "price": 260.0,
                "unit": "kg",
                "stock": 150.0,
                "min_order": 2.0,
                "is_organic": True,
                "harvest_date": "Aug 2026",
                "images": ["https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Bike / Mini Van",
                "variety": "Erode Local Salem",
            },
            {
                "name": "Theni Karpooravalli Country Bananas",
                "name_tamil": "தேனி கற்பூரவள்ளி நாட்டு வாழைப்பழம்",
                "category": "Fresh Produce",
                "price": 380.0,
                "unit": "bundle",
                "stock": 65.0,
                "min_order": 1.0,
                "is_organic": True,
                "harvest_date": "Fresh tree ripened",
                "images": ["https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Mini Truck",
                "variety": "Karpooravalli",
            },
            {
                "name": "Dharmapuri Native Finger Millet (Ragi)",
                "name_tamil": "தர்மபுரி நாட்டு கேழ்வரகு / ராகி",
                "category": "Grains and Millets",
                "price": 520.0,
                "unit": "bag (10 kg)",
                "stock": 90.0,
                "min_order": 1.0,
                "is_organic": True,
                "harvest_date": "Sept 2026",
                "images": ["https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Pickup Truck",
                "variety": "GPU-28 Traditional",
            },
            {
                "name": "Dindigul Enriched Vermicompost",
                "name_tamil": "திண்டுக்கல் செறிவூட்டப்பட்ட மண்புழு உரம்",
                "category": "Organic Manure",
                "price": 650.0,
                "unit": "bag (50 kg)",
                "stock": 75.0,
                "min_order": 2.0,
                "is_organic": True,
                "harvest_date": "Oct 2026",
                "images": ["https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Mini Truck",
                "composting_age": "Trichoderma and Pseudomonas enriched",
            },
            {
                "name": "Sivagangai Horticultural Coir Pith Blocks",
                "name_tamil": "சிவகங்கை தென்னை நார் கழிவு உரம்",
                "category": "Organic Manure",
                "price": 220.0,
                "unit": "bundle (5 kg block)",
                "stock": 120.0,
                "min_order": 2.0,
                "is_organic": True,
                "harvest_date": "Oct 2026",
                "images": ["https://images.unsplash.com/photo-1617576683096-00fc8eecb3af?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Mini Truck",
                "moisture_content": "Low EC (< 0.5 mS/cm) washed",
            },
            {
                "name": "Chettinad Yellow Feed Maize",
                "name_tamil": "செட்டிநாடு கால்நடை தீவன மக்காச்சோளம்",
                "category": "Fodder",
                "price": 1250.0,
                "unit": "bag (50 kg)",
                "stock": 45.0,
                "min_order": 1.0,
                "is_organic": False,
                "harvest_date": "Aug 2026",
                "images": ["https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800&auto=format&fit=crop"],
                "lat": seller.lat,
                "lng": seller.lng,
                "delivery_radius_km": 50.0,
                "vehicle_type": "Truck",
                "moisture_content": "< 12% moisture grade A",
                "variety": "Hybrid Yellow Pioneer",
            },
        ]

        for p_data in sample_products:
            prod = Product(seller_id=seller.id, **p_data)
            db.add(prod)

        db.commit()
        print(f"🎉 Successfully seeded {len(sample_products)} Tamil Nadu products!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
