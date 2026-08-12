import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import engine, Base, SessionLocal
from src.users.models import User
from src.societies.models import Society, Household, JoinRequest
from src.wallet.models import Transaction
from src.marketplace.models import Skill, Resource
from src.events.models import EventItem, VolunteerRequest
from src.complaints.models import Complaint
from src.auth.security import get_password_hash


def reset_and_seed_db():
    print("Resetting database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Tables recreated successfully.")

    db = SessionLocal()
    try:
        print("Seeding clean demo data...")
        hashed_pwd = get_password_hash("password123")

        # 1. Create Society Owner
        owner = User(
            id="u-owner",
            name="System Owner",
            email="owner@cen.app",
            hashed_password=hashed_pwd,
            role="owner",
        )
        db.add(owner)
        db.flush()

        # 2. Create Active Demo Society
        demo_soc = Society(
            id="soc-demo",
            name="Green Oasis Society",
            type="Residential Apartment",
            address="100 Garden Way, Block B",
            latitude=12.9716,
            longitude=77.5946,
            admin_id="u-admin",
            capacity=100,
            initial_credits=20,
            household_range_start=1,
            household_range_end=100,
            coordinator_count=2,  # Operational!
            status="active",
            performance_score=98,
            key="OASIS-2026",
        )
        db.add(demo_soc)
        db.flush()

        # 3. Create Society Admin
        admin = User(
            id="u-admin",
            name="Alice Admin",
            email="admin@cen.app",
            hashed_password=hashed_pwd,
            role="admin",
            society_id=demo_soc.id,
            credit_balance=50,
        )
        db.add(admin)

        # 4. Create 2 Coordinators (Meets operational requirement!)
        coord1 = User(
            id="u-coord1",
            name="Bob Coordinator",
            email="coord@cen.app",
            hashed_password=hashed_pwd,
            role="coordinator",
            is_coordinator=True,
            society_id=demo_soc.id,
            credit_balance=30,
        )
        coord2 = User(
            id="u-coord2",
            name="Carol Coordinator",
            email="coord2@cen.app",
            hashed_password=hashed_pwd,
            role="coordinator",
            is_coordinator=True,
            society_id=demo_soc.id,
            credit_balance=30,
        )
        db.add(coord1)
        db.add(coord2)

        # 5. Create 2 Residents
        res1 = User(
            id="u-res1",
            name="David Resident",
            email="resident@cen.app",
            hashed_password=hashed_pwd,
            role="resident",
            society_id=demo_soc.id,
            household_id="h-101",
            credit_balance=25,
            interests="Music, Teaching, Technology",
            volunteer_interest="Education, Tech Support, Community Outreach",
            offered_skills_text="I can teach guitar and fix computers.",
        )
        res2 = User(
            id="u-res2",
            name="Eva Resident",
            email="resident2@cen.app",
            hashed_password=hashed_pwd,
            role="resident",
            society_id=demo_soc.id,
            household_id="h-102",
            credit_balance=15,
            interests="Gardening, Tools, DIY",
            volunteer_interest="Park Cleanup, Maintenance, Green Initiatives",
            offered_skills_text="I have a lawn mower and gardening tools to share.",
        )
        db.add(res1)
        db.add(res2)
        db.flush()

        from src.users.models import UserSummary
        from datetime import date
        us1 = UserSummary(
            user_id=res1.id,
            summary_text="Welcome to the community pulse! This week, we have some great music events and tech workshops you might enjoy based on your interests. Dive in and share your guitar skills with others!",
            generated_at=date.today().isoformat()
        )
        us2 = UserSummary(
            user_id=res2.id,
            summary_text="Hello Eva! The community garden is thriving this week. Based on your DIY interests, check out the upcoming tool-share meetup and park cleanup event.",
            generated_at=date.today().isoformat()
        )
        db.add(us1)
        db.add(us2)

        # 6. Create Households
        h1 = Household(id="h-101", society_id=demo_soc.id, unit_number="A-101", claimed=True, claimed_by_user_id=res1.id)
        h2 = Household(id="h-102", society_id=demo_soc.id, unit_number="A-102", claimed=True, claimed_by_user_id=res2.id)
        h3 = Household(id="h-103", society_id=demo_soc.id, unit_number="A-103", claimed=False)
        db.add(h1)
        db.add(h2)
        db.add(h3)

        # 7. Create Sample Marketplace Skill & Resource
        skill = Skill(
            id="sk-guitar",
            title="Acoustic Guitar Lessons",
            category="Music",
            provider_id=res1.id,
            provider_name=res1.name,
            credits=5,
            description="Beginner to intermediate guitar lessons. 1 hour session.",
            status="approved",
            tags="music,guitar,lessons",
            society_id=demo_soc.id,
        )
        resource = Resource(
            id="r-mower",
            name="Electric Lawn Mower",
            category="Tools",
            owner_id=res2.id,
            owner_name=res2.name,
            available=True,
            credits=3,
            status="approved",
            description="Cordless battery-powered lawn mower.",
            society_id=demo_soc.id,
        )
        db.add(skill)
        db.add(resource)

        # 8. Create Sample Event
        event = EventItem(
            id="ev-cleanup",
            title="Community Park Clean-Up",
            description="Join us for a morning clean-up and landscaping of the central park.",
            start_time="2026-08-05T09:00:00",
            end_time="2026-08-05T12:00:00",
            created_by_coordinator_id=coord1.id,
            volunteers_needed=5,
            volunteers=res1.id,
            status="upcoming",
            society_id=demo_soc.id,
        )
        db.add(event)

        db.commit()
        print("Database seeded with pre-configured demo accounts and items!")
    except Exception as e:
        db.rollback()
        print("Error seeding database:", e)
    finally:
        db.close()


if __name__ == "__main__":
    reset_and_seed_db()
